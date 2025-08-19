// Phase 1: Prisma Transaction Repository
// Replaces Supabase RPC functions with Prisma ORM
// Fixes bulk_insert_transactions and calculate_wallet_balance issues

import { prisma } from '@/lib/prisma';
import type { WalletTransaction } from '@/types/transaction';
import type { ITransactionRepository } from '@/repositories/interfaces';

export class PrismaTransactionRepository implements ITransactionRepository {
  /**
   * Bulk insert transactions with duplicate checking
   * Replaces the broken bulk_insert_transactions RPC function
   */
  async saveBatch(
    transactions: readonly WalletTransaction[], 
    userId: string
  ): Promise<{ inserted: number; skipped: number }> {
    if (transactions.length === 0) {
      return { inserted: 0, skipped: 0 };
    }

    // Use interactive transaction for consistency
    const result = await prisma.$transaction(async (tx) => {
      // Check existing transactions
      const existingHashes = await tx.walletTransaction.findMany({
        where: {
          userId,
          txHash: { in: transactions.map(t => t.txHash) }
        },
        select: { txHash: true }
      });
      
      const existingSet = new Set(existingHashes.map(t => t.txHash));
      const newTransactions = transactions.filter(t => !existingSet.has(t.txHash));
      
      if (newTransactions.length === 0) {
        return { inserted: 0, skipped: transactions.length };
      }

      // Prepare transaction data
      const txData = newTransactions.map(t => ({
        id: t.id,
        userId,
        walletAddress: t.walletAddress,
        txHash: t.txHash,
        blockHeight: t.blockHeight,
        txTimestamp: t.tx_timestamp,
        txAction: t.tx_action,
        txProtocol: t.tx_protocol || null,
        description: t.description || null,
        netAdaChange: t.netADAChange,
        fees: t.fees
      }));

      // Bulk insert transactions
      const txResult = await tx.walletTransaction.createMany({
        data: txData,
        skipDuplicates: true
      });

      // Prepare asset flow data
      const flowData = newTransactions.flatMap(t => 
        t.assetFlows.map(f => ({
          transactionId: t.id,
          tokenUnit: f.token.unit,
          netChange: f.netChange,
          inFlow: f.inFlow,
          outFlow: f.outFlow
        }))
      );

      // Bulk insert asset flows
      if (flowData.length > 0) {
        await tx.assetFlow.createMany({
          data: flowData,
          skipDuplicates: true
        });
      }

      return {
        inserted: txResult.count,
        skipped: transactions.length - txResult.count
      };
    }, {
      timeout: 30000, // 30 second timeout
      isolationLevel: 'ReadCommitted'
    });

    console.log(`Bulk insert: ${result.inserted} inserted, ${result.skipped} skipped`);
    return result;
  }

  /**
   * Calculate wallet balance from transactions
   * Replaces the missing calculate_wallet_balance RPC function
   */
  async calculateBalance(
    walletAddress: string, 
    userId: string
  ): Promise<bigint> {
    const result = await prisma.walletTransaction.aggregate({
      where: { 
        walletAddress, 
        userId 
      },
      _sum: { 
        netAdaChange: true 
      }
    });
    
    return result._sum.netAdaChange || 0n;
  }

  /**
   * Find transactions by user with optional filters
   */
  async findByUser(
    userId: string,
    filters?: {
      action?: string;
      protocol?: string;
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<WalletTransaction[]> {
    const transactions = await prisma.walletTransaction.findMany({
      where: {
        userId,
        ...(filters?.action && { txAction: filters.action }),
        ...(filters?.protocol && { txProtocol: filters.protocol }),
        ...(filters?.fromDate && { 
          txTimestamp: { 
            gte: filters.fromDate,
            ...(filters?.toDate && { lte: filters.toDate })
          }
        })
      },
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

    return transactions.map(this.mapToWalletTransaction);
  }

  /**
   * Map Prisma result to WalletTransaction type
   */
  private mapToWalletTransaction(tx: any): WalletTransaction {
    return {
      id: tx.id,
      walletAddress: tx.walletAddress,
      txHash: tx.txHash,
      blockHeight: tx.blockHeight,
      tx_timestamp: tx.txTimestamp,
      tx_action: tx.txAction,
      tx_protocol: tx.txProtocol,
      description: tx.description,
      netADAChange: tx.netAdaChange,
      fees: tx.fees,
      assetFlows: tx.assetFlows.map((flow: any) => ({
        token: {
          unit: flow.tokenUnit,
          policyId: flow.token?.policyId || '',
          assetName: flow.token?.assetName || '',
          name: flow.token?.name || '',
          ticker: flow.token?.ticker || '',
          decimals: flow.token?.decimals || 0,
          category: flow.token?.category || 'fungible'
        },
        inFlow: flow.inFlow,
        outFlow: flow.outFlow,
        netChange: flow.netChange
      }))
    };
  }
}