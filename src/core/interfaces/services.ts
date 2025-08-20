/**
 * Service Interfaces
 * 
 * Pure business logic interfaces that are technology-agnostic.
 * These define business operations without any infrastructure concerns.
 * 
 * Following YAGNI: Only includes services for implemented features
 */

import type { 
  WalletTransaction,
  RawTransaction,
  TransactionAction,
  Protocol,
  TokenInfo,
  SyncResult,
  WalletAssetFlow,
  WalletFilterResult,
  TxInput,
  TxOutput
} from '@/core/types/transaction';
import type { 
  WalletData,
  CardanoAsset,
  CardanoUTXO 
} from '@/core/types/wallet';

/**
 * Blockchain Service Interface
 * 
 * 
 * Abstracts blockchain data fetching operations
 */
export interface IBlockchainService {
  /**
   * Fetch transactions for a wallet address
   */
  getTransactions(
    address: string,
    fromBlock?: number,
    toBlock?: number
  ): Promise<RawTransaction[]>;

  /**
   * Get current block height
   */
  getCurrentBlockHeight(): Promise<number>;

  /**
   * Get wallet UTXOs
   */
  getUTXOs(address: string): Promise<CardanoUTXO[]>;

  /**
   * Get token metadata
   */
  getTokenMetadata(unit: string): Promise<{
    name?: string;
    ticker?: string;
    decimals?: number;
    logo?: string;
  } | null>;

  /**
   * Validate if address exists on chain
   */
  addressExists(address: string): Promise<boolean>;
}

/**
 * Transaction Parsing Service
 * Converts raw blockchain data to domain models
 */
export interface ITransactionParser {
  /**
   * Parse raw blockchain transaction into wallet-specific format
   * Includes categorization, asset flow calculation, and token enrichment
   */
  parseTransaction(
    raw: RawTransaction,
    walletAddress: string
  ): Promise<WalletTransaction | null>;

  /**
   * Batch parse multiple transactions
   */
  parseTransactions(
    raws: RawTransaction[],
    walletAddress: string
  ): Promise<WalletTransaction[]>;
}

/**
 * Transaction Categorization Service
 * Determines action and protocol for transactions
 */
export interface ITransactionCategorizer {
  /**
   * Categorize a transaction based on its characteristics and asset flows
   * Returns action (Supply, Borrow, etc.) and protocol (Liqwid, Minswap, etc.)
   */
  categorize(
    transaction: RawTransaction,
    flows: readonly WalletAssetFlow[]
  ): TransactionAction;

  /**
   * Detect protocol from transaction characteristics
   */
  detectProtocol(
    transaction: RawTransaction,
    flows?: readonly WalletAssetFlow[]
  ): Protocol | null;
}

/**
 * Categorization Rule Interface
 * For rule-based transaction categorization
 */
export interface ICategorizationRule {
  readonly priority: number;
  matches(tx: RawTransaction, flows: readonly WalletAssetFlow[]): boolean;
  getAction(tx: RawTransaction, flows: readonly WalletAssetFlow[]): TransactionAction;
  getProtocol(): Protocol;
}

/**
 * Wallet Filter Interface
 * For filtering transaction data by wallet address
 */
export interface IWalletFilter {
  isWalletInput(input: TxInput, address: string): boolean;
  isWalletOutput(output: TxOutput, address: string): boolean;
  filterForWallet(tx: RawTransaction, address: string): WalletFilterResult;
}

/**
 * Asset Flow Calculator Interface
 * For calculating asset flows from transaction data
 */
export interface IAssetFlowCalculator {
  calculateAssetFlows(
    inputs: readonly TxInput[],
    outputs: readonly TxOutput[],
    walletAddress: string
  ): WalletAssetFlow[];
  
  calculateNetADAChange(flows: readonly WalletAssetFlow[]): bigint;
}

/**
 * Wallet Sync Service
 * Orchestrates blockchain data synchronization
 */
export interface IWalletSyncService {
  /**
   * Sync wallet transactions from blockchain
   * Returns summary of sync operation
   */
  syncWallet(
    walletAddress: string,
    userId: string,
    options?: {
      fromBlock?: number;
      forceFullSync?: boolean;
    }
  ): Promise<SyncResult>;

  /**
   * Check if wallet needs syncing
   */
  needsSync(
    walletAddress: string,
    userId: string
  ): Promise<boolean>;

  /**
   * Get sync progress for active sync
   */
  getSyncProgress(
    walletAddress: string,
    userId: string
  ): Promise<{
    inProgress: boolean;
    currentBlock?: number;
    targetBlock?: number;
    transactionsProcessed?: number;
  } | null>;

  /**
   * Cancel an active sync operation
   */
  cancelSync(
    walletAddress: string,
    userId: string
  ): Promise<boolean>;
}

/**
 * Token Registry Service
 * Manages token metadata and categorization
 */
export interface ITokenRegistry {
  /**
   * Get token information by unit (policyId + assetName)
   */
  getTokenInfo(unit: string): Promise<TokenInfo | null>;

