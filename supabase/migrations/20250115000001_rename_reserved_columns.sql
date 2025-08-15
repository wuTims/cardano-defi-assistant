-- Rename Reserved Keyword Columns Migration
-- 
-- Purpose: Rename columns that conflict with PostgreSQL reserved keywords
-- to use tx_ prefix consistently throughout the system
--
-- This eliminates confusion between database columns and RPC return fields
-- by using the same names everywhere

-- Rename columns in wallet_transactions table
ALTER TABLE wallet_transactions 
  RENAME COLUMN timestamp TO tx_timestamp;

ALTER TABLE wallet_transactions 
  RENAME COLUMN action TO tx_action;

ALTER TABLE wallet_transactions 
  RENAME COLUMN protocol TO tx_protocol;

-- Update any indexes that reference these columns
DROP INDEX IF EXISTS idx_wallet_transactions_timestamp;
CREATE INDEX idx_wallet_transactions_tx_timestamp 
  ON wallet_transactions (tx_timestamp DESC);

-- Comment on renamed columns for clarity
COMMENT ON COLUMN wallet_transactions.tx_timestamp IS 'Transaction timestamp (renamed from timestamp to avoid PostgreSQL reserved keyword)';
COMMENT ON COLUMN wallet_transactions.tx_action IS 'Transaction action type (renamed from action to avoid PostgreSQL reserved keyword)';
COMMENT ON COLUMN wallet_transactions.tx_protocol IS 'DeFi protocol used (renamed from protocol to avoid PostgreSQL reserved keyword)';

-- Now we need to update all functions that reference these columns
-- This ensures consistency across the entire system

-- Drop and recreate the get_transaction_summary function
DROP FUNCTION IF EXISTS get_transaction_summary(UUID);
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
    ARRAY_AGG(DISTINCT wt.tx_protocol::TEXT) FILTER (WHERE wt.tx_protocol IS NOT NULL) as protocols_used,
    SUM(wt.fees)::BIGINT as total_fees,
    MAX(wt.tx_timestamp) as last_transaction_date
  FROM wallet_transactions wt
  LEFT JOIN asset_flows af ON af.transaction_id = wt.id
  WHERE wt.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the get_transactions_paginated function
-- Now it can use the actual column names since they no longer conflict
DROP FUNCTION IF EXISTS get_transactions_paginated(UUID, INTEGER, INTEGER, transaction_action, protocol, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE);
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
    wt.tx_timestamp,  -- Now using the actual column name
    wt.tx_action,      -- Now using the actual column name
    wt.tx_protocol,    -- Now using the actual column name
    wt.description,
    wt.net_ada_change,
    wt.fees,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'token_unit', af.token_unit,
          'net_change', af.net_change,
          'in_flow', af.in_flow,
          'out_flow', af.out_flow,
          'policy_id', t.policy_id,
          'asset_name', t.asset_name,
          'token_name', t.name,
          'token_ticker', t.ticker,
          'decimals', t.decimals,
          'token_category', t.category
        ) ORDER BY af.token_unit
      ) FILTER (WHERE af.token_unit IS NOT NULL),
      '[]'::jsonb
    ) as asset_flows
  FROM wallet_transactions wt
  LEFT JOIN asset_flows af ON af.transaction_id = wt.id
  LEFT JOIN tokens t ON t.unit = af.token_unit
  WHERE 
    wt.user_id = p_user_id
    AND (p_action IS NULL OR wt.tx_action = p_action)
    AND (p_protocol IS NULL OR wt.tx_protocol = p_protocol)
    AND (p_from_date IS NULL OR wt.tx_timestamp >= p_from_date)
    AND (p_to_date IS NULL OR wt.tx_timestamp <= p_to_date)
  GROUP BY wt.id
  ORDER BY wt.tx_timestamp DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the bulk_insert_transactions function to use new column names
DROP FUNCTION IF EXISTS bulk_insert_transactions(jsonb);
CREATE OR REPLACE FUNCTION bulk_insert_transactions(
  p_transactions JSONB
)
RETURNS TABLE (
  inserted_count INTEGER,
  skipped_count INTEGER
) AS $$
DECLARE
  v_inserted_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
  v_tx JSONB;
  v_flow JSONB;
  v_tx_exists BOOLEAN;
BEGIN
  -- Process each transaction
  FOR v_tx IN SELECT * FROM jsonb_array_elements(p_transactions)
  LOOP
    -- Check if transaction already exists
    SELECT EXISTS(
      SELECT 1 FROM wallet_transactions WHERE id = v_tx->>'id'
    ) INTO v_tx_exists;
    
    IF v_tx_exists THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;
    
    -- Insert the transaction with new column names
    INSERT INTO wallet_transactions (
      id,
      user_id,
      wallet_address,
      tx_hash,
      block_height,
      tx_timestamp,  -- Changed from timestamp
      tx_action,     -- Changed from action
      tx_protocol,   -- Changed from protocol
      description,
      net_ada_change,
      fees
    ) VALUES (
      v_tx->>'id',
      (v_tx->>'user_id')::UUID,
      v_tx->>'wallet_address',
      v_tx->>'tx_hash',
      (v_tx->>'block_height')::INTEGER,
      (v_tx->>'timestamp')::TIMESTAMP WITH TIME ZONE,
      (v_tx->>'action')::transaction_action,
      CASE 
        WHEN v_tx->>'protocol' IS NOT NULL 
        THEN (v_tx->>'protocol')::protocol
        ELSE NULL
      END,
      v_tx->>'description',
      (v_tx->>'net_ada_change')::BIGINT,
      (v_tx->>'fees')::BIGINT
    );
    
    -- Insert asset flows
    FOR v_flow IN SELECT * FROM jsonb_array_elements(v_tx->'asset_flows')
    LOOP
      -- First ensure the token exists
      INSERT INTO tokens (
        unit,
        policy_id,
        asset_name,
        name,
        ticker,
        decimals,
        category
      ) VALUES (
        v_flow->>'token_unit',
        v_flow->>'policy_id',
        v_flow->>'asset_name',
        v_flow->>'name',
        v_flow->>'ticker',
        (v_flow->>'decimals')::INTEGER,
        COALESCE((v_flow->>'category')::token_category, 'fungible')
      ) ON CONFLICT (unit) DO NOTHING;
      
      -- Then insert the asset flow
      INSERT INTO asset_flows (
        transaction_id,
        token_unit,
        net_change,
        in_flow,
        out_flow
      ) VALUES (
        v_tx->>'id',
        v_flow->>'token_unit',
        (v_flow->>'net_change')::BIGINT,
        (v_flow->>'in_flow')::BIGINT,
        (v_flow->>'out_flow')::BIGINT
      );
    END LOOP;
    
    v_inserted_count := v_inserted_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT v_inserted_count, v_skipped_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions (unchanged, but included for completeness)
GRANT SELECT ON tokens TO authenticated;
GRANT SELECT ON wallet_transactions TO authenticated;
GRANT SELECT ON asset_flows TO authenticated;
GRANT EXECUTE ON FUNCTION get_transaction_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_token_balances(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_transactions_paginated(UUID, INTEGER, INTEGER, transaction_action, protocol, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;