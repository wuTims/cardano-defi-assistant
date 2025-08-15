-- Fix foreign key constraints to reference app_users instead of auth.users

-- Fix wallet_transactions table
ALTER TABLE wallet_transactions 
DROP CONSTRAINT wallet_transactions_user_id_fkey;

ALTER TABLE wallet_transactions 
ADD CONSTRAINT wallet_transactions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;

-- Fix wallet_sync_status table
ALTER TABLE wallet_sync_status 
DROP CONSTRAINT wallet_sync_status_user_id_fkey;

ALTER TABLE wallet_sync_status 
ADD CONSTRAINT wallet_sync_status_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;