-- Migration: Fix Security Issues and Consolidate Sync Status
-- Date: 2025-08-15
-- Purpose: 
--   1. Consolidate sync status from wallet_sync_status into wallets table
--   2. Remove redundant wallet_sync_status table
--   3. Remove unused cache_entries table
--   4. Fix security issues with views
--   5. Ensure RLS is enabled on all tables

-- ============================================
-- 1. PREPARE WALLETS TABLE
-- ============================================
-- Add missing columns to wallets table if not present
ALTER TABLE wallets 
ADD COLUMN IF NOT EXISTS sync_in_progress BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- Migrate data from wallet_sync_status to wallets table
UPDATE wallets w
SET 
  last_synced_at = wss.last_synced_at,
  synced_block_height = wss.last_synced_block,
  sync_in_progress = COALESCE(wss.sync_in_progress, false)
FROM wallet_sync_status wss
WHERE w.id = wss.wallet_id;

-- ============================================
-- 2. DROP OLD VIEWS AND TABLES
-- ============================================
-- Drop the view that depends on wallet_sync_status
DROP VIEW IF EXISTS wallet_with_sync_status CASCADE;

-- Drop the redundant wallet_sync_status table
DROP TABLE IF EXISTS wallet_sync_status CASCADE;

-- Drop the unused cache_entries table (we use InMemoryCache in code)
DROP TABLE IF EXISTS cache_entries CASCADE;

-- ============================================
-- 3. CREATE NEW VIEW (WITHOUT SECURITY DEFINER)
-- ============================================
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

-- ============================================
-- 4. UPDATE RPC FUNCTIONS
-- ============================================
-- Update get_wallet_with_sync function to use wallets table directly
CREATE OR REPLACE FUNCTION get_wallet_with_sync(p_wallet_address text)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  wallet_address text,
  balance_lovelace text,
  last_synced_at timestamptz,
  last_synced_block integer,
  sync_in_progress boolean,
  sync_status text,
  sync_error text,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id,
    w.user_id,
    w.wallet_address,
    w.balance_lovelace,
    w.last_synced_at,
    w.synced_block_height as last_synced_block,
    w.sync_in_progress,
    CASE
      WHEN w.last_synced_at IS NULL THEN 'never'::text
      WHEN w.sync_in_progress THEN 'syncing'::text
      WHEN w.last_synced_at < (now() - '01:00:00'::interval) THEN 'stale'::text
      ELSE 'fresh'::text
    END AS sync_status,
    w.sync_error,
    w.created_at,
    w.updated_at
  FROM wallets w
  WHERE w.wallet_address = p_wallet_address;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Update set_sync_status function to work with wallets table
CREATE OR REPLACE FUNCTION set_sync_status(
  p_wallet_address text,
  p_last_synced_block integer,
  p_sync_in_progress boolean
)
RETURNS void AS $$
BEGIN
  UPDATE wallets
  SET 
    synced_block_height = p_last_synced_block,
    sync_in_progress = p_sync_in_progress,
    last_synced_at = CASE 
      WHEN p_sync_in_progress = false THEN now() 
      ELSE last_synced_at 
    END,
    updated_at = now()
  WHERE wallet_address = p_wallet_address;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Grant permissions on functions
GRANT EXECUTE ON FUNCTION get_wallet_with_sync TO anon, authenticated;
GRANT EXECUTE ON FUNCTION set_sync_status TO anon, authenticated;

-- ============================================
-- 5. ENSURE RLS IS ENABLED ON ALL TABLES
-- ============================================
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_challenges ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. ADD UPDATED_AT TRIGGER
-- ============================================
-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to wallets table
DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
CREATE TRIGGER update_wallets_updated_at 
  BEFORE UPDATE ON wallets 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to wallet_transactions table
DROP TRIGGER IF EXISTS update_wallet_transactions_updated_at ON wallet_transactions;
CREATE TRIGGER update_wallet_transactions_updated_at 
  BEFORE UPDATE ON wallet_transactions 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_wallets_sync_status 
  ON wallets(wallet_address, sync_in_progress, last_synced_at);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id 
  ON wallets(user_id);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_address 
  ON wallet_transactions(wallet_address, block_height DESC);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_status 
  ON sync_jobs(status, created_at DESC);

-- ============================================
-- 8. VERIFY RLS POLICIES EXIST
-- ============================================
-- Note: RLS policies should already exist from previous migrations
-- This just ensures they are present

-- Wallets table policies
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'wallets' AND policyname = 'Users can view their own wallets'
  ) THEN
    CREATE POLICY "Users can view their own wallets" ON wallets
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'wallets' AND policyname = 'Users can update their own wallets'
  ) THEN
    CREATE POLICY "Users can update their own wallets" ON wallets
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================
-- 9. CLEANUP AND COMMENTS
-- ============================================
-- Add helpful comments
COMMENT ON TABLE wallets IS 'Consolidated wallet information including balance and sync status';
COMMENT ON COLUMN wallets.sync_in_progress IS 'Whether a sync operation is currently running for this wallet';
COMMENT ON COLUMN wallets.sync_error IS 'Last error message if sync failed';
COMMENT ON COLUMN wallets.synced_block_height IS 'Last block height that was successfully synced';
COMMENT ON VIEW wallet_with_sync_status IS 'View combining wallet data with computed sync status';

-- ============================================
-- 10. VERIFICATION QUERIES (Run these after migration)
-- ============================================
-- These are commented out but can be run to verify the migration:
/*
-- Check that wallet_sync_status table is gone
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'wallet_sync_status'
) as wallet_sync_status_exists;

-- Check that cache_entries table is gone  
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'cache_entries'
) as cache_entries_exists;

-- Check that RLS is enabled on all important tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('wallets', 'wallet_transactions', 'asset_flows', 'tokens', 'sync_jobs', 'app_users');

-- Check the new view works
SELECT * FROM wallet_with_sync_status LIMIT 1;

-- Check wallets table has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'wallets'
ORDER BY ordinal_position;
*/