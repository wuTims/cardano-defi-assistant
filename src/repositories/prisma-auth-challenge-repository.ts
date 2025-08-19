/**
 * Prisma Auth Challenge Repository
 * 
 * Implements authentication challenge operations using Prisma ORM.
 */

import type { PrismaClient, AuthChallenge } from '@prisma/client';
import type { IAuthChallengeRepository } from './interfaces/auth-challenge-repository';
import { logger } from '@/lib/logger';

export class PrismaAuthChallengeRepository implements IAuthChallengeRepository {
  constructor(private prisma: PrismaClient) {}

  async storeChallenge(
    walletAddress: string,
    nonce: string,
    challenge: string,
    expiresAt: Date
  ): Promise<void> {
    try {
      await this.prisma.authChallenge.upsert({
        where: { walletAddress },
        update: {
          nonce,
          challenge,
          expiresAt,
          used: false,
          usedAt: null
        },
        create: {
          walletAddress,
          nonce,
          challenge,
          expiresAt,
          used: false
        }
      });
    } catch (error) {
      logger.error({ error, walletAddress, nonce }, 'Failed to store challenge');
      throw error;
    }
  }

  async getChallenge(
    walletAddress: string,
    nonce: string
  ): Promise<{ challenge: string; expiresAt: Date } | null> {
    try {
      const authChallenge = await this.prisma.authChallenge.findFirst({
        where: {
          walletAddress,
          nonce,
          used: false,
          expiresAt: {
            gt: new Date() // Only get non-expired challenges
          }
        },
        select: {
          challenge: true,
          expiresAt: true
        }
      });

      return authChallenge;
    } catch (error) {
      logger.error({ error, walletAddress, nonce }, 'Failed to get challenge');
      throw error;
    }
  }

  async markChallengeUsed(
    walletAddress: string,
    nonce: string
  ): Promise<boolean> {
    try {
      const result = await this.prisma.authChallenge.updateMany({
        where: {
          walletAddress,
          nonce,
          used: false
        },
        data: {
          used: true,
          usedAt: new Date()
        }
      });

      return result.count > 0;
    } catch (error) {
      logger.error({ error, walletAddress, nonce }, 'Failed to mark challenge as used');
      throw error;
    }
  }

  async cleanupExpiredChallenges(): Promise<number> {
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
      logger.error({ error }, 'Failed to cleanup expired challenges');
      throw error;
    }
  }
}