  /**
   * Batch fetch token information
   */
  getTokensInfo(units: string[]): Promise<Map<string, TokenInfo>>;

  /**
   * Refresh token metadata from external sources
   */
  refreshTokenMetadata(unit: string): Promise<TokenInfo | null>;

  /**
   * Search tokens by name or ticker
   */
  searchTokens(query: string, limit?: number): Promise<TokenInfo[]>;
}

/**
 * Wallet Balance Service
 * Calculates wallet balances from transactions and UTXOs
 */
export interface IWalletBalanceService {
  /**
   * Calculate current wallet balance
   */
  calculateBalance(
    walletAddress: string,
    userId: string
  ): Promise<{
    ada: bigint;
    tokens: Map<string, bigint>;
  }>;

  /**
   * Get historical balance at a specific block
   */
  getHistoricalBalance(
    walletAddress: string,
    userId: string,
    blockHeight: number
  ): Promise<{
    ada: bigint;
    tokens: Map<string, bigint>;
  }>;

  /**
   * Get wallet UTXOs from blockchain
   */
  getUTXOs(walletAddress: string): Promise<CardanoUTXO[]>;
}

/**
 * Authentication Service
 * Handles wallet-based authentication flow
 */
export interface IAuthenticationService {
  /**
   * Generate authentication challenge
   */
  generateChallenge(walletAddress: string): Promise<{
    nonce: string;
    challenge: string;
    expiresAt: Date;
  }>;

  /**
   * Verify wallet signature and generate auth token
   */
  verifyAndAuthenticate(
    walletAddress: string,
    walletType: string,
    signature: string,
    publicKey: string,
    nonce: string
  ): Promise<{
    token: string;
    expiresAt: Date;
    userId: string;
  }>;

  /**
   * Validate existing auth token
   */
  validateToken(token: string): Promise<{
    valid: boolean;
    userId?: string;
    walletAddress?: string;
    expiresAt?: Date;
  }>;

  /**
   * Refresh auth token before expiry
   */
  refreshToken(
    token: string,
    walletAddress: string
  ): Promise<{
    token: string;
    expiresAt: Date;
  } | null>;
}

/**
 * Validation Service
 * Handles various validation operations
 */
export interface IValidationService {
  /**
   * Validate Cardano address format
   */
  validateAddress(address: string): {
    valid: boolean;
    type?: 'mainnet' | 'testnet';
    format?: 'bech32' | 'hex';
  };

  /**
   * Validate transaction hash format
   */
  validateTxHash(hash: string): boolean;

  /**
   * Validate token unit format (policyId + assetName)
   */
  validateTokenUnit(unit: string): boolean;

  /**
   * Validate wallet signature
   */
  validateSignature(
    message: string,
    signature: string,
    publicKey: string,
    address: string
  ): Promise<boolean>;
}

/**
 * Cache Service Interface
 * Generic caching operations
 * 
 * Note: We use unknown as default type parameter because:
 * 1. Caches store different types (wallets, transactions, tokens)
 * 2. Type safety is enforced at usage site, not storage
 * 3. Avoids needing complex union types for multi-purpose caches
 */
export interface ICacheService<T = unknown> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  readonly defaultTTL?: number;      // Default TTL in seconds
  readonly maxSize?: number;         // Maximum cache size
  readonly checkPeriod?: number;     // Period for checking expired entries
}

/**
 * Queue Service Interface
 * Job queue operations with standard naming
 */
export interface IQueueService<T = any> {
  /**
   * Add a new job to the queue
   */
  addJob(
    type: string,
    data: T,
    options?: {
      priority?: number;
      delay?: number;
      retries?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<string>;

  /**
   * Get the next job to process from the queue
   */
  getNextJob(type: string): Promise<{
    id: string;
    data: T;
    attempts: number;
    metadata?: Record<string, any>;
  } | null>;

  /**
   * Get job by ID
   */
  getJob(jobId: string): Promise<{
    id: string;
    type: string;
    data: T;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: any;
    error?: string;
    attempts: number;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    metadata?: Record<string, any>;
  } | null>;

  /**
   * Update job progress
   */
  updateProgress(
    jobId: string,
    progress: number,
    message?: string
  ): Promise<void>;

  /**
   * Complete a job with success result
   */
  completeJob(jobId: string, result?: any): Promise<void>;

  /**
   * Fail a job with error
   */
  failJob(jobId: string, error: string): Promise<void>;

  /**
   * Retry a failed job
   */
  retryJob(jobId: string): Promise<void>;

  /**
   * Get all jobs for a specific identifier (e.g., wallet address)
   */
  getJobsByIdentifier(
    identifier: string,
    options?: {
      status?: 'pending' | 'processing' | 'completed' | 'failed';
      limit?: number;
      offset?: number;
    }
  ): Promise<Array<{
    id: string;
    type: string;
    status: string;
    createdAt: Date;
    completedAt?: Date;
  }>>;

  /**
   * Remove old completed or failed jobs
   */
  cleanupJobs(olderThan: Date): Promise<number>;
}