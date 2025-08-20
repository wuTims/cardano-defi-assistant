/**
 * Prisma Wallet Repository
 * 
 * Implements wallet operations using Prisma ORM.
 * Simple, focused implementation following SRP.
 */

import type { PrismaClient, Wallet } from '@prisma/client';
import type { IWalletRepository } from '@/core/interfaces/repositories';
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

  async create(data: {
    address: string;
    userId: string;
    lastSyncedAt?: Date;
    syncedBlockHeight?: number;
  }): Promise<Wallet> {
    try {
      return await this.prisma.wallet.create({
        data: {
          walletAddress: data.address,
          userId: data.userId,
          lastSyncedAt: data.lastSyncedAt || null,
          syncedBlockHeight: data.syncedBlockHeight || 0
        }
      });
    } catch (error) {
      logger.error({ error, data }, 'Failed to create wallet');
      throw error;
    }
  }

  async updateSyncStatus(
    address: string,
    userId: string,
    data: {
      lastSyncedAt: Date;
      syncedBlockHeight: number;
    }
  ): Promise<Wallet> {
    try {
      return await this.prisma.wallet.update({
        where: {
          userId_walletAddress: {
            userId,
            walletAddress: address
          }
        },
        data: {
          syncedBlockHeight: data.syncedBlockHeight,
          lastSyncedAt: data.lastSyncedAt
        }
      });
    } catch (error) {
      logger.error({ error, address, userId, data }, 'Failed to update wallet sync status');
      throw error;
    }
  }

  async findByAddressAndUser(address: string, userId: string): Promise<Wallet | null> {
    try {
      return await this.prisma.wallet.findUnique({
        where: {
          userId_walletAddress: {
            userId,
            walletAddress: address
          }
        }
      });
    } catch (error) {
      logger.error({ error, address, userId }, 'Failed to find wallet by address and user');
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<Wallet[]> {
    try {
      return await this.prisma.wallet.findMany({
        where: { userId }
      });
    } catch (error) {
      logger.error({ error, userId }, 'Failed to find wallets by user');
      throw error;
    }
  }

  async upsert(data: {
    address: string;
    userId: string;
    lastSyncedAt?: Date;
    syncedBlockHeight?: number;
  }): Promise<Wallet> {
    try {
      return await this.prisma.wallet.upsert({
        where: {
          userId_walletAddress: {
            userId: data.userId,
            walletAddress: data.address
          }
        },
        update: {
          lastSyncedAt: data.lastSyncedAt,
          syncedBlockHeight: data.syncedBlockHeight
        },
        create: {
          walletAddress: data.address,
          userId: data.userId,
          lastSyncedAt: data.lastSyncedAt || null,
          syncedBlockHeight: data.syncedBlockHeight || 0
        }
      });
    } catch (error) {
      logger.error({ error, data }, 'Failed to upsert wallet');
      throw error;
    }
  }
}