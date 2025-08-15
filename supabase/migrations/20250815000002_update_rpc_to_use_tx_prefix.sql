-- Migration: Update RPC Functions to Use tx_ Prefix Consistently
-- Date: 2025-08-15
-- Purpose: Make RPC functions expect tx_ prefixed field names in JSON payloads
--          for consistency with the renamed columns

-- ============================================
-- UPDATE bulk_insert_transactions FUNCTION
-- ============================================
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
    -- Check if transaction already exists (using the unique constraint columns)
    SELECT EXISTS(
      SELECT 1 FROM wallet_transactions 
      WHERE user_id = (v_tx->>'user_id')::UUID 
        AND tx_hash = v_tx->>'tx_hash'
    ) INTO v_tx_exists;
    
    IF v_tx_exists THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;
    
    -- Insert the transaction with tx_ prefixed column names
    -- Now expecting tx_ prefixed field names in the JSON
    INSERT INTO wallet_transactions (
      id,
      user_id,
      wallet_address,
      tx_hash,
      block_height,
      tx_timestamp,
      tx_action,
      tx_protocol,
      description,
      net_ada_change,
      fees
    ) VALUES (
      v_tx->>'id',
      (v_tx->>'user_id')::UUID,
      v_tx->>'wallet_address',
      v_tx->>'tx_hash',
      (v_tx->>'block_height')::INTEGER,
      (v_tx->>'tx_timestamp')::TIMESTAMP WITH TIME ZONE,  -- Changed from 'timestamp'
      (v_tx->>'tx_action')::transaction_action,            -- Changed from 'action'
      CASE 
        WHEN v_tx->>'tx_protocol' IS NOT NULL              -- Changed from 'protocol'
        THEN (v_tx->>'tx_protocol')::protocol
        ELSE NULL
      END,
      v_tx->>'description',
      (v_tx->>'net_ada_change')::BIGINT,
      (v_tx->>'fees')::BIGINT
    )
    ON CONFLICT (user_id, tx_hash) DO NOTHING;  -- Skip if already exists
    
    -- Check if insert was successful
    IF FOUND THEN
      v_inserted_count := v_inserted_count + 1;
      
      -- Insert asset flows for this transaction
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
          COALESCE((v_flow->>'decimals')::INTEGER, 0),
          COALESCE((v_flow->>'category')::token_category, 'fungible')
        ) ON CONFLICT (unit) DO UPDATE SET
          -- Update token metadata if we have better information
          name = COALESCE(EXCLUDED.name, tokens.name),
          ticker = COALESCE(EXCLUDED.ticker, tokens.ticker),
          decimals = COALESCE(EXCLUDED.decimals, tokens.decimals),
          updated_at = NOW();
        
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
        ) ON CONFLICT DO NOTHING;  -- Skip if already exists
      END LOOP;
    ELSE
      v_skipped_count := v_skipped_count + 1;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_inserted_count, v_skipped_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION bulk_insert_transactions(JSONB) TO authenticated;

-- ============================================
-- Add helpful comment
-- ============================================
COMMENT ON FUNCTION bulk_insert_transactions IS 'Bulk insert transactions with tx_ prefixed field names in JSON payload. Handles duplicates gracefully and ensures tokens exist before inserting asset flows.';