-- Migration Script: Supabase to Prisma Schema
-- Run this BEFORE prisma db push to backup and rename old tables
-- This prevents conflicts and preserves data

-- 1. Backup existing tables with _old suffix
-- Only if they exist (won't error if they don't)

-- Backup wallet_transactions if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_transactions') THEN
    ALTER TABLE wallet_transactions RENAME TO wallet_transactions_old;
    RAISE NOTICE 'Renamed wallet_transactions to wallet_transactions_old';
  END IF;
END $$;

-- Backup asset_flows if it exists  
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'asset_flows') THEN
    ALTER TABLE asset_flows RENAME TO asset_flows_old;
    RAISE NOTICE 'Renamed asset_flows to asset_flows_old';
  END IF;
END $$;

-- Backup tokens if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tokens') THEN
    ALTER TABLE tokens RENAME TO tokens_old;
    RAISE NOTICE 'Renamed tokens to tokens_old';
  END IF;
END $$;

-- Backup sync_jobs if it exists (might be from old queue system)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sync_jobs') THEN
    ALTER TABLE sync_jobs RENAME TO sync_jobs_old;
    RAISE NOTICE 'Renamed sync_jobs to sync_jobs_old';
  END IF;
END $$;

-- 2. Drop old RPC functions that won't be needed anymore
DROP FUNCTION IF EXISTS bulk_insert_transactions CASCADE;
DROP FUNCTION IF EXISTS calculate_wallet_balance CASCADE;
DROP FUNCTION IF EXISTS get_transactions_paginated CASCADE;
DROP FUNCTION IF EXISTS get_next_sync_job CASCADE;
DROP FUNCTION IF EXISTS complete_sync_job CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_sync_jobs CASCADE;

-- 3. After running this script:
-- Run: npx prisma db push
-- This will create the new schema without conflicts

-- 4. Optional: Data migration (run after schema is created)
-- We can write a separate script to migrate data from *_old tables to new tables
-- This would handle the different column naming conventions