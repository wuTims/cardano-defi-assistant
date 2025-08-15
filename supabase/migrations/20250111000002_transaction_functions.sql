-- Transaction Helper Functions
-- Provides database functions for efficient transaction operations

-- ============================================
-- FUNCTION: Get user's transaction summary
-- ============================================
CREATE OR REPLACE FUNCTION get_transaction_summary(p_user_id UUID)
RETURNS TABLE (
  total_transactions INTEGER,
  unique_tokens INTEGER,
  protocols_used TEXT[],
  total_fees BIGINT,
  last_transaction_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_transactions,
    COUNT(DISTINCT af.token_unit)::INTEGER as unique_tokens,
    ARRAY_AGG(DISTINCT wt.protocol::TEXT) FILTER (WHERE wt.protocol IS NOT NULL) as protocols_used,
    SUM(wt.fees)::BIGINT as total_fees,
    MAX(wt.timestamp) as last_transaction_date
  FROM wallet_transactions wt
  LEFT JOIN asset_flows af ON af.transaction_id = wt.id
  WHERE wt.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Get token balances from flows
-- ============================================
CREATE OR REPLACE FUNCTION get_token_balances(p_user_id UUID)
RETURNS TABLE (
  token_unit TEXT,
  token_name TEXT,
  token_ticker TEXT,
  token_category token_category,
  total_balance BIGINT,
  transaction_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.unit as token_unit,
    t.name as token_name,
    t.ticker as token_ticker,
    t.category as token_category,
    SUM(af.net_change)::BIGINT as total_balance,
    COUNT(DISTINCT wt.id)::INTEGER as transaction_count
  FROM wallet_transactions wt
  INNER JOIN asset_flows af ON af.transaction_id = wt.id
  INNER JOIN tokens t ON t.unit = af.token_unit
  WHERE wt.user_id = p_user_id
  GROUP BY t.unit, t.name, t.ticker, t.category
  HAVING SUM(af.net_change) != 0
  ORDER BY 
    CASE t.unit WHEN 'lovelace' THEN 0 ELSE 1 END,  -- ADA first
    total_balance DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Get transactions with pagination
-- ============================================
CREATE OR REPLACE FUNCTION get_transactions_paginated(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_action transaction_action DEFAULT NULL,
  p_protocol protocol DEFAULT NULL,
  p_from_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_to_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  transaction_id TEXT,
  tx_hash TEXT,
  block_height INTEGER,
  tx_timestamp TIMESTAMP WITH TIME ZONE,
  tx_action transaction_action,
  tx_protocol protocol,
  description TEXT,
  net_ada_change BIGINT,
  fees BIGINT,
  asset_flows JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wt.id as transaction_id,
    wt.tx_hash,
    wt.block_height,
    wt.timestamp as tx_timestamp,
    wt.action as tx_action,
    wt.protocol as tx_protocol,
    wt.description,
    wt.net_ada_change,
    wt.fees,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'token_unit', af.token_unit,
          'token_name', t.name,
          'token_ticker', t.ticker,
          'token_category', t.category,
          'net_change', af.net_change,
          'in_flow', af.in_flow,
          'out_flow', af.out_flow
        ) ORDER BY 
          CASE af.token_unit WHEN 'lovelace' THEN 0 ELSE 1 END,
          ABS(af.net_change) DESC
      ) FILTER (WHERE af.id IS NOT NULL),
      '[]'::jsonb
    ) as asset_flows
  FROM wallet_transactions wt
  LEFT JOIN asset_flows af ON af.transaction_id = wt.id
  LEFT JOIN tokens t ON t.unit = af.token_unit
  WHERE wt.user_id = p_user_id
    AND (p_action IS NULL OR wt.action = p_action)
    AND (p_protocol IS NULL OR wt.protocol = p_protocol)
    AND (p_from_date IS NULL OR wt.timestamp >= p_from_date)
    AND (p_to_date IS NULL OR wt.timestamp <= p_to_date)
  GROUP BY wt.id, wt.tx_hash, wt.block_height, wt.timestamp, 
           wt.action, wt.protocol, wt.description, wt.net_ada_change, wt.fees
  ORDER BY wt.timestamp DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Bulk insert transactions (service role only)
