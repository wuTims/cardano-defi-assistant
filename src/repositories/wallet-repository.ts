/**
 * Wallet Repository
 * 
 * Purpose: Handle wallet data persistence
 * Single Responsibility: Wallet CRUD operations only
 * 
 * SOLID Compliance:
 * - SRP: Only handles wallet data access
 * - DIP: Depends on abstractions (IWalletRepository, SupabaseClient)
 * - OCP: Extensible through inheritance
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base-repository';
import type { IWalletRepository } from '@/services/interfaces';
import type { 
  DatabaseWallet, 
  WalletWithSyncStatus, 
  WalletSyncStatusUpdate 
} from '@/types/database';

export class WalletRepository extends BaseRepository implements IWalletRepository {
  constructor(supabase: SupabaseClient, logger = console) {
    super(supabase, logger);
  }

  /**
   * Find wallet by address and user ID
   */
  async findByAddress(walletAddress: string, userId: string): Promise<DatabaseWallet | null> {
    return this.executeReadOperation(
      'findWalletByAddress',
      () => this.supabase
        .from('wallets')
        .select('*')
        .eq('wallet_address', walletAddress)
        .eq('user_id', userId)
        .single()
    );
  }

  /**
   * Find wallet with computed sync status from view
   */
  async findWithSyncStatus(walletAddress: string, userId: string): Promise<WalletWithSyncStatus | null> {
    return this.executeReadOperation(
      'findWalletWithSyncStatus',
      () => this.supabase
        .from('wallet_with_sync_status')
        .select('*')
        .eq('wallet_address', walletAddress)
        .eq('user_id', userId)
        .single()
    );
  }

  /**
   * Update wallet sync status
   */
  async updateSyncStatus(
    walletAddress: string, 
    userId: string, 
    status: WalletSyncStatusUpdate
  ): Promise<void> {
    return this.executeWriteOperation(
      'updateWalletSyncStatus',
      () => {
        const updateData = {
          ...status,
          updated_at: new Date().toISOString()
        };

        return this.supabase
          .from('wallets')
          .update(updateData)
          .eq('wallet_address', walletAddress)
          .eq('user_id', userId);
      }
    );
  }

  /**
   * Create a new wallet record
   */
  async create(walletAddress: string, userId: string): Promise<DatabaseWallet> {
    const { data, error } = await this.supabase
      .from('wallets')
      .insert({
        wallet_address: walletAddress,
        user_id: userId,
        balance_lovelace: '0',
        synced_block_height: 0,
        sync_in_progress: false
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create wallet: ${error.message}`);
      throw error;
    }

    return data as DatabaseWallet;
  }

  /**
   * Update wallet balance
   */
  async updateBalance(
    walletAddress: string, 
    userId: string, 
    balanceLovelace: string
  ): Promise<void> {
    return this.executeWriteOperation(
      'updateWalletBalance',
      () => this.supabase
        .from('wallets')
        .update({
          balance_lovelace: balanceLovelace,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', walletAddress)
        .eq('user_id', userId)
    );
  }
}