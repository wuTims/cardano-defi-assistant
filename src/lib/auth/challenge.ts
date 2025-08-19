/**
 * Authentication Challenge Utilities
 * 
 * Handles challenge generation, storage, and validation for wallet authentication.
 * Follows exact persistence requirement to prevent reconstruction mismatches.
 */

import { randomBytes } from 'crypto';
import { ServiceFactory } from '@/services/service-factory';
import { prisma } from '@/lib/prisma';
import { ValidationError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { config } from '@/lib/config';
import type { AuthChallenge, AuthServiceResponse } from '@/types/auth';

/**
 * Generate authentication challenge with canonical format
 * 
 * Creates a cryptographically secure nonce and canonical challenge string that follows
 * the authentication specification from auth-implementation.md. The challenge is stored
 * exactly as generated in the database to prevent reconstruction mismatches.
 * 
 * @param walletAddress - Bech32-formatted Cardano wallet address (addr1...)
 * @returns Promise resolving to challenge data or error response
 * 
 * @example
 * ```typescript
 * const result = await generateChallenge('addr1qx2fxv2umyhttkxy...');
 * if (result.success) {
 *   console.log('Challenge:', result.data.challenge);
 *   console.log('Nonce:', result.data.nonce);
 * }
 * ```
 * 
 * @throws {ValidationError} When wallet address is missing or invalid
 */
export async function generateChallenge(walletAddress: string): Promise<AuthServiceResponse<AuthChallenge>> {
  try {
    if (!walletAddress) {
      throw new ValidationError('Wallet address is required');
    }

    // Generate cryptographically secure nonce
    const nonce = randomBytes(32).toString('hex');
    
    // Create canonical challenge string as specified in auth-implementation.md
    const issuedAt = new Date().toISOString();
    const appOrigin = process.env.NEXT_PUBLIC_APP_URL || 'https://wallet-sync.com';
    
    const challenge = [
      `Authenticate wallet ${walletAddress} for Wallet Sync Service`,
      `Nonce: ${nonce}`,
      `Issued: ${issuedAt}`,
      `Origin: ${appOrigin}`,
      `Purpose: login-v1`
    ].join('\\n');

    const expiresAt = new Date(Date.now() + config.get('auth').challengeTTL * 1000);

    // Store challenge in database with exact string
    const authChallengeRepo = ServiceFactory.getAuthChallengeRepository();
    await authChallengeRepo.storeChallenge(
      walletAddress,
      nonce,
      challenge,
      expiresAt
    );

    const authChallenge: AuthChallenge = {
      nonce,
      challenge, // Exact string stored in DB
      expiresAt,
      walletAddress
    };

    logger.info(`Challenge generated and stored for wallet: ${walletAddress}`);

    return {
      success: true,
      data: authChallenge
    };
  } catch (error) {
    logger.error({ err: error }, 'Failed to generate challenge');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Challenge generation failed'
    };
  }
}

/**
 * Create or get user by wallet address
 * Replaces the old upsert_app_user RPC function
 */
export async function upsertUser(
  walletAddress: string,
  walletType?: string
): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
  try {
    const user = await prisma.user.upsert({
      where: { walletAddress },
      update: {
        walletType,
        lastLoginAt: new Date()
      },
      create: {
        walletAddress,
        walletType
      },
      select: { id: true }
    });

    return {
      success: true,
      data: { id: user.id }
    };
  } catch (error) {
    logger.error({ err: error, walletAddress }, 'Failed to upsert user');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'User operation failed'
    };
  }
}

/**
 * Get user by wallet address
 * Replaces the old app_users table query
 */
export async function getUserByWallet(
  walletAddress: string
): Promise<{ success: boolean; data?: { id: string; walletType?: string; lastLoginAt: Date | null }; error?: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      select: {
        id: true,
        walletType: true,
        lastLoginAt: true
      }
    });

    if (!user) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    return {
      success: true,
      data: {
        id: user.id,
        walletType: user.walletType || undefined,
        lastLoginAt: user.lastLoginAt
      }
    };
  } catch (error) {
    logger.error({ err: error, walletAddress }, 'Failed to get user by wallet');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Database error'
    };
  }
}

/**
 * Retrieve and validate stored challenge
 * 
 * Fetches challenge from database and validates it hasn't expired.
 * Used during signature verification process.
 * 
 * @param walletAddress - Bech32 wallet address
 * @param nonce - Challenge nonce
 * @returns Promise resolving to challenge data or error
 */
export async function getStoredChallenge(
  walletAddress: string, 
  nonce: string
): Promise<AuthServiceResponse<{ challenge: string; expiresAt: Date }>> {
  try {
    const authChallengeRepo = ServiceFactory.getAuthChallengeRepository();
    const challengeData = await authChallengeRepo.getChallenge(walletAddress, nonce);
    
    if (!challengeData) {
      return {
        success: false,
        error: 'Invalid or expired challenge'
      };
    }

    return {
      success: true,
      data: challengeData
    };
  } catch (error) {
    logger.error({ err: error }, 'Failed to retrieve challenge');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Challenge retrieval failed'
    };
  }
}

/**
 * Mark challenge as used to prevent replay attacks
 * 
 * @param walletAddress - Bech32 wallet address
 * @param nonce - Challenge nonce
 * @returns Promise resolving to success status
 */
export async function markChallengeAsUsed(
  walletAddress: string, 
  nonce: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const authChallengeRepo = ServiceFactory.getAuthChallengeRepository();
    const success = await authChallengeRepo.markChallengeUsed(walletAddress, nonce);
    
    if (!success) {
      logger.warn(`Failed to mark challenge as used for wallet: ${walletAddress}`);
      return { success: false, error: 'Challenge not found or already used' };
    }
    
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to mark challenge as used';
    logger.warn(`Failed to mark challenge as used: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}