-- Migration: Fix RPC Functions Properly
-- Date: 2025-08-16
-- Purpose: Fix the missing/broken RPC functions causing frontend errors

-- ============================================
-- 1. DROP EXISTING FUNCTIONS COMPLETELY
-- ============================================
-- Drop all versions of get_transactions_paginated to avoid conflicts
DROP FUNCTION IF EXISTS get_transactions_paginated(uuid, integer, integer);
DROP FUNCTION IF EXISTS get_transactions_paginated(text, integer, integer);
DROP FUNCTION IF EXISTS get_transactions_paginated(uuid);
DROP FUNCTION IF EXISTS get_transactions_paginated(text);
DROP FUNCTION IF EXISTS get_transactions_paginated;

-- Drop bulk_insert_transactions to recreate properly
DROP FUNCTION IF EXISTS bulk_insert_transactions(jsonb);
DROP FUNCTION IF EXISTS bulk_insert_transactions;

-- ============================================
-- 2. CREATE get_transactions_paginated RPC
-- ============================================
-- This function is essential for the WalletTransactionRepository
-- It returns transactions in the format expected by the frontend
CREATE OR REPLACE FUNCTION get_transactions_paginated(
  p_user_id UUID,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 50
)
RETURNS TABLE (
  transaction_id TEXT,
  wallet_address TEXT,
  tx_hash TEXT,
  block_height INTEGER,
  tx_timestamp TIMESTAMPTZ,
  tx_action TEXT,
  tx_protocol TEXT,
  description TEXT,
  net_ada_change TEXT,
  fees TEXT,
  asset_flows JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wt.id as transaction_id,
    wt.wallet_address,
    wt.tx_hash,
    wt.block_height,
    wt.tx_timestamp,
    wt.tx_action,
    wt.tx_protocol,
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
          'name', t.name,
          'ticker', t.ticker,
          'decimals', t.decimals,
          'category', t.category
        )
      ) FILTER (WHERE af.id IS NOT NULL),
      '[]'::jsonb
    ) as asset_flows
  FROM wallet_transactions wt
  LEFT JOIN asset_flows af ON wt.id = af.transaction_id
  LEFT JOIN tokens t ON af.token_unit = t.unit
  WHERE wt.user_id = p_user_id
  GROUP BY wt.id, wt.wallet_address, wt.tx_hash, wt.block_height, 
           wt.tx_timestamp, wt.tx_action, wt.tx_protocol, wt.description,
           wt.net_ada_change, wt.fees
  ORDER BY wt.tx_timestamp DESC
  LIMIT p_page_size
  OFFSET (p_page - 1) * p_page_size;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_transactions_paginated TO service_role;

-- ============================================
-- 3. RECREATE bulk_insert_transactions FUNCTION
-- ============================================
-- Update to work with current schema that already uses tx_ prefixes
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
    
    -- Insert the transaction (expects tx_ prefixed field names in JSON)
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
      v_tx->>'tx_action',
      v_tx->>'tx_protocol',
      v_tx->>'description',
      v_tx->>'net_ada_change',
      v_tx->>'fees'
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
          v_flow->>'net_change',
          v_flow->>'in_flow',
          v_flow->>'out_flow'
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
-- 4. ENSURE wallet_with_sync_status VIEW EXISTS
-- ============================================
-- This view is used by WalletRepository.findWithSyncStatus()
-- It adds computed sync_status field based on last_synced_at
-- Keep this view - it's needed for the computed sync_status field
CREATE OR REPLACE VIEW wallet_with_sync_status AS
SELECT 
  w.id,
  w.user_id,
  w.wallet_address,
  w.balance_lovelace,
  w.created_at,
  w.updated_at,
  w.last_synced_at,
  w.synced_block_height as last_synced_block,
  w.sync_in_progress,
  w.sync_error,
  CASE
    WHEN w.last_synced_at IS NULL THEN 'never'::text
    WHEN w.sync_in_progress THEN 'syncing'::text
    WHEN w.last_synced_at < (now() - '01:00:00'::interval) THEN 'stale'::text
    ELSE 'fresh'::text
  END AS sync_status
FROM wallets w;

-- Grant permissions on the view
GRANT SELECT ON wallet_with_sync_status TO anon, authenticated;