-- SEED DATA FOR DEVELOPMENT AND TESTING
-- This file contains sample data for local development

-- =============================================================================
-- DEVELOPMENT SEED DATA
-- =============================================================================

-- Insert sample app user for testing
INSERT INTO app_users (wallet_addr, wallet_type, created_at, last_login_at) 
VALUES 
    ('addr1_test_sample_address_for_development_only', 'nami', NOW() - INTERVAL '7 days', NOW() - INTERVAL '1 hour')
ON CONFLICT (wallet_addr) DO NOTHING;

-- Insert sample wallet data
INSERT INTO wallets (address, balance_lovelace, last_synced_at, synced_block_height, first_seen, last_active)
VALUES 
    ('addr1_test_sample_address_for_development_only', '1000000000', NOW() - INTERVAL '1 hour', 12345678, NOW() - INTERVAL '7 days', NOW() - INTERVAL '1 hour')
ON CONFLICT (address) DO NOTHING;

-- Note: wallet_challenges should not have seed data as they are temporary and expire
-- Sample assets and UTXOs would go here if needed for testing

-- Verify seed data
SELECT 
    'SEED DATA LOADED' as status,
    COUNT(*) as user_count
FROM app_users;