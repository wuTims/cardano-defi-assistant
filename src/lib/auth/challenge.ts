/**
 * Authentication Challenge Utilities
 * 
 * Handles challenge generation, storage, and validation for wallet authentication.
 * Follows exact persistence requirement to prevent reconstruction mismatches.
 */

import { randomBytes } from 'crypto';
import { authDatabase } from '@/lib/supabase/server';
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
    const storeResult = await authDatabase.storeChallenge(
      walletAddress,
      nonce,
      challenge,
      expiresAt
    );

    if (!storeResult.success) {
      throw new Error(`Failed to store challenge: ${storeResult.error}`);
    }

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
    const challengeResult = await authDatabase.getChallenge(walletAddress, nonce);
    
    if (!challengeResult.success || !challengeResult.data) {
      return {
        success: false,
        error: challengeResult.error || 'Invalid or expired challenge'
      };
    }

    const { challenge, expiresAt } = challengeResult.data;

    // Verify challenge hasn't expired
    if (expiresAt < new Date()) {
      return {
        success: false,
        error: 'Challenge expired'
      };
    }

    return {
      success: true,
      data: { challenge, expiresAt }
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
  const markUsedResult = await authDatabase.markChallengeUsed(walletAddress, nonce);
  
  if (!markUsedResult.success) {
    logger.warn(`Failed to mark challenge as used: ${markUsedResult.error}`);
  }
  
  return markUsedResult;
}