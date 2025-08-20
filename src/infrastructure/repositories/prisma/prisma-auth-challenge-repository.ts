/**
 * Prisma Auth Challenge Repository
 * 
 * Implements authentication challenge operations using Prisma ORM.
 */

import type { PrismaClient, AuthChallenge } from '@prisma/client';
import type { IAuthChallengeRepository } from '@/core/interfaces/repositories';
import { logger } from '@/lib/logger';

export class PrismaAuthChallengeRepository implements IAuthChallengeRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new auth challenge
   */
  async create(data: {
    walletAddress: string;
    nonce: string;
    challenge: string;
    expiresAt: Date;
  }): Promise<AuthChallenge> {
    try {
      return await this.prisma.authChallenge.upsert({
        where: { walletAddress: data.walletAddress },
        update: {
          nonce: data.nonce,
          challenge: data.challenge,
          expiresAt: data.expiresAt,
          used: false,
          usedAt: null
        },
        create: {
          walletAddress: data.walletAddress,
          nonce: data.nonce,
          challenge: data.challenge,
          expiresAt: data.expiresAt,
          used: false
        }
      });
    } catch (error) {
      logger.error({ error, data }, 'Failed to create auth challenge');
      throw error;
    }
  }

  /**
   * Find valid challenge for wallet and nonce
   */
  async findValid(
    walletAddress: string,
    nonce: string
  ): Promise<AuthChallenge | null> {
    try {
      return await this.prisma.authChallenge.findFirst({
        where: {
          walletAddress,
          nonce,
          used: false,
          expiresAt: {
            gt: new Date() // Only get non-expired challenges
          }
        }
      });
    } catch (error) {
      logger.error({ error, walletAddress, nonce }, 'Failed to find valid challenge');
      throw error;
    }
  }

  /**
   * Mark challenge as used
   */
  async markAsUsed(id: string): Promise<void> {
    try {
      await this.prisma.authChallenge.update({
        where: { id },
        data: {
          used: true,
          usedAt: new Date()
        }
      });
    } catch (error) {
      logger.error({ error, id }, 'Failed to mark challenge as used');
      throw error;
    }
  }

  /**
   * Delete expired challenges
   */
  async deleteExpired(): Promise<number> {
    try {
      const result = await this.prisma.authChallenge.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      if (result.count > 0) {
        logger.info(`Cleaned up ${result.count} expired challenges`);
      }

      return result.count;
    } catch (error) {
      logger.error({ error }, 'Failed to delete expired challenges');
      throw error;
    }
  }
}