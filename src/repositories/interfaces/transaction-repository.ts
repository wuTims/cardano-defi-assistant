/**
 * Transaction Repository Interface
 * 
 * Defines the contract for transaction data operations.
 * Implementations can use Prisma, Supabase RPC, or other backends.
 */

import type { Transaction, AssetFlow } from '@prisma/client';

/**
 * Complete transaction record with all asset movements
 * Result of joining Transaction with AssetFlow and Token tables
 */
export interface TransactionWithAssets extends Transaction {
  assetFlows: (AssetFlow & { 
    token: {
      unit: string;
      policyId: string;
      assetName: string;
      name: string | null;
      ticker: string | null;
      decimals: number;
      category: string;
    } | null;  // Matches Prisma's return type - null for missing relations
  })[];
}

/**
 * Result of bulk transaction insertion
 * Tracks how many transactions were new vs already existed
 */
export interface BulkInsertResult {
  inserted: number;  // New transactions added
  skipped: number;   // Transactions that already existed (by txHash)
  errors?: string[]; // Any errors encountered
}

export interface TransactionFilters {
  txAction?: string;
  txProtocol?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
  walletAddress?: string;
}

export interface ITransactionRepository {
  /**
   * Bulk insert transactions with duplicate checking
   * Replaces: bulk_insert_transactions RPC
   * Note: Blockchain transactions are immutable - duplicates are skipped, not updated
   * 
   * @param assetFlows - Grouped by txHash since transactions don't have IDs yet
   */
  saveBatch(
    transactions: Omit<Transaction, 'id' | 'createdAt'>[],
    assetFlows: Array<{ txHash: string; flows: Omit<AssetFlow, 'id' | 'createdAt' | 'transactionId'>[] }>,
    userId: string
  ): Promise<BulkInsertResult>;

  /**
   * Calculate wallet balance from transactions
   * Replaces: calculate_wallet_balance RPC
   * Sums all netAdaChange values for the wallet
   */
  calculateBalance(walletAddress: string, userId: string): Promise<bigint>;

  /**
   * Find transactions by user with filters
   * Replaces: get_transactions_paginated RPC
   */
  findByUser(userId: string, filters?: TransactionFilters): Promise<TransactionWithAssets[]>;

  /**
   * Get single transaction with all asset movements
   */
  findById(id: string, userId: string): Promise<TransactionWithAssets | null>;

  /**
   * Get transaction by blockchain hash
   * txHash is unique per blockchain, but we scope by user for security
   */
  findByHash(txHash: string, userId: string): Promise<TransactionWithAssets | null>;

  /**
   * Count transactions for a user
   */
  count(userId: string, filters?: TransactionFilters): Promise<number>;

  /**
   * Get latest synced block height for a wallet
   * Used to determine where to resume syncing
   */
  getLatestBlockHeight(walletAddress: string, userId: string): Promise<number>;
}