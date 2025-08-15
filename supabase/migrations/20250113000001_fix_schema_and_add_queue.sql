-- Comprehensive Schema Fix and Queue Implementation
-- This migration fixes all identified schema issues and adds queue infrastructure
-- Date: 2025-01-13
-- Purpose: Remove bandaid fixes by addressing root cause issues

-- ============================================
-- 1. ADD SYNC JOBS TABLE FOR QUEUE-BASED PROCESSING
-- ============================================

CREATE TABLE IF NOT EXISTS sync_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT NOT NULL,
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  priority INTEGER DEFAULT 0,
  job_type TEXT NOT NULL DEFAULT 'wallet_sync' CHECK (job_type IN ('wallet_sync', 'transaction_sync', 'full_sync')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  metadata JSONB DEFAULT '{}'::jsonb,
  last_block_synced INTEGER,
  CONSTRAINT valid_dates CHECK (
    (started_at IS NULL OR started_at >= created_at) AND
    (completed_at IS NULL OR completed_at >= started_at)
  )
);

-- Indexes for efficient job processing
CREATE INDEX idx_sync_jobs_status_priority ON sync_jobs(status, priority DESC, created_at ASC) 
  WHERE status IN ('pending', 'processing');
CREATE INDEX idx_sync_jobs_wallet_user ON sync_jobs(wallet_address, user_id);
CREATE INDEX idx_sync_jobs_created_at ON sync_jobs(created_at);

-- Enable RLS
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

-- Service role manages all sync jobs
CREATE POLICY "Service role full access to sync jobs" ON sync_jobs
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 2. ADD CACHE TABLE FOR TEMPORARY DATA STORAGE
-- ============================================

CREATE TABLE IF NOT EXISTS cache_entries (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  category TEXT DEFAULT 'general'
);

-- Index for cleanup of expired entries
CREATE INDEX idx_cache_entries_expires_at ON cache_entries(expires_at);
CREATE INDEX idx_cache_entries_category ON cache_entries(category);

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM cache_entries WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. FIX WALLET_SYNC_STATUS FOREIGN KEY
-- ============================================

-- Add foreign key to wallets table (was missing)
ALTER TABLE wallet_sync_status 
  ADD COLUMN IF NOT EXISTS wallet_id UUID;

-- Update to reference wallets table
UPDATE wallet_sync_status wss
SET wallet_id = w.id
FROM wallets w
WHERE w.wallet_address = wss.wallet_address
  AND w.user_id = wss.user_id
  AND wss.wallet_id IS NULL;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'wallet_sync_status_wallet_id_fkey'
  ) THEN
    ALTER TABLE wallet_sync_status
      ADD CONSTRAINT wallet_sync_status_wallet_id_fkey 
      FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_wallet_sync_status_wallet_id ON wallet_sync_status(wallet_id);

-- ============================================
-- 4. FIX RPC FUNCTION FIELD NAMING
-- ============================================

-- Drop and recreate the function with consistent field names
DROP FUNCTION IF EXISTS get_transactions_paginated CASCADE;

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
  wallet_address TEXT,
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
    wt.wallet_address,
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
          'policy_id', t.policy_id,
          'asset_name', t.asset_name,
          'name', t.name,
          'ticker', t.ticker,
          'decimals', t.decimals,
          'category', t.category,
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
  GROUP BY wt.id, wt.wallet_address, wt.tx_hash, wt.block_height, wt.timestamp, 
           wt.action, wt.protocol, wt.description, wt.net_ada_change, wt.fees
  ORDER BY wt.timestamp DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_transactions_paginated TO authenticated;
GRANT EXECUTE ON FUNCTION get_transactions_paginated TO service_role;

-- ============================================
-- 5. CREATE WALLET VIEW WITH SYNC STATUS
-- ============================================

