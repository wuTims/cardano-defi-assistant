/**
 * Auth Challenge Repository Interface
 * 
 * Defines the contract for authentication challenge operations.
 */

import type { AuthChallenge } from '@prisma/client';

export interface IAuthChallengeRepository {
  /**
   * Store or update authentication challenge
   */
  storeChallenge(
    walletAddress: string,
    nonce: string,
    challenge: string,
    expiresAt: Date
  ): Promise<void>;

  /**
   * Get valid challenge by wallet and nonce
   */
  getChallenge(
    walletAddress: string,
    nonce: string
  ): Promise<{ challenge: string; expiresAt: Date } | null>;

  /**
   * Mark challenge as used
   */
  markChallengeUsed(
    walletAddress: string,
    nonce: string
  ): Promise<boolean>;

  /**
   * Clean up expired challenges
   */
  cleanupExpiredChallenges(): Promise<number>;
}