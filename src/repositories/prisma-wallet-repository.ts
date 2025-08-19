/**
 * Prisma Wallet Repository
 * 
 * Implements wallet operations using Prisma ORM.
 * Simple, focused implementation following SRP.
 */

import type { PrismaClient, Wallet } from '@prisma/client';
import type { IWalletRepository } from './interfaces/wallet-repository';
import { logger } from '@/lib/logger';

export class PrismaWalletRepository implements IWalletRepository {
  constructor(private prisma: PrismaClient) {}

  async findByAddress(walletAddress: string): Promise<Wallet | null> {
    try {
      return await this.prisma.wallet.findFirst({
        where: { walletAddress }
      });
    } catch (error) {
      logger.error({ error, walletAddress }, 'Failed to find wallet by address');
      throw error;
    }
  }

  async create(walletAddress: string, userId: string): Promise<Wallet> {
    try {
      return await this.prisma.wallet.create({
        data: {
          walletAddress,
          userId,
          lastSyncedAt: null,
          syncedBlockHeight: 0
        }
      });
    } catch (error) {
      logger.error({ error, walletAddress, userId }, 'Failed to create wallet');
      throw error;
    }
  }

  async updateSyncStatus(
    walletAddress: string,
    userId: string,
    syncedBlockHeight: number,
    lastSyncedAt: Date = new Date()
  ): Promise<Wallet> {
    try {
      return await this.prisma.wallet.update({
        where: {
          userId_walletAddress: {
            userId,
            walletAddress
          }
        },
        data: {
          syncedBlockHeight,
          lastSyncedAt
        }
      });
    } catch (error) {
      logger.error({ error, walletAddress, userId, syncedBlockHeight }, 'Failed to update wallet sync status');
      throw error;
    }
  }

  async findByAddressAndUser(walletAddress: string, userId: string): Promise<Wallet | null> {
    try {
      return await this.prisma.wallet.findUnique({
        where: {
          userId_walletAddress: {
            userId,
            walletAddress
          }
        }
      });
    } catch (error) {
      logger.error({ error, walletAddress, userId }, 'Failed to find wallet by address and user');
      throw error;
    }
  }
}