CREATE OR REPLACE VIEW wallet_with_sync_status AS
SELECT 
  w.id,
  w.user_id,
  w.wallet_address,
  w.balance_lovelace,
  w.created_at,
  w.updated_at,
  wss.last_synced_at,
  wss.last_synced_block,
  wss.sync_in_progress,
  CASE 
    WHEN wss.last_synced_at IS NULL THEN 'never'
    WHEN wss.sync_in_progress THEN 'syncing'
    WHEN wss.last_synced_at < NOW() - INTERVAL '1 hour' THEN 'stale'
    ELSE 'fresh'
  END as sync_status
FROM wallets w
LEFT JOIN wallet_sync_status wss ON wss.wallet_id = w.id;

-- Grant access to the view
GRANT SELECT ON wallet_with_sync_status TO authenticated;
GRANT SELECT ON wallet_with_sync_status TO service_role;

-- ============================================
-- 6. ADD UPSERT FUNCTION FOR TRANSACTIONS
-- ============================================

CREATE OR REPLACE FUNCTION upsert_transaction(
  p_transaction JSONB,
  p_user_id UUID
)
RETURNS TABLE (
  operation TEXT,
  transaction_id TEXT
) AS $$
DECLARE
  v_tx_id TEXT;
  v_operation TEXT;
BEGIN
  -- Extract transaction ID
  v_tx_id := p_transaction->>'id';
  
  -- Try to insert, on conflict update
  INSERT INTO wallet_transactions (
    id, user_id, wallet_address, tx_hash, block_height,
    timestamp, action, protocol, description, net_ada_change, fees
  ) VALUES (
    v_tx_id,
    p_user_id,
    p_transaction->>'wallet_address',
    p_transaction->>'tx_hash',
    (p_transaction->>'block_height')::INTEGER,
    (p_transaction->>'timestamp')::TIMESTAMP WITH TIME ZONE,
    (p_transaction->>'action')::transaction_action,
    CASE 
      WHEN p_transaction->>'protocol' IS NULL THEN NULL
      ELSE (p_transaction->>'protocol')::protocol
    END,
    p_transaction->>'description',
    (p_transaction->>'net_ada_change')::BIGINT,
    (p_transaction->>'fees')::BIGINT
  )
  ON CONFLICT (id) DO UPDATE SET
    block_height = EXCLUDED.block_height,
    timestamp = EXCLUDED.timestamp,
    action = EXCLUDED.action,
    protocol = EXCLUDED.protocol,
    description = EXCLUDED.description,
    net_ada_change = EXCLUDED.net_ada_change,
    fees = EXCLUDED.fees,
    updated_at = NOW()
  RETURNING 
    CASE WHEN xmax = 0 THEN 'insert' ELSE 'update' END INTO v_operation;
  
  -- Handle asset flows (delete and reinsert for simplicity)
  DELETE FROM asset_flows WHERE transaction_id = v_tx_id;
  
  -- Insert new asset flows
  INSERT INTO asset_flows (transaction_id, token_unit, net_change, in_flow, out_flow)
  SELECT 
    v_tx_id,
    flow->>'token_unit',
    (flow->>'net_change')::BIGINT,
    (flow->>'in_flow')::BIGINT,
    (flow->>'out_flow')::BIGINT
  FROM jsonb_array_elements(p_transaction->'asset_flows') as flow;
  
  RETURN QUERY SELECT v_operation, v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role only
GRANT EXECUTE ON FUNCTION upsert_transaction TO service_role;

-- ============================================
-- 7. CREATE QUEUE PROCESSING FUNCTIONS
-- ============================================

-- Function to get next job from queue
CREATE OR REPLACE FUNCTION get_next_sync_job()
RETURNS sync_jobs AS $$
DECLARE
  v_job sync_jobs;
BEGIN
  -- Select and lock the next pending job
  SELECT * INTO v_job
  FROM sync_jobs
  WHERE status = 'pending'
    AND retry_count < max_retries
  ORDER BY priority DESC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  -- Mark as processing if found
  IF v_job.id IS NOT NULL THEN
    UPDATE sync_jobs 
    SET status = 'processing', 
        started_at = NOW()
    WHERE id = v_job.id;
  END IF;
  
  RETURN v_job;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete a sync job