-- ============================================
CREATE OR REPLACE FUNCTION bulk_insert_transactions(
  p_transactions JSONB
)
RETURNS TABLE (
  inserted_count INTEGER,
  skipped_count INTEGER
) AS $$
DECLARE
  v_inserted INTEGER := 0;
  v_skipped INTEGER := 0;
  v_tx JSONB;
  v_flow JSONB;
BEGIN
  -- Check if caller has service role
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Only service role can bulk insert transactions';
  END IF;

  -- Process each transaction
  FOR v_tx IN SELECT * FROM jsonb_array_elements(p_transactions)
  LOOP
    BEGIN
      -- Insert transaction
      INSERT INTO wallet_transactions (
        id, user_id, wallet_address, tx_hash, block_height,
        timestamp, action, protocol, description, net_ada_change, fees
      ) VALUES (
        v_tx->>'id',
        (v_tx->>'user_id')::UUID,
        v_tx->>'wallet_address',
        v_tx->>'tx_hash',
        (v_tx->>'block_height')::INTEGER,
        (v_tx->>'timestamp')::TIMESTAMP WITH TIME ZONE,
        (v_tx->>'action')::transaction_action,
        CASE 
          WHEN v_tx->>'protocol' IS NULL THEN NULL
          ELSE (v_tx->>'protocol')::protocol
        END,
        v_tx->>'description',
        (v_tx->>'net_ada_change')::BIGINT,
        (v_tx->>'fees')::BIGINT
      );

      -- Insert asset flows for this transaction
      FOR v_flow IN SELECT * FROM jsonb_array_elements(v_tx->'asset_flows')
      LOOP
        -- First ensure token exists
        INSERT INTO tokens (unit, policy_id, asset_name, name, ticker, decimals, category)
        VALUES (
          v_flow->>'token_unit',
          COALESCE(v_flow->>'policy_id', ''),
          COALESCE(v_flow->>'asset_name', ''),
          v_flow->>'name',
          v_flow->>'ticker',
          COALESCE((v_flow->>'decimals')::INTEGER, 0),
          COALESCE((v_flow->>'category')::token_category, 'fungible')
        ) ON CONFLICT (unit) DO UPDATE SET
          name = COALESCE(EXCLUDED.name, tokens.name),
          ticker = COALESCE(EXCLUDED.ticker, tokens.ticker);

        -- Insert flow
        INSERT INTO asset_flows (
          transaction_id, token_unit, net_change, in_flow, out_flow
        ) VALUES (
          v_tx->>'id',
          v_flow->>'token_unit',
          (v_flow->>'net_change')::BIGINT,
          (v_flow->>'in_flow')::BIGINT,
          (v_flow->>'out_flow')::BIGINT
        );
      END LOOP;

      v_inserted := v_inserted + 1;
    EXCEPTION
      WHEN unique_violation THEN
        -- Transaction already exists, skip
        v_skipped := v_skipped + 1;
      WHEN OTHERS THEN
        -- Log error and continue
        RAISE NOTICE 'Error inserting transaction %: %', v_tx->>'tx_hash', SQLERRM;
        v_skipped := v_skipped + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_inserted, v_skipped;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Get protocol statistics
-- ============================================
CREATE OR REPLACE FUNCTION get_protocol_stats(p_user_id UUID)
RETURNS TABLE (
  protocol_name protocol,
  transaction_count INTEGER,
  total_volume BIGINT,
  last_used TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wt.protocol as protocol_name,
    COUNT(*)::INTEGER as transaction_count,
    SUM(ABS(wt.net_ada_change))::BIGINT as total_volume,
    MAX(wt.timestamp) as last_used
  FROM wallet_transactions wt
  WHERE wt.user_id = p_user_id
    AND wt.protocol IS NOT NULL
  GROUP BY wt.protocol
  ORDER BY transaction_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users for read functions
GRANT EXECUTE ON FUNCTION get_transaction_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_token_balances TO authenticated;
GRANT EXECUTE ON FUNCTION get_transactions_paginated TO authenticated;
GRANT EXECUTE ON FUNCTION get_protocol_stats TO authenticated;

-- Only service role can use bulk insert
GRANT EXECUTE ON FUNCTION bulk_insert_transactions TO service_role;