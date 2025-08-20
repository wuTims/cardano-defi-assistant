/**
 * Repository Interfaces
 * 
 * Tech-agnostic repository contracts that use Prisma entities directly.
 * These interfaces define data access patterns without implementation details.
 * 
 * SOLID Principles:
 * - Interface Segregation: Each repository has its own focused interface
 * - Dependency Inversion: Business logic depends on these abstractions
 * - No implementation details leak through (no Supabase/Prisma specifics)
 */

import type { 
  User, 
  Wallet, 
  Transaction, 
  AssetFlow, 
  Token,
  SyncJob,
  AuthChallenge as PrismaAuthChallenge 
} from '@prisma/client';
import type { 
  BulkInsertResult,
  JobFilters,
  JobStatus,
  SyncStatus,
  CreateAssetFlowData,
  CreateJobData,
  TransactionQueryFilters
} from '@/core/types/database';

/**
 * User Repository Interface
 * Handles user account operations
 */
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByWalletAddress(address: string): Promise<User | null>;
  create(walletAddress: string, walletType: string): Promise<User>;
  upsert(walletAddress: string, walletType: string): Promise<User>;
  update(id: string, data: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User>;
  exists(walletAddress: string): Promise<boolean>;
}

/**
 * Wallet Repository Interface
 * Handles wallet data and sync status
 */
export interface IWalletRepository {
  findByAddressAndUser(address: string, userId: string): Promise<Wallet | null>;
  findByUserId(userId: string): Promise<Wallet[]>;
  create(data: {
    address: string;
    userId: string;
    lastSyncedAt?: Date;
    syncedBlockHeight?: number;
  }): Promise<Wallet>;
  upsert(data: {
    address: string;
    userId: string;
    lastSyncedAt?: Date;
    syncedBlockHeight?: number;
  }): Promise<Wallet>;
  updateSyncStatus(
    address: string,
    userId: string,
    data: {
      lastSyncedAt: Date;
      syncedBlockHeight: number;
    }
  ): Promise<Wallet>;
}

/**
 * Transaction Repository Interface
 * Handles transaction persistence and queries
 */
export interface ITransactionRepository {
  /**
   * Find transactions with related asset flows and tokens
   * This is the main query method for fetching transaction data
   */
  findByUser(
    userId: string,
    filters?: TransactionQueryFilters
  ): Promise<(Transaction & {
    assetFlows: (AssetFlow & {
      token: Token | null;
    })[];
  })[]>;

  /**
   * Bulk insert transactions with asset flows
   * Handles deduplication based on txHash
   */
  saveBatch(
    transactions: Omit<Transaction, 'id' | 'createdAt'>[],
    assetFlows: Array<{
      txHash: string;
      flows: CreateAssetFlowData[];
    }>,
    userId: string
  ): Promise<BulkInsertResult>;

  /**
   * Get single transaction by ID
   */
  findById(
    id: string,
    userId: string
  ): Promise<(Transaction & {
    assetFlows: (AssetFlow & {
      token: Token | null;
    })[];
  }) | null>;

  /**
   * Get transaction by blockchain hash with all relations
   */
  findByHash(
    txHash: string,
    userId: string
  ): Promise<(Transaction & {
    assetFlows: (AssetFlow & {
      token: Token | null;
    })[];
  }) | null>;

  /**
   * Count transactions for pagination
   */
  count(
    userId: string,
    filters?: Omit<TransactionQueryFilters, 'limit' | 'offset'>
  ): Promise<number>;

  /**
   * Get latest block height for a wallet
   */
  getLatestBlockHeight(
    walletAddress: string,
    userId: string
  ): Promise<number>;
}

/**
 * Token Repository Interface
 * Handles token metadata operations
 */
export interface ITokenRepository {
  findByUnit(unit: string): Promise<Token | null>;
  findByPolicyId(policyId: string): Promise<Token[]>;
  findByCategory(category: string, limit?: number): Promise<Token[]>;
  search(query: string, limit?: number): Promise<Token[]>;
  upsert(token: Omit<Token, 'id' | 'createdAt' | 'updatedAt'>): Promise<Token>;
  bulkUpsert(tokens: Omit<Token, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<number>;
  exists(unit: string): Promise<boolean>;
}

/**
 * Auth Challenge Repository Interface
 * Handles authentication challenge persistence
 */
export interface IAuthChallengeRepository {
  create(data: {
    walletAddress: string;
    nonce: string;
    challenge: string;
    expiresAt: Date;
  }): Promise<PrismaAuthChallenge>;
  
  findValid(
    walletAddress: string,
    nonce: string
  ): Promise<PrismaAuthChallenge | null>;
  
  markAsUsed(id: string): Promise<void>;
  
  deleteExpired(): Promise<number>;
}

/**
 * Queue Repository Interface
 * Generic queue operations for job management
 * Tech-agnostic interface for queue persistence
 */
export interface IQueueRepository {
  /**
   * Get next available job and mark it as processing
   * Atomic operation to prevent race conditions
   */
  getNextJob(jobType?: string): Promise<SyncJob | null>;
  
  /**
   * Mark job as completed
   */
  completeJob(
    id: string,
    result?: any,
    metadata?: any
  ): Promise<void>;
  
  /**
   * Mark job as failed
   */
  failJob(
    id: string,
    error: string,
    shouldRetry?: boolean
  ): Promise<void>;
  
  /**
   * Get jobs by status
   */
  getJobsByStatus(
    status: JobStatus,
    limit?: number
  ): Promise<SyncJob[]>;
  
  /**
   * Clean up old jobs
   */
  cleanupOldJobs(
    olderThan: Date,
    status?: JobStatus
  ): Promise<number>;
}

/**
 * Sync Job Repository Interface
 * Handles job queue persistence
 */
export interface ISyncJobRepository {
  create(data: CreateJobData): Promise<SyncJob>;
  
  findById(id: string): Promise<SyncJob | null>;
  
  findByWallet(
    walletAddress: string,
    filters?: JobFilters
  ): Promise<SyncJob[]>;
  
  findPending(limit?: number): Promise<SyncJob[]>;
  
  findActive(): Promise<SyncJob[]>;
  
  updateStatus(
    id: string,
    status: JobStatus,
    data?: {
      startedAt?: Date;
      completedAt?: Date;
      error?: string;
      result?: any;
      metadata?: any;
    }
  ): Promise<SyncJob>;
  
  updateProgress(
    id: string,
    progress: number,
    message?: string
  ): Promise<void>;
  
  retry(id: string): Promise<SyncJob>;
  
  cancel(id: string): Promise<boolean>;
  
  deleteOld(olderThan: Date): Promise<number>;
}