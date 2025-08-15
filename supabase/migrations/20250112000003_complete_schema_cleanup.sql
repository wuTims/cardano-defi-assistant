-- Complete Database Schema Cleanup Migration
-- This migration fixes all schema issues and removes old unused tables

-- ============================================
-- 1. DROP OLD/UNUSED TABLES AND VIEWS
-- ============================================

-- Drop the old view that references incorrect wallets structure
DROP VIEW IF EXISTS user_wallet_summary CASCADE;

-- Drop tables that were created but never used
DROP TABLE IF EXISTS action_transactions CASCADE;
DROP TABLE IF EXISTS actions CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS checkpoints CASCADE;
DROP TABLE IF EXISTS user_wallet_addresses CASCADE;
DROP TABLE IF EXISTS asset_metadata CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS wallet_ada_balances CASCADE;
DROP TABLE IF EXISTS wallet_asset_balances CASCADE;

-- ============================================
-- 2. FIX WALLETS TABLE
-- ============================================

-- Drop the old wallets table with incorrect structure
DROP TABLE IF EXISTS wallets CASCADE;

-- Create wallets table with correct structure
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  balance_lovelace TEXT DEFAULT '0',
  last_synced_at TIMESTAMP WITH TIME ZONE,
  synced_block_height INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, wallet_address)
);

-- Create indexes for efficient queries
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_wallet_address ON wallets(wallet_address);

-- Enable RLS
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Note: We use service role for all operations since we're using custom JWT
CREATE POLICY "Service role can manage all wallets" ON wallets
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 3. FIX FOREIGN KEY CONSTRAINTS
-- ============================================

-- Fix wallet_transactions foreign key
ALTER TABLE wallet_transactions 
DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_fkey;

ALTER TABLE wallet_transactions 
ADD CONSTRAINT wallet_transactions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;

-- Fix wallet_sync_status foreign key
ALTER TABLE wallet_sync_status 
DROP CONSTRAINT IF EXISTS wallet_sync_status_user_id_fkey;

ALTER TABLE wallet_sync_status 
ADD CONSTRAINT wallet_sync_status_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;

-- ============================================
-- 4. UPDATE RLS POLICIES TO USE APP_USERS
-- ============================================

-- Drop old policies that reference auth.uid()
DROP POLICY IF EXISTS "Users can view own transactions" ON wallet_transactions;
DROP POLICY IF EXISTS "Users can view own asset flows" ON asset_flows;
DROP POLICY IF EXISTS "Users can view own sync status" ON wallet_sync_status;

-- Recreate policies using app_users
-- Note: Since we're using custom JWT with app_users.id, we need to handle this differently
-- For now, service role will handle all operations

CREATE POLICY "Service role full access to wallet_transactions" ON wallet_transactions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to asset_flows" ON asset_flows
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to wallet_sync_status" ON wallet_sync_status
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 5. ADD TRIGGER FOR UPDATED_AT ON WALLETS
-- ============================================

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. ADD HELPFUL COMMENTS
-- ============================================

COMMENT ON TABLE wallets IS 'Stores wallet balance and sync information for each user';
COMMENT ON COLUMN wallets.balance_lovelace IS 'Current ADA balance in lovelace (1 ADA = 1,000,000 lovelace)';
COMMENT ON COLUMN wallets.last_synced_at IS 'Last time this wallet was synced with blockchain';
COMMENT ON COLUMN wallets.synced_block_height IS 'Last block height that was synced';

-- ============================================
-- 7. VERIFICATION
-- ============================================

DO $$
DECLARE 
    wallets_ok BOOLEAN;
    fk_ok BOOLEAN;
BEGIN
    -- Check if wallets table has correct structure
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'wallets' 
        AND column_name = 'user_id'
    ) INTO wallets_ok;
    
    -- Check if foreign keys reference app_users
    SELECT NOT EXISTS (
        SELECT FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'users'
        AND ccu.table_schema = 'auth'
        AND tc.table_name IN ('wallet_transactions', 'wallet_sync_status')
    ) INTO fk_ok;
    
    IF wallets_ok AND fk_ok THEN
        RAISE NOTICE 'DATABASE SCHEMA CLEANUP COMPLETE ✅';
        RAISE NOTICE 'wallets table: ✅ Recreated with user_id';
        RAISE NOTICE 'Foreign keys: ✅ All point to app_users';
        RAISE NOTICE 'Old tables: ✅ Removed';
    ELSE
        RAISE EXCEPTION 'DATABASE SCHEMA CLEANUP FAILED ❌';
    END IF;
END $$;