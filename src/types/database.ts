/**
 * Database Types
 * 
 * Central location for all database table structures, RPC return types,
 * and complex query result types. These types match the exact structure
 * of data returned from Supabase.
 * 
 * SOLID Principles:
 * - Single Responsibility: One source of truth for database types
 * - Open/Closed: Types can be extended without modification
 * - Interface Segregation: Focused types for specific needs
 * - Dependency Inversion: Depend on type abstractions
 */

import type { PostgrestError } from '@supabase/supabase-js';

// ============================================
// TABLE TYPES
// ============================================

/**
 * wallet_transactions table structure
 * Moved from: src/repositories/wallet-transaction-repository.ts
 * Note: Using tx_ prefix for PostgreSQL reserved keywords
 */
export type DatabaseTransaction = {
  id: string;
  user_id: string;
  wallet_address: string;
  tx_hash: string;
  block_height: number;
  tx_timestamp: string;    // ISO string from database
  tx_action: string;        // TEXT column (was transaction_action enum)
  tx_protocol?: string;     // TEXT column (was protocol enum)
  description: string;
  net_ada_change: string;   // BIGINT stored as string
  fees: string;             // BIGINT stored as string
  created_at?: string;
  updated_at?: string;
}

/**
 * asset_flows table structure
 * Moved from: src/repositories/wallet-transaction-repository.ts
 */
export type DatabaseAssetFlow = {
  id?: string;
  transaction_id: string;
  token_unit: string;
  net_change: string;       // BIGINT as string
  in_flow: string;          // BIGINT as string
  out_flow: string;         // BIGINT as string
}

/**
 * tokens table structure
 * Moved from: src/repositories/token-repository.ts
 */
export type DatabaseToken = {
  unit: string;
  policy_id: string;
  asset_name: string;
  name?: string;
  ticker?: string;
  decimals: number;
  category: string;         // TEXT column (was token_category enum)
  logo?: string;
  metadata?: any;           // JSONB
}

/**
 * sync_jobs table structure
 * Moved from: src/services/queue/supabase-queue-service.ts
 */
export type DatabaseSyncJob = {
  id: string;
  wallet_address: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  job_type: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  metadata: any;           // JSONB
  last_block_synced?: number;
}

/**
 * users table structure (app_users)
 */
export type DatabaseUser = {
  id: string;
  wallet_address: string;
  wallet_type: string;
  created_at: string;
  updated_at: string;
}

/**
 * wallets table structure
 * Note: Database uses wallet_address, not address
 */
export type DatabaseWallet = {
  id: string;
  user_id: string;
  wallet_address: string;  // Matches actual database column name
  balance_lovelace?: string;
  last_synced_at?: string;  // Corrected field name
  synced_block_height?: number;
  sync_in_progress?: boolean;
  sync_error?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * wallet_with_sync_status view structure
 * This view adds computed sync_status field
 */
export type WalletWithSyncStatus = DatabaseWallet & {
  last_synced_block: number;  // Alias for synced_block_height
  sync_status: 'never' | 'syncing' | 'stale' | 'fresh';
}

/**
 * Type for updating wallet sync status
 */
export type WalletSyncStatusUpdate = {
  synced_block_height?: number;
  last_synced_at?: string;
  sync_in_progress?: boolean;
  sync_error?: string | null;
  balance_lovelace?: string;
}

// ============================================
// RPC FUNCTION RETURN TYPES
// ============================================

/**
 * Return type for bulk_insert_transactions RPC
 * From: supabase/migrations/20250815000002_update_rpc_to_use_tx_prefix.sql
 */
export type BulkInsertResult = {
  inserted_count: number;
  skipped_count: number;
}

/**
 * Asset flow structure within RPC responses (JSONB format)
 * This matches the structure created by bulk_insert_transactions RPC
 * The RPC may include token data inline or require separate lookups
 */
export type RPCAssetFlow = {
  // Core asset flow data
  token_unit: string;
  net_change: string;       // BIGINT as string
  in_flow: string;          // BIGINT as string  
  out_flow: string;         // BIGINT as string
  
  // Token metadata (may be included from bulk insert or joins)
  policy_id?: string;
  asset_name?: string;
  name?: string;            // Token display name
  ticker?: string;          // Token ticker symbol
  decimals?: number;
  category?: string;        // TEXT column (was token_category enum)
  logo?: string;
  metadata?: any;           // Additional token metadata
}

/**
 * Return type for get_transactions_paginated RPC
 * From: supabase/migrations/20250113000001_fix_schema_and_add_queue.sql
 */
export type TransactionPaginatedRow = {
  transaction_id: string;
  wallet_address: string;
  tx_hash: string;
  block_height: number;
  tx_timestamp: string;
  tx_action: string;        // TEXT column (was transaction_action enum)
  tx_protocol?: string;     // TEXT column (was protocol enum)
  description: string;
  net_ada_change: string;
  fees: string;
  asset_flows: RPCAssetFlow[] | string | null;  // Can be array, JSON string, or null
}

// ============================================
// COMPLEX QUERY TYPES
// ============================================

/**
 * Transaction with joined asset flows and tokens
 * Used in findByTxHash queries
 */
export type DatabaseTransactionWithFlows = DatabaseTransaction & {
  asset_flows: (DatabaseAssetFlow & {
    tokens: DatabaseToken;
  })[];
}

/**
 * Partial types for specific column selections
 */
export type TransactionBlockHeight = Pick<DatabaseTransaction, 'block_height'>;
export type TokenUnit = Pick<DatabaseToken, 'unit'>;

// ============================================
// SUPABASE RESPONSE TYPES
// ============================================

/**
 * Generic Supabase response wrapper
 */
export type SupabaseResponse<T> = {
  data: T | null;
  error: PostgrestError | null;
}