-- Migration: Convert All Enum Types to TEXT
-- Date: 2025-08-16
-- Purpose: 
--   1. Convert all enum columns to TEXT for easier type handling
--   2. Eliminate database type casting complexities
--   3. Move type validation to application layer

-- ============================================
-- 1. CONVERT ENUM COLUMNS TO TEXT
-- ============================================

-- Convert wallet_transactions enum columns
ALTER TABLE wallet_transactions 
  ALTER COLUMN tx_action TYPE TEXT,
  ALTER COLUMN tx_protocol TYPE TEXT;

-- Convert tokens enum column
ALTER TABLE tokens
  ALTER COLUMN category TYPE TEXT;

-- ============================================
-- 2. DROP ENUM TYPES (now unused)
-- ============================================
-- Note: This will only work if no other tables/functions reference these types
DROP TYPE IF EXISTS transaction_action CASCADE;
DROP TYPE IF EXISTS protocol CASCADE;
DROP TYPE IF EXISTS token_category CASCADE;

-- ============================================
-- 3. ADD DATA VALIDATION CONSTRAINTS (Optional)
-- ============================================
-- Add check constraints to ensure valid values are stored
-- These provide some database-level validation while keeping flexibility

ALTER TABLE wallet_transactions 
ADD CONSTRAINT check_tx_action_valid 
CHECK (tx_action IN (
  'receive', 'send', 'swap', 'provide_liquidity', 'remove_liquidity',
  'stake', 'unstake', 'claim_rewards', 'supply', 'withdraw', 
  'borrow', 'repay', 'lend', 'collateralize', 'unknown'
));

ALTER TABLE wallet_transactions 
ADD CONSTRAINT check_tx_protocol_valid 
CHECK (tx_protocol IS NULL OR tx_protocol IN (
  'minswap', 'liqwid', 'sundaeswap', 'wingriders', 
  'indigo', 'djed', 'unknown'
));

ALTER TABLE tokens
ADD CONSTRAINT check_category_valid
CHECK (category IN (
  'native', 'fungible', 'lp_token', 'q_token', 
  'governance', 'stablecoin', 'nft'
));

-- ============================================
-- 4. UPDATE ALL RPC FUNCTIONS TO USE TEXT
-- ============================================

-- Drop all existing functions that use enum parameters
DROP FUNCTION IF EXISTS get_transactions_paginated;
DROP FUNCTION IF EXISTS bulk_insert_transactions;
DROP FUNCTION IF EXISTS upsert_transaction;

-- Recreate get_transactions_paginated with TEXT parameters
CREATE OR REPLACE FUNCTION get_transactions_paginated(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0,
  p_action TEXT DEFAULT NULL,          -- Changed from transaction_action to TEXT
  p_protocol TEXT DEFAULT NULL,        -- Changed from protocol to TEXT
  p_from_date TIMESTAMPTZ DEFAULT NULL,
  p_to_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  transaction_id TEXT,
  wallet_address TEXT,
  tx_hash TEXT,
  block_height INTEGER,
  tx_timestamp TIMESTAMPTZ,
  tx_action TEXT,                      -- Changed from transaction_action to TEXT
  tx_protocol TEXT,                    -- Changed from protocol to TEXT
  description TEXT,
  net_ada_change BIGINT,
  fees BIGINT,
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
    wt.tx_action,                      -- Now TEXT, no casting needed
    wt.tx_protocol,                    -- Now TEXT, no casting needed
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
    -- Simple TEXT comparisons, no casting needed
    AND (p_action IS NULL OR wt.tx_action = p_action)
    AND (p_protocol IS NULL OR wt.tx_protocol = p_protocol)
    AND (p_from_date IS NULL OR wt.tx_timestamp >= p_from_date)
    AND (p_to_date IS NULL OR wt.tx_timestamp <= p_to_date)
  GROUP BY wt.id, wt.wallet_address, wt.tx_hash, wt.block_height, 
           wt.tx_timestamp, wt.tx_action, wt.tx_protocol, wt.description,
           wt.net_ada_change, wt.fees
  ORDER BY wt.tx_timestamp DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate bulk_insert_transactions with TEXT handling
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
    
    -- Insert transaction - NO MORE ENUM CASTING NEEDED
    v_transaction_id := v_tx->>'id';
    
    INSERT INTO wallet_transactions (
      id, user_id, wallet_address, tx_hash, block_height,
      tx_timestamp, tx_action, tx_protocol, description,
      net_ada_change, fees
    ) VALUES (
      v_transaction_id,
      (v_tx->>'user_id')::UUID,
      v_tx->>'wallet_address',
      v_tx->>'tx_hash',
      (v_tx->>'block_height')::INTEGER,
      (v_tx->>'tx_timestamp')::TIMESTAMPTZ,
      v_tx->>'tx_action',                -- Direct TEXT, no casting
      v_tx->>'tx_protocol',              -- Direct TEXT, no casting
      v_tx->>'description',
      (v_tx->>'net_ada_change')::BIGINT,
      (v_tx->>'fees')::BIGINT
    );
    
    -- Insert asset flows if present
    IF v_tx ? 'asset_flows' THEN
      FOR v_flow IN SELECT * FROM jsonb_array_elements(v_tx->'asset_flows')
      LOOP
        INSERT INTO asset_flows (
          transaction_id, token_unit, net_change, in_flow, out_flow
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
GRANT EXECUTE ON FUNCTION get_transactions_paginated TO service_role;
GRANT EXECUTE ON FUNCTION bulk_insert_transactions TO service_role;

-- ============================================
-- 5. UPDATE INDEXES FOR TEXT COLUMNS
-- ============================================
-- Recreate indexes that might have been dropped with enum conversion
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_tx_action ON wallet_transactions (tx_action);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_tx_protocol ON wallet_transactions (tx_protocol) WHERE tx_protocol IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tokens_category ON tokens (category);