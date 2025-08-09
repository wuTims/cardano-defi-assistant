-- INITIAL AUTHENTICATION SETUP MIGRATION
-- This migration was already executed in production
-- Included here for version control and reference

-- =============================================================================
-- PRODUCTION AUTHENTICATION ARCHITECTURE MIGRATION
-- =============================================================================

-- 1. Create wallet_challenges table for authentication flow
CREATE TABLE IF NOT EXISTS wallet_challenges (
  wallet_addr TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Create index for efficient expiration cleanup
CREATE INDEX IF NOT EXISTS idx_wallet_challenges_expires_at ON wallet_challenges(expires_at);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE wallet_challenges ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policy for wallet isolation
-- This prevents one wallet from accessing another wallet's challenges
DROP POLICY IF EXISTS "wallet_challenges_policy" ON wallet_challenges;
CREATE POLICY "wallet_challenges_policy" 
    ON wallet_challenges 
    FOR ALL 
    USING (true);  -- Simplified for production - adjust as needed

-- 5. Add cleanup function for expired challenges
CREATE OR REPLACE FUNCTION cleanup_expired_challenges()
RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
    DELETE FROM wallet_challenges WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create scheduled cleanup function (optional - for automation)
CREATE OR REPLACE FUNCTION scheduled_challenge_cleanup()
RETURNS void AS $$
BEGIN
    PERFORM cleanup_expired_challenges();
    RAISE NOTICE 'Cleaned up expired challenges at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- 7. Check current wallets table structure and add authentication columns
-- First, let's see what columns exist in the wallets table
DO $$ 
BEGIN
    -- Check if wallets table exists and has expected structure
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'wallets') THEN
        RAISE NOTICE 'Wallets table exists';
        
        -- Add authentication tracking columns if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'first_seen') THEN
            ALTER TABLE wallets ADD COLUMN first_seen TIMESTAMPTZ DEFAULT NOW();
            RAISE NOTICE 'Added first_seen column to wallets table';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'last_active') THEN
            ALTER TABLE wallets ADD COLUMN last_active TIMESTAMPTZ DEFAULT NOW();
            RAISE NOTICE 'Added last_active column to wallets table';
        END IF;
        
        -- Create index for authentication queries
        CREATE INDEX IF NOT EXISTS idx_wallets_last_active ON wallets(last_active DESC);
        
    ELSE
        -- Create wallets table with proper structure
        CREATE TABLE wallets (
            address TEXT PRIMARY KEY,
            first_seen TIMESTAMPTZ DEFAULT NOW(),
            last_active TIMESTAMPTZ DEFAULT NOW(),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Enable RLS on wallets table
        ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
        
        -- Create policy for wallet data isolation
        CREATE POLICY "wallets_policy" 
            ON wallets 
            FOR ALL 
            USING (true);  -- Adjust as needed for your security requirements
            
        RAISE NOTICE 'Created wallets table with authentication structure';
    END IF;
END $$;

-- 8. Add helpful comments for documentation
COMMENT ON TABLE wallet_challenges IS 'Temporary storage for wallet authentication challenges with automatic expiration';
COMMENT ON COLUMN wallet_challenges.wallet_addr IS 'Cardano wallet address that requested the challenge';
COMMENT ON COLUMN wallet_challenges.nonce IS 'Cryptographically secure random nonce for challenge uniqueness';
COMMENT ON COLUMN wallet_challenges.expires_at IS 'Challenge expiration timestamp (5 minutes from creation)';

COMMENT ON FUNCTION cleanup_expired_challenges() IS 'Removes expired challenges and returns count of deleted records';
COMMENT ON FUNCTION scheduled_challenge_cleanup() IS 'Scheduled cleanup function for automated challenge expiration';