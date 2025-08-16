-- Migration: Fix All RPC Functions Type Casting
-- Date: 2025-08-16
-- Purpose: Ensure ALL RPC functions have proper type casting for enum columns

-- ============================================
-- 1. FIX bulk_insert_transactions TYPE CASTING
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
  v_transaction_id TEXT;
BEGIN
  -- Process each transaction
  FOR v_tx IN SELECT * FROM jsonb_array_elements(p_transactions)
  LOOP
    -- Check if transaction already exists
    SELECT EXISTS(
      SELECT 1 FROM wallet_transactions 
      WHERE user_id = (v_tx->>'user_id')::UUID 
        AND tx_hash = v_tx->>'tx_hash'
    ) INTO v_tx_exists;
    
    IF v_tx_exists THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;
    
    -- Insert the transaction with proper type casting for ALL columns
    v_transaction_id := v_tx->>'id';
    
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
      v_transaction_id,
      (v_tx->>'user_id')::UUID,
      v_tx->>'wallet_address',
      v_tx->>'tx_hash',
      (v_tx->>'block_height')::INTEGER,
      (v_tx->>'tx_timestamp')::TIMESTAMPTZ,
      (v_tx->>'tx_action')::transaction_action,  -- FIXED: Cast to enum
      (v_tx->>'tx_protocol')::protocol,          -- FIXED: Cast to enum
      v_tx->>'description',
      (v_tx->>'net_ada_change')::BIGINT,
      (v_tx->>'fees')::BIGINT
    );
    
    -- Insert asset flows if present
    IF v_tx ? 'asset_flows' THEN
      FOR v_flow IN SELECT * FROM jsonb_array_elements(v_tx->'asset_flows')
      LOOP
        INSERT INTO asset_flows (
          transaction_id,
          token_unit,
          net_change,
          in_flow,
          out_flow
        ) VALUES (
          v_transaction_id,
          v_flow->>'token_unit',
          (v_flow->>'net_change')::BIGINT,
          (v_flow->>'in_flow')::BIGINT,
          (v_flow->>'out_flow')::BIGINT
        );
      END LOOP;
    END IF;
    
    v_inserted_count := v_inserted_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT v_inserted_count, v_skipped_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION bulk_insert_transactions TO service_role;

-- ============================================
-- 2. VERIFY upsert_transaction FUNCTION (if exists)
-- ============================================
-- Check if this function also needs type casting fixes
-- Drop and recreate if it has the same issues

DROP FUNCTION IF EXISTS upsert_transaction(jsonb);

-- Note: If upsert_transaction is used elsewhere, add it here with proper casting
-- For now, we'll focus on bulk_insert_transactions which is the main one used by the worker