/**
 * Cardano Wallet Authentication Service
 * 
 * Main authentication orchestrator for Cardano wallet-based authentication.
 * Uses decomposed modules for focused responsibilities:
 * - Challenge generation/validation
 * - JWT token management  
 * - Wallet signature verification
 */

import { authDatabase } from '@/lib/supabase/server';
import { AuthenticationError, ValidationError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { generateChallenge, getStoredChallenge, markChallengeAsUsed } from '@/lib/auth/challenge';
import { jwtManager } from '@/lib/auth/jwt';
import { verifyWalletSignature } from '@/lib/auth/wallet-verification';
import type {
  AuthChallenge,
  WalletSignatureArgs,
  SupabaseAuthToken,
  AuthServiceResponse
} from '@/types/auth';
import { WalletType } from '@/types/auth';

export class CardanoAuthService {
  private static instance: CardanoAuthService;
  private logger = logger;

  private constructor() {
    // Prevent client-side instantiation
    if (typeof window !== 'undefined' && typeof global === 'undefined') {
      throw new Error('CardanoAuthService can only be instantiated on the server');
    }
  }

  public static getInstance(): CardanoAuthService {
    if (!CardanoAuthService.instance) {
      CardanoAuthService.instance = new CardanoAuthService();
    }
    return CardanoAuthService.instance;
  }

  /**
   * Generate authentication challenge for wallet
   * 
   * @param walletAddress - Bech32-formatted Cardano wallet address
   * @returns Promise resolving to challenge data or error response
   */
  public async generateChallenge(walletAddress: string): Promise<AuthServiceResponse<AuthChallenge>> {
    return generateChallenge(walletAddress);
  }

  /**
   * Verify wallet signature and generate JWT token
   * 
   * Performs complete authentication flow:
   * 1. Validates challenge existence and expiration
   * 2. Verifies COSE signature using CIP-30 standards
   * 3. Marks challenge as used (prevents replay attacks)
   * 4. Upserts user in database
   * 5. Generates Supabase-compatible JWT
   * 
   * @param signatureData - Wallet signature components
   * @param walletType - Type of Cardano wallet used
   * @param bech32Address - Bech32-formatted address for database operations
   * @returns Promise resolving to JWT token and user data or error response
   */
  public async verifySignatureAndGenerateToken(
    signatureData: WalletSignatureArgs,
    walletType: WalletType,
    bech32Address: string
  ): Promise<AuthServiceResponse<SupabaseAuthToken>> {
    try {
      const { hexAddress, coseSignature, publicKey, nonce } = signatureData;

      if (!hexAddress || !coseSignature || !publicKey || !nonce || !bech32Address) {
        throw new ValidationError('Missing required signature data or bech32Address');
      }

      // 1. Retrieve and validate stored challenge
      const challengeResult = await getStoredChallenge(bech32Address, nonce);
      if (!challengeResult.success || !challengeResult.data) {
        throw new AuthenticationError(challengeResult.error || 'Invalid or expired challenge');
      }

      const { challenge } = challengeResult.data;

      // 2. Verify wallet signature against stored challenge
      const signatureVerification = await verifyWalletSignature(
        challenge,
        coseSignature,
        publicKey,
        hexAddress
      );

      if (!signatureVerification.isValid) {
        throw new AuthenticationError(`Signature verification failed: ${signatureVerification.error}`);
      }

      // 3. Mark challenge as used (prevents replay attacks)
      const markUsedResult = await markChallengeAsUsed(bech32Address, nonce);
      if (!markUsedResult.success) {
        this.logger.warn(`Failed to mark challenge as used: ${markUsedResult.error}`);
      }

      // 4. Upsert user in app_users table
      const userResult = await authDatabase.upsertUser(bech32Address, walletType);
      if (!userResult.success || !userResult.data) {
        throw new Error(`Failed to create user: ${userResult.error}`);
      }

      const userId = userResult.data.id;

      // 5. Generate Supabase-compatible JWT
      const tokenResult = await jwtManager.generateSupabaseJWT(userId, bech32Address, walletType);

      this.logger.info(`Authentication successful for wallet: ${bech32Address}, user: ${userId}`);

      return {
        success: true,
        data: {
          token: tokenResult.token,
          expiresAt: tokenResult.expiresAt,
          walletAddress: bech32Address,
          walletType,
          userId
        }
      };
    } catch (error) {
      this.logger.error('Authentication failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Verify JWT token authenticity and extract user claims
   * 
   * @param token - JWT token string to verify
   * @returns Promise resolving to user data from token claims or error response
   */
  public async verifyToken(token: string): Promise<AuthServiceResponse<{ 
    userId: string; 
    walletAddress: string; 
    walletType?: string; 
  }>> {
    return jwtManager.verifyToken(token);
  }

  /**
   * Refresh JWT token for authenticated user
   * 
   * Generates new JWT token for existing user without requiring signature verification.
   * Validates current token ownership and generates fresh token with updated expiration.
   * 
   * @param currentToken - Valid JWT token to verify ownership
   * @param walletAddress - Bech32 wallet address requesting refresh
   * @returns Promise resolving to new JWT token or error response
   */
  public async refreshToken(
    currentToken: string,
    walletAddress: string
  ): Promise<AuthServiceResponse<SupabaseAuthToken>> {
    try {
      if (!currentToken || !walletAddress) {
        throw new ValidationError('Current token and wallet address are required');
      }

      // Verify current token is valid and extract claims
      const tokenVerification = await this.verifyToken(currentToken);
      if (!tokenVerification.success || !tokenVerification.data) {
        throw new AuthenticationError('Current token is invalid or expired');
      }

      // Ensure wallet address matches token claims for security
      if (tokenVerification.data.walletAddress !== walletAddress) {
        throw new AuthenticationError('Wallet address does not match token claims');
      }

      // Get current user data from database (source of truth)
      const userResult = await authDatabase.getUserByWallet(walletAddress);
      if (!userResult.success || !userResult.data) {
        throw new AuthenticationError('User not found - please re-authenticate');
      }

      // Generate new JWT with database-sourced user data
      const newTokenResult = await jwtManager.generateSupabaseJWT(
        userResult.data.id,
        walletAddress,
        (userResult.data.walletType as WalletType) || WalletType.NAMI
      );

      this.logger.info(`Token refreshed for user ${userResult.data.id}, wallet ${walletAddress.slice(0, 12)}...`);

      return {
        success: true,
        data: {
          token: newTokenResult.token,
          expiresAt: newTokenResult.expiresAt,
          walletAddress,
          walletType: (userResult.data.walletType as WalletType) || WalletType.NAMI,
          userId: userResult.data.id
        }
      };
    } catch (error) {
      this.logger.error('Token refresh failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      };
    }
  }
}

// Export singleton instance
export const cardanoAuthService = CardanoAuthService.getInstance();