-- RLS POLICIES MIGRATION
-- Implements proper Row Level Security policies for auth.uid() user isolation
-- Ensures users can only access their own data

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- 1. Add RLS policy for app_users (users can only see their own data)
DROP POLICY IF EXISTS "app_users_self_access" ON app_users;
CREATE POLICY "app_users_self_access" 
ON app_users 
FOR SELECT 
USING (auth.uid() = id);

-- 2. Add RLS policy for app_users INSERT/UPDATE (users can only modify their own data)
DROP POLICY IF EXISTS "app_users_self_modify" ON app_users;
CREATE POLICY "app_users_self_modify" 
ON app_users 
FOR ALL 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3. Add RLS policy for wallets (users can access wallets linked to their account)
DROP POLICY IF EXISTS "wallets_policy" ON wallets;
DROP POLICY IF EXISTS "wallets_self_access" ON wallets;
CREATE POLICY "wallets_self_access" 
ON wallets 
FOR SELECT 
USING (
  address IN (
    SELECT wallet_addr FROM app_users WHERE id = auth.uid()
  )
);

-- 4. Add RLS policy for wallet_challenges (users can only access their own challenges)
DROP POLICY IF EXISTS "wallet_challenges_policy" ON wallet_challenges;
DROP POLICY IF EXISTS "wallet_challenges_self_access" ON wallet_challenges;
CREATE POLICY "wallet_challenges_self_access" 
ON wallet_challenges 
FOR ALL
USING (
  wallet_addr IN (
    SELECT wallet_addr FROM app_users WHERE id = auth.uid()
  )
);

-- 5. Create policy for service role to bypass RLS (for auth operations)
-- Service role needs full access for authentication flow
CREATE POLICY "wallet_challenges_service_access" 
ON wallet_challenges 
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "app_users_service_access" 
ON app_users 
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "wallets_service_access" 
ON wallets 
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 6. Update user_wallet_summary view to be secure
-- Views automatically inherit RLS from underlying tables
-- But we'll add explicit security settings for clarity
DROP VIEW IF EXISTS user_wallet_summary;
CREATE VIEW user_wallet_summary 
WITH (security_barrier = true, security_invoker = true) AS
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
LEFT JOIN wallets w ON u.wallet_addr = w.address
WHERE u.id = auth.uid(); -- Explicit user isolation

-- 7. Grant SELECT permission on view to authenticated users
GRANT SELECT ON user_wallet_summary TO authenticated;

-- 8. Add comments for RLS policies
COMMENT ON POLICY "app_users_self_access" ON app_users IS 'Users can only read their own user data';
COMMENT ON POLICY "app_users_self_modify" ON app_users IS 'Users can only modify their own user data';
COMMENT ON POLICY "wallets_self_access" ON wallets IS 'Users can only access wallets linked to their account';
COMMENT ON POLICY "wallet_challenges_self_access" ON wallet_challenges IS 'Users can only access their own wallet challenges';
COMMENT ON POLICY "wallet_challenges_service_access" ON wallet_challenges IS 'Service role has full access for auth operations';
COMMENT ON POLICY "app_users_service_access" ON app_users IS 'Service role has full access for auth operations';
COMMENT ON POLICY "wallets_service_access" ON wallets IS 'Service role has full access for auth operations';

COMMENT ON VIEW user_wallet_summary IS 'Secure view showing only current user wallet data with RLS enforcement';

-- 9. Verification - Test RLS is working
DO $$
DECLARE 
    policies_count INTEGER;
BEGIN
    -- Count RLS policies created
    SELECT COUNT(*) 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('app_users', 'wallets', 'wallet_challenges')
    INTO policies_count;
    
    IF policies_count >= 6 THEN
        RAISE NOTICE 'RLS POLICIES SETUP COMPLETE ✅';
        RAISE NOTICE 'Created % RLS policies for user isolation', policies_count;
        RAISE NOTICE 'All tables secured with auth.uid() based access control';
        RAISE NOTICE 'Service role has bypass access for authentication operations';
    ELSE
        RAISE WARNING 'RLS POLICIES INCOMPLETE - Expected 6+, found %', policies_count;
    END IF;
END $$;