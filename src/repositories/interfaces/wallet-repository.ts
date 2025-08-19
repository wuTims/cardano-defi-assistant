/**
 * Wallet Repository Interface
 * 
 * Defines the contract for wallet data operations.
 * Simple interface following SRP - only wallet-related operations.
 */

import type { Wallet } from '@prisma/client';

export interface IWalletRepository {
  /**
   * Find wallet by address
   */
  findByAddress(walletAddress: string): Promise<Wallet | null>;

  /**
   * Create a new wallet record
   */
  create(walletAddress: string, userId: string): Promise<Wallet>;

  /**
   * Update wallet sync status
   */
  updateSyncStatus(
    walletAddress: string,
    userId: string,
    syncedBlockHeight: number,
    lastSyncedAt?: Date
  ): Promise<Wallet>;

  /**
   * Find wallet with user validation
   */
  findByAddressAndUser(walletAddress: string, userId: string): Promise<Wallet | null>;
}