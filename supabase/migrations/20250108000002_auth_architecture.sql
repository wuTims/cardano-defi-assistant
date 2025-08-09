-- AUTH ARCHITECTURE ENHANCEMENT MIGRATION
-- Implements proper UUID-based user system and enhanced challenge storage
-- Aligns with auth-implementation.md requirements

-- =============================================================================
-- ENHANCED AUTHENTICATION ARCHITECTURE
-- =============================================================================

-- 1. Create app_users table with UUID pattern (recommended by implementation doc)
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_addr TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ DEFAULT NOW(),
  -- Optional metadata fields
  wallet_type TEXT,
  first_seen TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes for efficient user lookups
CREATE INDEX IF NOT EXISTS idx_app_users_wallet_addr ON app_users(wallet_addr);
CREATE INDEX IF NOT EXISTS idx_app_users_last_login ON app_users(last_login_at DESC);

-- 3. Enable Row Level Security on app_users
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- 4. Enhance wallet_challenges table to store exact challenge string
-- Add new columns for proper challenge-response pattern
DO $$
BEGIN
    -- Add challenge column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_challenges' AND column_name = 'challenge') THEN
        ALTER TABLE wallet_challenges ADD COLUMN challenge TEXT NOT NULL DEFAULT '';
        RAISE NOTICE 'Added challenge column to wallet_challenges table';
    END IF;

    -- Add used tracking columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_challenges' AND column_name = 'used') THEN
        ALTER TABLE wallet_challenges ADD COLUMN used BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added used column to wallet_challenges table';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_challenges' AND column_name = 'used_at') THEN
        ALTER TABLE wallet_challenges ADD COLUMN used_at TIMESTAMPTZ;
        RAISE NOTICE 'Added used_at column to wallet_challenges table';
    END IF;

    -- Add issued_at column for better tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_challenges' AND column_name = 'issued_at') THEN
        ALTER TABLE wallet_challenges ADD COLUMN issued_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added issued_at column to wallet_challenges table';
    END IF;
END $$;

-- 5. Create unique index for nonce replay protection
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_challenges_addr_nonce 
ON wallet_challenges(wallet_addr, nonce);

-- 6. Create index for efficient cleanup of used challenges
CREATE INDEX IF NOT EXISTS idx_wallet_challenges_used_expires 
ON wallet_challenges(used, expires_at);

-- 7. Update challenge cleanup function to handle used challenges
CREATE OR REPLACE FUNCTION cleanup_expired_challenges()
RETURNS INTEGER AS $$
DECLARE 
    deleted_count INTEGER;
    used_count INTEGER;
    expired_count INTEGER;
BEGIN
    -- Clean up used challenges older than 1 hour
    DELETE FROM wallet_challenges 
    WHERE used = TRUE AND used_at < NOW() - INTERVAL '1 hour';
    GET DIAGNOSTICS used_count = ROW_COUNT;
    
    -- Clean up expired unused challenges
    DELETE FROM wallet_challenges 
    WHERE used = FALSE AND expires_at < NOW();
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    deleted_count := used_count + expired_count;
    
    RAISE NOTICE 'Cleaned up % used challenges and % expired challenges', used_count, expired_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create function to get or create app user
CREATE OR REPLACE FUNCTION upsert_app_user(
    p_wallet_addr TEXT,
    p_wallet_type TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    user_uuid UUID;
BEGIN
    INSERT INTO app_users (wallet_addr, wallet_type, last_login_at)
    VALUES (p_wallet_addr, p_wallet_type, NOW())
    ON CONFLICT (wallet_addr) 
    DO UPDATE SET 
        last_login_at = NOW(),
        wallet_type = COALESCE(EXCLUDED.wallet_type, app_users.wallet_type)
    RETURNING id INTO user_uuid;
    
    RETURN user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create function to mark challenge as used
CREATE OR REPLACE FUNCTION mark_challenge_used(
    p_wallet_addr TEXT,
    p_nonce TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE wallet_challenges 
    SET used = TRUE, used_at = NOW()
    WHERE wallet_addr = p_wallet_addr 
      AND nonce = p_nonce 
      AND used = FALSE 
      AND expires_at > NOW();
    
    IF FOUND THEN
        RAISE NOTICE 'Challenge marked as used for wallet: %', p_wallet_addr;
        RETURN TRUE;
    ELSE
        RAISE WARNING 'Invalid or expired challenge for wallet: %', p_wallet_addr;
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Add comments for new structures
COMMENT ON TABLE app_users IS 'Application users identified by UUID with wallet address mapping';
COMMENT ON COLUMN app_users.id IS 'Unique user identifier for RLS and foreign key references';
COMMENT ON COLUMN app_users.wallet_addr IS 'Cardano wallet address (bech32 format)';
COMMENT ON COLUMN app_users.created_at IS 'When the user first authenticated';
COMMENT ON COLUMN app_users.last_login_at IS 'Most recent successful authentication';
COMMENT ON COLUMN app_users.wallet_type IS 'Type of wallet used (nami, eternl, etc.)';

COMMENT ON COLUMN wallet_challenges.challenge IS 'Exact challenge string for signature verification';
COMMENT ON COLUMN wallet_challenges.used IS 'Whether this challenge has been consumed';
COMMENT ON COLUMN wallet_challenges.used_at IS 'When the challenge was marked as used';
COMMENT ON COLUMN wallet_challenges.issued_at IS 'When the challenge was generated';

COMMENT ON FUNCTION upsert_app_user(TEXT, TEXT) IS 'Creates or updates app user and returns UUID';
COMMENT ON FUNCTION mark_challenge_used(TEXT, TEXT) IS 'Marks challenge as used and returns success status';

-- 11. Create view for user wallet data (for convenience)
CREATE OR REPLACE VIEW user_wallet_summary AS
SELECT 
    u.id as user_id,
    u.wallet_addr,
    u.wallet_type,
    u.created_at as user_created_at,
    u.last_login_at,
    w.address as wallet_address,
    w.first_seen as wallet_first_seen,
    w.last_active as wallet_last_active,
    w.created_at as wallet_created_at
FROM app_users u
LEFT JOIN wallets w ON u.wallet_addr = w.address;

COMMENT ON VIEW user_wallet_summary IS 'Combined view of user and wallet data for easy querying';

-- 12. Grant necessary permissions for service role
-- These are needed for the auth service to manage users and challenges
GRANT SELECT, INSERT, UPDATE, DELETE ON app_users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON wallet_challenges TO service_role;
GRANT EXECUTE ON FUNCTION upsert_app_user(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION mark_challenge_used(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_challenges() TO service_role;

-- 13. Verification query - ensure setup is correct
DO $$
DECLARE 
    users_table_exists BOOLEAN;
    challenges_enhanced BOOLEAN;
BEGIN
    -- Check if app_users table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'app_users'
    ) INTO users_table_exists;
    
    -- Check if wallet_challenges has challenge column
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'wallet_challenges' AND column_name = 'challenge'
    ) INTO challenges_enhanced;
    
    IF users_table_exists AND challenges_enhanced THEN
        RAISE NOTICE 'AUTH ARCHITECTURE SETUP COMPLETE ✅';
        RAISE NOTICE 'app_users table: ✅ Created with UUID pattern';
        RAISE NOTICE 'wallet_challenges table: ✅ Enhanced with exact challenge storage';
        RAISE NOTICE 'Database ready for Supabase JWT + RLS authentication system';
    ELSE
        RAISE EXCEPTION 'AUTH ARCHITECTURE SETUP FAILED ❌';
    END IF;
END $$;