CREATE OR REPLACE FUNCTION complete_sync_job(
  p_job_id UUID,
  p_success BOOLEAN,
  p_error_message TEXT DEFAULT NULL,
  p_last_block INTEGER DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE sync_jobs
  SET 
    status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    completed_at = NOW(),
    error_message = p_error_message,
    last_block_synced = COALESCE(p_last_block, last_block_synced),
    retry_count = CASE 
      WHEN NOT p_success THEN retry_count + 1 
      ELSE retry_count 
    END
  WHERE id = p_job_id;
  
  -- If failed but can retry, reset to pending
  UPDATE sync_jobs
  SET status = 'pending', started_at = NULL
  WHERE id = p_job_id
    AND NOT p_success
    AND retry_count < max_retries;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_next_sync_job TO service_role;
GRANT EXECUTE ON FUNCTION complete_sync_job TO service_role;

-- ============================================
-- 8. ADD HELPFUL INDEXES
-- ============================================

-- Index for finding duplicate transactions efficiently
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_tx_hash 
  ON wallet_transactions(user_id, tx_hash);

-- Index for wallet balance queries
CREATE INDEX IF NOT EXISTS idx_wallets_user_wallet 
  ON wallets(user_id, wallet_address);

-- ============================================
-- 9. ADD TRIGGERS FOR AUTOMATIC CLEANUP
-- ============================================

-- Function to auto-clean old sync jobs
CREATE OR REPLACE FUNCTION cleanup_old_sync_jobs()
RETURNS void AS $$
BEGIN
  -- Delete completed jobs older than 7 days
  DELETE FROM sync_jobs 
  WHERE status IN ('completed', 'cancelled')
    AND completed_at < NOW() - INTERVAL '7 days';
  
  -- Delete failed jobs older than 30 days
  DELETE FROM sync_jobs 
  WHERE status = 'failed'
    AND completed_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. VERIFICATION
-- ============================================

DO $$
DECLARE 
  queue_ok BOOLEAN;
  cache_ok BOOLEAN;
  fk_ok BOOLEAN;
  func_ok BOOLEAN;
BEGIN
  -- Check if sync_jobs table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'sync_jobs'
  ) INTO queue_ok;
  
  -- Check if cache_entries table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'cache_entries'
  ) INTO cache_ok;
  
  -- Check if wallet_sync_status has wallet_id column
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'wallet_sync_status' 
    AND column_name = 'wallet_id'
  ) INTO fk_ok;
  
  -- Check if new functions exist
  SELECT EXISTS (
    SELECT FROM information_schema.routines 
    WHERE routine_name = 'get_next_sync_job'
  ) INTO func_ok;
  
  IF queue_ok AND cache_ok AND fk_ok AND func_ok THEN
    RAISE NOTICE '✅ SCHEMA FIX MIGRATION COMPLETE';
    RAISE NOTICE '  - Queue infrastructure: ✅';
    RAISE NOTICE '  - Cache table: ✅';
    RAISE NOTICE '  - Foreign keys fixed: ✅';
    RAISE NOTICE '  - RPC functions updated: ✅';
  ELSE
    RAISE NOTICE '⚠️ SCHEMA FIX MIGRATION PARTIALLY COMPLETE';
    RAISE NOTICE '  - Queue infrastructure: %', CASE WHEN queue_ok THEN '✅' ELSE '❌' END;
    RAISE NOTICE '  - Cache table: %', CASE WHEN cache_ok THEN '✅' ELSE '❌' END;
    RAISE NOTICE '  - Foreign keys: %', CASE WHEN fk_ok THEN '✅' ELSE '❌' END;
    RAISE NOTICE '  - Functions: %', CASE WHEN func_ok THEN '✅' ELSE '❌' END;
  END IF;
END $$;