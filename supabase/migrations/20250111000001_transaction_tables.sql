-- Transaction Tables Migration
-- Creates tables for wallet transaction storage with token metadata
-- 
-- Security Model:
-- - Service key (backend) handles all WRITES during sync
-- - RLS policies protect READS - users only see their own data
-- - No direct user writes allowed

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types for transaction data
CREATE TYPE transaction_action AS ENUM (
  'receive',
  'send',
  'swap',
  'provide_liquidity',
  'remove_liquidity',
  'stake',
  'unstake',
  'claim_rewards',
  'supply',
  'withdraw',
  'borrow',
  'repay',
  'lend',
  'collateralize',
  'unknown'
);

CREATE TYPE token_category AS ENUM (
  'native',
  'fungible',
  'lp_token',
  'q_token',
  'governance',
  'stablecoin',
  'nft'
);

CREATE TYPE protocol AS ENUM (
  'minswap',
  'liqwid',
  'sundaeswap',
  'wingriders',
  'indigo',
  'djed',
  'unknown'
);

-- Token metadata table (public read, service write)
CREATE TABLE tokens (
  unit TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  name TEXT,
  ticker TEXT,
  decimals INTEGER DEFAULT 0,
  category token_category NOT NULL DEFAULT 'fungible',
  logo TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for efficient queries
CREATE INDEX idx_tokens_policy_id ON tokens (policy_id);
CREATE INDEX idx_tokens_category ON tokens (category);
CREATE INDEX idx_tokens_ticker ON tokens (ticker) WHERE ticker IS NOT NULL;

-- Wallet transactions table
CREATE TABLE wallet_transactions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  block_height INTEGER NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  action transaction_action NOT NULL,
  protocol protocol,
  description TEXT NOT NULL,
  net_ada_change BIGINT NOT NULL,
  fees BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint to prevent duplicates per user
CREATE UNIQUE INDEX idx_wallet_transactions_user_tx ON wallet_transactions (user_id, tx_hash);

-- Indexes for efficient queries
CREATE INDEX idx_wallet_transactions_user_id ON wallet_transactions (user_id);
CREATE INDEX idx_wallet_transactions_wallet_address ON wallet_transactions (wallet_address);
CREATE INDEX idx_wallet_transactions_timestamp ON wallet_transactions (timestamp);
CREATE INDEX idx_wallet_transactions_action ON wallet_transactions (action);
CREATE INDEX idx_wallet_transactions_protocol ON wallet_transactions (protocol) WHERE protocol IS NOT NULL;
CREATE INDEX idx_wallet_transactions_block_height ON wallet_transactions (block_height);

-- Asset flows table (tracks token movements per transaction)
CREATE TABLE asset_flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id TEXT NOT NULL REFERENCES wallet_transactions(id) ON DELETE CASCADE,
  token_unit TEXT NOT NULL REFERENCES tokens(unit),
  net_change BIGINT NOT NULL,
  in_flow BIGINT NOT NULL DEFAULT 0,
  out_flow BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for asset flows
CREATE INDEX idx_asset_flows_transaction_id ON asset_flows (transaction_id);
CREATE INDEX idx_asset_flows_token_unit ON asset_flows (token_unit);
CREATE INDEX idx_asset_flows_net_change ON asset_flows (net_change);

-- User wallet addresses table (track which addresses belong to which user)
CREATE TABLE user_wallet_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint for user-address pairs
CREATE UNIQUE INDEX idx_user_wallet_addresses_unique ON user_wallet_addresses (user_id, wallet_address);
CREATE INDEX idx_user_wallet_addresses_primary ON user_wallet_addresses (user_id, is_primary) WHERE is_primary = TRUE;

-- Sync status table (track sync progress per wallet)
CREATE TABLE wallet_sync_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  last_synced_block INTEGER,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_in_progress BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint for user-wallet sync status
CREATE UNIQUE INDEX idx_wallet_sync_status_unique ON wallet_sync_status (user_id, wallet_address);

-- Update timestamps trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_tokens_updated_at BEFORE UPDATE ON tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallet_transactions_updated_at BEFORE UPDATE ON wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallet_sync_status_updated_at BEFORE UPDATE ON wallet_sync_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on tables
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wallet_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;

-- TOKENS TABLE: Public read, no user writes
-- Anyone can read token metadata (it's public data)
CREATE POLICY "Public read access to tokens"
  ON tokens FOR SELECT
  USING (true);

-- Service role can manage tokens
CREATE POLICY "Service role full access to tokens"
  ON tokens FOR ALL
  USING (auth.role() = 'service_role');

-- WALLET_TRANSACTIONS TABLE: Users read their own only
CREATE POLICY "Users can view own transactions"
  ON wallet_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all transactions
CREATE POLICY "Service role full access to transactions"
  ON wallet_transactions FOR ALL
  USING (auth.role() = 'service_role');

-- ASSET_FLOWS TABLE: Users read flows for their transactions
CREATE POLICY "Users can view own asset flows"
  ON asset_flows FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM wallet_transactions 
      WHERE wallet_transactions.id = asset_flows.transaction_id 
      AND wallet_transactions.user_id = auth.uid()
    )
  );

-- Service role can manage all flows
CREATE POLICY "Service role full access to asset flows"
  ON asset_flows FOR ALL
  USING (auth.role() = 'service_role');

-- USER_WALLET_ADDRESSES TABLE: Users read/write their own
CREATE POLICY "Users can manage own wallet addresses"
  ON user_wallet_addresses FOR ALL
  USING (auth.uid() = user_id);

-- Service role can manage all addresses
CREATE POLICY "Service role full access to wallet addresses"
  ON user_wallet_addresses FOR ALL
  USING (auth.role() = 'service_role');

-- WALLET_SYNC_STATUS TABLE: Users read their own status
CREATE POLICY "Users can view own sync status"
  ON wallet_sync_status FOR SELECT
  USING (auth.uid() = user_id);

-- Service role manages sync status
CREATE POLICY "Service role full access to sync status"
  ON wallet_sync_status FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Insert ADA token by default
INSERT INTO tokens (unit, policy_id, asset_name, name, ticker, decimals, category, logo, metadata) VALUES (
  'lovelace',
  '',
  '',
  'Cardano',
  'ADA',
  6,
  'native',
  'https://cryptologos.cc/logos/cardano-ada-logo.png',
  '{"native": true, "official": true}'::jsonb
) ON CONFLICT (unit) DO NOTHING;

-- Insert known qADA token
INSERT INTO tokens (unit, policy_id, asset_name, name, ticker, decimals, category, metadata) VALUES (
  'a04ce7a52545e5e33c2867e148898d9e667a69602285f6a1298f9d68',
  'a04ce7a52545e5e33c2867e148898d9e667a69602285f6a1298f9d68',
  '',
  'qADA',
  'qADA',
  0,
  'q_token',
  '{"protocol": "Liqwid", "description": "Interest-bearing ADA supplied to Liqwid"}'::jsonb
) ON CONFLICT (unit) DO NOTHING;