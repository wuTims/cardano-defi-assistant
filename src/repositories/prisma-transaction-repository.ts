/**
 * Prisma Transaction Repository
 * 
 * Replaces Supabase RPC functions with direct Prisma operations.
 * Handles transactions and their associated asset flows.
 * 
 * Design: Accepts PrismaClient via constructor for better testability and swappability
 */

import { PrismaClient, Prisma } from '@prisma/client';
import type { 
  ITransactionRepository, 
  TransactionWithAssets, 
  BulkInsertResult,
  TransactionFilters 
} from '@/repositories/interfaces/transaction-repository';
import type { Transaction, AssetFlow } from '@prisma/client';
import { logger as rootLogger } from '@/lib/logger';

const logger = rootLogger.child({ repository: 'PrismaTransactionRepository' });

export class PrismaTransactionRepository implements ITransactionRepository {
  constructor(private readonly prisma: PrismaClient) {}
  /**
   * Bulk insert transactions with duplicate checking
   * Replaces: bulk_insert_transactions RPC
   * 
   * @param transactions - Transactions to insert (without id/createdAt - DB generates these)
   * @param assetFlows - Asset flows grouped by txHash (not transactionId since we don't have IDs yet)
   * @param userId - User ID for all transactions
   */
  async saveBatch(
    transactions: Omit<Transaction, 'id' | 'createdAt'>[],
    assetFlows: Array<{ txHash: string; flows: Omit<AssetFlow, 'id' | 'createdAt' | 'transactionId'>[] }>,
    userId: string
  ): Promise<BulkInsertResult> {
    if (transactions.length === 0) {
      return { inserted: 0, skipped: 0 };
    }

    const startTime = Date.now();
    const txLogger = logger.child({ 
      method: 'saveBatch',
      userId,
      txCount: transactions.length 
    });

    try {
      // Use interactive transaction for consistency
      const result = await this.prisma.$transaction(async (tx) => {
        // Bulk insert with skipDuplicates - Prisma handles duplicates automatically
        const insertResult = await tx.transaction.createMany({
          data: transactions.map(t => ({
            ...t,
            metadata: t.metadata === null ? Prisma.JsonNull : t.metadata
          })),
          skipDuplicates: true
        });

        // Insert asset flows for successfully inserted transactions
        if (insertResult.count > 0) {
          // We need to match which transactions were actually inserted
          // to insert their asset flows with correct foreign keys
          const txHashes = transactions
            .slice(0, insertResult.count)
            .map(t => t.txHash);
          
          const insertedTransactions = await tx.transaction.findMany({
            where: {
              userId,
              txHash: { in: txHashes }
            },
            select: { id: true, txHash: true }
          });

          // Create a map for quick lookup
          const txHashToId = new Map(
            insertedTransactions.map(t => [t.txHash, t.id])
          );
          
          // Prepare asset flows with correct transaction IDs
          const flowsToInsert: Omit<AssetFlow, 'id' | 'createdAt'>[] = [];
          
          for (const af of assetFlows) {
            // Use txHash to find the generated transaction ID
            const txId = txHashToId.get(af.txHash);
            if (txId) {
              flowsToInsert.push(
                ...af.flows.map(flow => ({
                  ...flow,
                  transactionId: txId
                }))
              );
            }
          }

          if (flowsToInsert.length > 0) {
            await tx.assetFlow.createMany({
              data: flowsToInsert,
              skipDuplicates: true
            });
            
            txLogger.debug({ flowCount: flowsToInsert.length }, 'Asset flows inserted');
          }
        }

        const inserted = insertResult.count;
        const skipped = transactions.length - insertResult.count;

        txLogger.info({
          inserted,
          skipped,
          duration: Date.now() - startTime
        }, 'Bulk insert completed');

        return { inserted, skipped };
      }, {
        timeout: 30000,
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
      });

      return result;
    } catch (error) {
      txLogger.error({ error }, 'Failed to bulk insert transactions');
      throw error;
    }
  }

