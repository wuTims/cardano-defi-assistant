/**
 * API DTOs and Business Result Types
 * 
 * Contains only:
 * - API response DTOs (for serialization of BigInts, Dates, etc.)
 * - Business operation results (not stored in DB)
 * - Computed/derived types (business logic, not DB entities)
 * 
 * Does NOT contain:
 * - Entity definitions (use Prisma types: User, Wallet, Transaction, etc.)
 * - Database column mappings (Prisma handles this)
 * - Tech-specific types (no Supabase/Prisma specifics)
 */

import type { TokenInfo } from './transaction';

// ============================================
// API RESPONSE DTOs (Serialization Layer)
// ============================================

/**
 * Transaction response DTO for API endpoints
 * Serializes BigInts to strings, Dates to ISO strings
 */
export interface TransactionResponse {
  readonly id: string;
  readonly txHash: string;
  readonly walletAddress: string;
  readonly blockHeight: number;
  readonly timestamp: string;        // ISO string (serialized Date)
  readonly action: string;           // TransactionAction value
  readonly protocol: string | null;  // Protocol value
  readonly netAdaChange: string;     // Serialized BigInt
  readonly fees: string;             // Serialized BigInt
  readonly description: string;
  readonly assetFlows: AssetFlowResponse[];
}

/**
 * Asset flow response DTO for API endpoints
 */
export interface AssetFlowResponse {
  readonly unit: string;
  readonly inFlow: string;           // Serialized BigInt
  readonly outFlow: string;          // Serialized BigInt
  readonly netChange: string;        // Serialized BigInt
  readonly token: TokenInfo | null;
}

/**
 * Wallet response DTO for API endpoints
 */
export interface WalletResponse {
  readonly id: string;
  readonly address: string;
  readonly lastSyncedAt: string | null;  // ISO string
  readonly syncedBlockHeight: number;
  readonly syncStatus: SyncStatus;
  readonly isHealthy: boolean;
}

/**
 * Sync job response DTO for API endpoints
 */
export interface JobResponse {
  readonly id: string;
  readonly walletAddress: string;
  readonly status: JobStatus;
  readonly createdAt: string;         // ISO string
  readonly startedAt: string | null;  // ISO string
  readonly completedAt: string | null; // ISO string
  readonly errorMessage: string | null;
}

// ============================================
// BUSINESS OPERATION RESULTS
// ============================================

/**
 * Result of bulk insert operations
 * Business result, not tied to specific database
 */
export interface BulkInsertResult {
  readonly inserted: number;
  readonly skipped: number;
  readonly errors?: string[];
}

/**
 * Result of sync operations
 * Business metrics, not stored in DB
 */
export interface SyncMetrics {
  readonly transactionsProcessed: number;
  readonly syncDuration: number;      // milliseconds
  readonly lastSyncedBlock: number;
  readonly success: boolean;
  readonly error?: string;
}

/**
 * Queue/job statistics
 * Computed aggregation, not a DB entity
 */
export interface JobStatistics {
  readonly pending: number;
  readonly processing: number;
  readonly completed: number;
  readonly failed: number;
  readonly cancelled: number;
  readonly totalJobs: number;
}

// ============================================
// BUSINESS DOMAIN TYPES
// ============================================

/**
 * Job status enum (business concept)
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Sync status enum (computed business logic)
 */
export type SyncStatus = 'never_synced' | 'syncing' | 'up_to_date' | 'stale' | 'error';

/**
 * Wallet health assessment (business logic)
 */
export interface WalletHealth {
  readonly isHealthy: boolean;
  readonly needsSync: boolean;
  readonly syncStatus: SyncStatus;
  // minutesSinceLastSync is calculated, not stored
}

// ============================================
// FILTER & QUERY TYPES
// ============================================

/**
 * Job filtering options
 * Used by repository interfaces, not DB-specific
 */
export interface JobFilters {
  readonly status?: JobStatus;
  readonly walletAddress?: string;
  readonly userId?: string;
  readonly jobType?: string;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Transaction filtering options
 * Used by repository interfaces for querying transactions
 * Note: action/protocol map to txAction/txProtocol in DB
 */
export interface TransactionQueryFilters {
  readonly action?: string;
  readonly protocol?: string;
  readonly fromDate?: Date;
  readonly toDate?: Date;
  readonly walletAddress?: string;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Generic paginated result wrapper
 * Business concept for API responses
 */
export interface PaginatedResult<T> {
  readonly items: T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly hasMore: boolean;
}

// ============================================
// CREATION/UPDATE REQUESTS (Optional DTOs)
// ============================================

/**
 * Create asset flow data
 * Used when Prisma.AssetFlowCreateInput is too verbose
 */
export interface CreateAssetFlowData {
  readonly tokenUnit: string;
  readonly inFlow: bigint;
  readonly outFlow: bigint;
  readonly netChange: bigint;
}

/**
 * Sync job creation data
 * Simplified DTO for job creation
 */
export interface CreateJobData {
  readonly walletAddress: string;
  readonly userId?: string;
  readonly jobType: string;
  readonly priority?: number;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Wallet sync job data payload
 * Data structure for wallet sync queue jobs
 */
export interface WalletSyncJobData {
  readonly walletAddress: string;
  readonly userId?: string;
  readonly syncType?: 'full' | 'incremental';
  readonly fromBlock?: number;
  readonly toBlock?: number;
}

/**
 * Database sync job type
 * Maps to sync_jobs table structure
 */
export interface DatabaseSyncJob {
  readonly id: string;
  readonly wallet_address: string;
  readonly user_id: string | null;
  readonly job_type: string;
  readonly status: JobStatus;
  readonly priority: number;
  readonly max_retries: number;
  readonly retry_count: number;
  readonly metadata: Record<string, unknown> | null;
  readonly error_message: string | null;
  readonly created_at: string;
  readonly started_at: string | null;
  readonly completed_at: string | null;
}