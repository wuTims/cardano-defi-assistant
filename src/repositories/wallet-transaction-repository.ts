/**
 * Wallet Transaction Repository
 * 
 * Purpose: Handle wallet transaction persistence
 * Single Responsibility: Transaction CRUD operations only
 * 
 * SOLID Compliance:
 * - SRP: Only handles transaction data access
 * - DIP: Depends on abstractions (ITransactionRepository, SupabaseClient)
 * - OCP: Extensible through inheritance
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base-repository';
import { logger } from '@/lib/logger';

// Create child logger for this repository
const repoLogger = logger.child({ module: 'wallet-transaction-repository' });
import type { ITransactionRepository } from '@/services/interfaces';
import type { WalletTransaction, TransactionFilters, TransactionAction, Protocol } from '@/types/transaction';
import type { 
  DatabaseTransaction, 
  DatabaseAssetFlow, 
  BulkInsertResult,
  TransactionPaginatedRow,
  DatabaseTransactionWithFlows,
  TransactionBlockHeight
} from '@/types/database';

export class WalletTransactionRepository extends BaseRepository implements ITransactionRepository {
  constructor(supabase: SupabaseClient, logger = console) {
    super(supabase, logger);
  }

  async save(transaction: WalletTransaction, userId: string): Promise<void> {
    const dbTransaction: DatabaseTransaction = {
      id: transaction.id,
      user_id: userId,
      wallet_address: transaction.walletAddress,
      tx_hash: transaction.txHash,
      block_height: transaction.blockHeight,
      tx_timestamp: transaction.tx_timestamp.toISOString(),
      tx_action: transaction.tx_action,
      tx_protocol: transaction.tx_protocol,
      description: transaction.description,
      net_ada_change: transaction.netADAChange.toString(),
      fees: transaction.fees.toString()
    };

    await this.executeWriteOperation(
      'saveTransaction',
      () => this.supabase
        .from('wallet_transactions')
        .upsert(dbTransaction, {
          onConflict: 'user_id,tx_hash',
          ignoreDuplicates: true
        })
    );

    // Save asset flows (tokens are handled by the database)
    const dbFlows: DatabaseAssetFlow[] = transaction.assetFlows.map(flow => ({
      transaction_id: transaction.id,
      token_unit: flow.token.unit,
      net_change: flow.netChange.toString(),
      in_flow: flow.amountIn.toString(),
      out_flow: flow.amountOut.toString()
    }));

    if (dbFlows.length > 0) {
      await this.executeWriteOperation(
        'saveAssetFlows',
        () => this.supabase.from('asset_flows').insert(dbFlows)
      );
    }
  }

  async saveBatch(transactions: readonly WalletTransaction[], userId: string): Promise<void> {
    if (transactions.length === 0) return;

    const payload = transactions.map(tx => ({
      id: tx.id,
      user_id: userId,
      wallet_address: tx.walletAddress,
      tx_hash: tx.txHash,
      block_height: tx.blockHeight,
      tx_timestamp: tx.tx_timestamp.toISOString(),
      tx_action: tx.tx_action,
      tx_protocol: tx.tx_protocol,
      description: tx.description,
      net_ada_change: tx.netADAChange.toString(),
      fees: tx.fees.toString(),
      asset_flows: tx.assetFlows.map(flow => ({
        token_unit: flow.token.unit,
        policy_id: flow.token.policyId,
        asset_name: flow.token.assetName,
        name: flow.token.name,
        ticker: flow.token.ticker,
        decimals: flow.token.decimals,
        category: flow.token.category,
        net_change: flow.netChange.toString(),
        in_flow: flow.amountIn.toString(),
        out_flow: flow.amountOut.toString()
      }))
    }));

    const result = await this.executeReadOperation<BulkInsertResult>(
      'bulkInsertTransactions',
      () => this.supabase.rpc('bulk_insert_transactions', { p_transactions: payload })
    );

    if (result) {
      this.logger.log(`Bulk insert: ${result.inserted_count} inserted, ${result.skipped_count} skipped`);
    }
  }

  async findByUser(userId: string, filters?: TransactionFilters): Promise<WalletTransaction[]> {
    const data = await this.executeReadOperation<TransactionPaginatedRow[]>(
      'findTransactionsByUser',
      () => this.supabase.rpc('get_transactions_paginated', {
        p_user_id: userId,
        p_limit: 100,
        p_offset: 0,
        p_action: filters?.action || null,
        p_protocol: filters?.protocol || null,
        p_from_date: filters?.fromDate?.toISOString() || null,
        p_to_date: filters?.toDate?.toISOString() || null
      })
    );

    if (!data) return [];

    // Log query results  
    repoLogger.debug({ 
      transactionCount: data.length,
      userId
    }, 'Transactions fetched from database');

    return data.map(row => {
      const mapped = this.mapToWalletTransaction(row);
      
      // Comprehensive logging split into multiple calls to prevent worker crashes
      const txLogger = repoLogger.child({ txHash: row.tx_hash });
      
      // Log database fields
      txLogger.debug({
        rawAction: row.tx_action,
        rawProtocol: row.tx_protocol,
        fees: row.fees,
        netAdaChange: row.net_ada_change,
        blockHeight: row.block_height
      }, 'Transaction database fields');
      
      // Log asset flows (in smaller chunks)
      if (Array.isArray(row.asset_flows) && row.asset_flows.length > 0) {
        txLogger.debug({
          flowCount: row.asset_flows.length,
          flowSummary: row.asset_flows.slice(0, 3).map((flow: any) => ({
            unit: flow.token_unit?.slice(0, 16) + '...',
            change: flow.net_change,
            ticker: flow.token_ticker
          }))
        }, 'Transaction asset flows');
      }
      
      // Log mapping results
      txLogger.debug({
        mappedAction: mapped.tx_action,
        mappedProtocol: mapped.tx_protocol,
        actionChanged: row.tx_action !== mapped.tx_action,
        protocolChanged: row.tx_protocol !== mapped.tx_protocol
      }, 'Transaction mapping results');
      
      return mapped;
    });
  }

  async findByTxHash(txHash: string, userId: string): Promise<WalletTransaction | null> {
    const data = await this.executeReadOperation<DatabaseTransactionWithFlows>(
      'findTransactionByHash',
      () => this.supabase
        .from('wallet_transactions')
        .select(`
          *,
          asset_flows (
            *,
            tokens (*)
          )
        `)
        .eq('tx_hash', txHash)
        .eq('user_id', userId)
        .single()
    );

    return data ? this.mapToWalletTransaction(data) : null;
  }

  async getLatestBlock(userId: string): Promise<number | null> {
    const data = await this.executeReadOperation<TransactionBlockHeight>(
      'getLatestBlock',
      () => this.supabase
        .from('wallet_transactions')
        .select('block_height')
        .eq('user_id', userId)
        .order('block_height', { ascending: false })
        .limit(1)
        .single()
    );

    return data?.block_height || null;
  }

  async delete(txHash: string, userId: string): Promise<void> {
    await this.executeWriteOperation(
      'deleteTransaction',
      () => this.supabase
        .from('wallet_transactions')
        .delete()
        .eq('tx_hash', txHash)
        .eq('user_id', userId)
    );
  }

  async deleteByUser(userId: string): Promise<void> {
    await this.executeWriteOperation(
      'deleteUserTransactions',
      () => this.supabase
        .from('wallet_transactions')
        .delete()
        .eq('user_id', userId)
    );
  }

  private mapToWalletTransaction(row: TransactionPaginatedRow | DatabaseTransactionWithFlows): WalletTransaction {
    const assetFlows = row.asset_flows 
      ? (Array.isArray(row.asset_flows) 
          ? row.asset_flows 
          : JSON.parse(row.asset_flows))
      : [];

    // Handle both TransactionPaginatedRow (has transaction_id) and DatabaseTransactionWithFlows (has id)
    const id = 'transaction_id' in row ? row.transaction_id : row.id;

    return {
      id: id,
      walletAddress: row.wallet_address,
      txHash: row.tx_hash,
      blockHeight: row.block_height,
      tx_timestamp: new Date(row.tx_timestamp),  // Now always tx_timestamp
      tx_action: row.tx_action as TransactionAction,  // Cast to enum type
      tx_protocol: row.tx_protocol as Protocol | undefined,  // Cast to enum type
      description: row.description,
      netADAChange: BigInt(row.net_ada_change),
      fees: BigInt(row.fees),
      assetFlows: assetFlows.map((flow: any) => ({
        token: {
          unit: flow.token_unit,
          policyId: flow.policy_id || '',
          assetName: flow.asset_name || '',
          name: flow.token_name || flow.name || '',
          ticker: flow.token_ticker || flow.ticker || '',
          decimals: flow.decimals || 0,
          category: flow.token_category || flow.category || 'fungible'
        },
        amountIn: BigInt(flow.in_flow || 0),
        amountOut: BigInt(flow.out_flow || 0),
        netChange: BigInt(flow.net_change)
      }))
    };
  }
}