  /**
   * Calculate wallet balance from transactions
   * Replaces: calculate_wallet_balance RPC
   */
  async calculateBalance(walletAddress: string, userId: string): Promise<bigint> {
    const calcLogger = logger.child({ 
      method: 'calculateBalance',
      walletAddress,
      userId 
    });

    try {
      const result = await this.prisma.transaction.aggregate({
        where: { 
          walletAddress, 
          userId 
        },
        _sum: { 
          netAdaChange: true 
        }
      });
      
      const balance = result._sum.netAdaChange || 0n;
      calcLogger.debug({ balance: balance.toString() }, 'Balance calculated');
      
      return balance;
    } catch (error) {
      calcLogger.error({ error }, 'Failed to calculate balance');
      throw error;
    }
  }

  /**
   * Find transactions by user with filters
   * Replaces: get_transactions_paginated RPC
   */
  async findByUser(
    userId: string, 
    filters?: TransactionFilters
  ): Promise<TransactionWithAssets[]> {
    const findLogger = logger.child({ 
      method: 'findByUser',
      userId,
      filters 
    });

    try {
      const where: Prisma.TransactionWhereInput = {
        userId,
        ...(filters?.txAction && { txAction: filters.txAction }),
        ...(filters?.txProtocol && { txProtocol: filters.txProtocol }),
        ...(filters?.walletAddress && { walletAddress: filters.walletAddress }),
        ...(filters?.fromDate && { 
          txTimestamp: { 
            gte: filters.fromDate,
            ...(filters?.toDate && { lte: filters.toDate })
          }
        })
      };

      const transactions = await this.prisma.transaction.findMany({
        where,
        include: {
          assetFlows: {
            include: {
              token: true
            }
          }
        },
        take: filters?.limit || 100,
        skip: filters?.offset || 0,
        orderBy: {
          txTimestamp: 'desc'
        }
      });

      findLogger.debug({ count: transactions.length }, 'Transactions found');
      return transactions;
    } catch (error) {
      findLogger.error({ error }, 'Failed to find transactions');
      throw error;
    }
  }

  /**
   * Get single transaction with all asset movements
   */
  async findById(id: string, userId: string): Promise<TransactionWithAssets | null> {
    try {
      return await this.prisma.transaction.findFirst({
        where: { id, userId },
        include: {
          assetFlows: {
            include: {
              token: true
            }
          }
        }
      });
    } catch (error) {
      logger.error({ error, id, userId }, 'Failed to find transaction by ID');
      throw error;
    }
  }

  /**
   * Get transaction by blockchain hash
   */
  async findByHash(txHash: string, userId: string): Promise<TransactionWithAssets | null> {
    try {
      return await this.prisma.transaction.findFirst({
        where: { txHash, userId },
        include: {
          assetFlows: {
            include: {
              token: true
            }
          }
        }
      });
    } catch (error) {
      logger.error({ error, txHash, userId }, 'Failed to find transaction by hash');
      throw error;
    }
  }

  /**
   * Count transactions for a user
   */
  async count(userId: string, filters?: TransactionFilters): Promise<number> {
    try {
      const where: Prisma.TransactionWhereInput = {
        userId,
        ...(filters?.txAction && { txAction: filters.txAction }),
        ...(filters?.txProtocol && { txProtocol: filters.txProtocol }),
        ...(filters?.walletAddress && { walletAddress: filters.walletAddress }),
        ...(filters?.fromDate && { 
          txTimestamp: { 
            gte: filters.fromDate,
            ...(filters?.toDate && { lte: filters.toDate })
          }
        })
      };

      return await this.prisma.transaction.count({ where });
    } catch (error) {
      logger.error({ error, userId, filters }, 'Failed to count transactions');
      throw error;
    }
  }

  /**
   * Get latest synced block height for a wallet
   */
  async getLatestBlockHeight(walletAddress: string, userId: string): Promise<number> {
    try {
      const result = await this.prisma.transaction.findFirst({
        where: { walletAddress, userId },
        select: { blockHeight: true },
        orderBy: { blockHeight: 'desc' }
      });

      const height = result?.blockHeight || 0;
      logger.debug({ walletAddress, height }, 'Latest block height retrieved');
      
      return height;
    } catch (error) {
      logger.error({ error, walletAddress, userId }, 'Failed to get latest block height');
      throw error;
    }
  }
}