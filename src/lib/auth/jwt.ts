/**
 * JWT Token Management Utilities
 * 
 * Handles JWT creation, verification, and token management for Supabase integration.
 * Generates Supabase-compatible JWTs with proper claims structure.
 */

import jwt from 'jsonwebtoken';
import { createPublicKey, type JsonWebKey } from 'crypto';
import { config } from '@/lib/config';
import { AuthenticationError, ValidationError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { AuthServiceResponse, WalletType, SupabaseJWTPayload } from '@/types/auth';

/**
 * JWT Manager class for handling token operations
 */
export class JWTManager {
  private static instance: JWTManager;
  private privateJWK: JsonWebKey | null = null;
  private publicKeyPem: string = '';

  private constructor() {
    // Prevent client-side instantiation
    if (typeof window !== 'undefined' && typeof global === 'undefined') {
      throw new Error('JWTManager can only be instantiated on the server');
    }
    
    this.initializeJWK();
  }

  public static getInstance(): JWTManager {
    if (!JWTManager.instance) {
      JWTManager.instance = new JWTManager();
    }
    return JWTManager.instance;
  }

  /**
   * Initialize private JWK from base64-encoded environment variable
   */
  private initializeJWK(): void {
    try {
      const authConfig = config.get('auth');
      
      if (!authConfig.jwtSecret) {
        throw new ValidationError('JWT_SECRET is required for Supabase authentication');
      }

      // Decode base64-encoded JWK
      const jwkJson = Buffer.from(authConfig.jwtSecret, 'base64').toString('utf-8');
      this.privateJWK = JSON.parse(jwkJson);

      // Validate JWK structure
      if (!this.privateJWK?.kty || !this.privateJWK?.d) {
        throw new ValidationError('Invalid JWK format - missing required fields');
      }

      // Extract public key for verification
      this.extractPublicKey();

      logger.info('Private JWK initialized for Supabase JWT signing');
    } catch (error) {
      logger.error('Failed to initialize private JWK', error);
      throw new ValidationError(`JWK initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract public key from private JWK for secure token verification
   */
  private extractPublicKey(): void {
    try {
      if (!this.privateJWK) {
        throw new ValidationError('Private JWK not initialized');
      }
      
      // Create a public key from the private JWK
      const publicKey = createPublicKey({
        key: this.privateJWK,
        format: 'jwk'
      });
      
      // Export as PEM for jwt.verify
      this.publicKeyPem = publicKey.export({
        type: 'spki',
        format: 'pem'
      }) as string;
      
      logger.info('Public key extracted from private JWK for secure verification');
    } catch (error) {
      logger.error('Failed to extract public key from JWK', error);
      throw new ValidationError(`Public key extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate Supabase-verifiable JWT with proper claims structure
   */
  public async generateSupabaseJWT(
    userId: string,
    walletAddress: string,
    walletType: WalletType
  ): Promise<{ token: string; expiresAt: Date }> {
    const authConfig = config.get('auth');
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = new Date((now + authConfig.tokenExpiresIn) * 1000);

    // Supabase-compatible JWT payload
    const payload: SupabaseJWTPayload = {
      iss: authConfig.supabaseIssuer, // https://project.supabase.co/auth/v1
      sub: userId, // UUID from app_users.id
      aud: 'authenticated', // Required for Supabase
      role: 'authenticated', // Required for Supabase RLS
      addr: walletAddress, // Custom claim for wallet-specific policies
      wallet_type: walletType, // Optional custom claim
      iat: now,
      exp: now + authConfig.tokenExpiresIn
    };

    // JWT header with KID for Supabase JWKS verification
    const header = {
      alg: authConfig.jwtAlgorithm, // ES256
      typ: 'JWT',
      kid: authConfig.jwtKid // Key ID from Supabase dashboard
    };

    // Sign JWT with private key in the correct format for the algorithm
    let signingKey: JsonWebKey | any;
    if (authConfig.jwtAlgorithm === 'ES256') {
      // For ECDSA, convert JWK to PEM format
      const { createPrivateKey } = require('crypto');
      signingKey = createPrivateKey({ key: this.privateJWK!, format: 'jwk' });
    } else {
      // For HMAC algorithms, use the JWK directly
      signingKey = this.privateJWK;
    }
    
    const token = jwt.sign(payload, signingKey, {
      algorithm: authConfig.jwtAlgorithm as jwt.Algorithm,
      header
    });

    return { token, expiresAt };
  }

  /**
   * Verify JWT token authenticity and extract user claims
   * 
   * Validates Supabase-compatible JWT tokens using the public key extracted from
   * the private JWK. Ensures token was issued by this service, has not expired,
   * and contains valid user claims.
   * 
   * @param token - JWT token string to verify
   * @returns Promise resolving to user data from token claims or error response
   * 
   * @example
   * ```typescript
   * const result = await jwtManager.verifyToken(jwtToken);
   * if (result.success) {
   *   console.log('User ID:', result.data.userId);
   *   console.log('Wallet Address:', result.data.walletAddress);
   *   console.log('Wallet Type:', result.data.walletType);
   * }
   * ```
   * 
   * @throws {ValidationError} When token is missing or public key unavailable
   * @throws {AuthenticationError} When token is invalid, expired, or malformed
   */
  public async verifyToken(token: string): Promise<AuthServiceResponse<{ 
    userId: string; 
    walletAddress: string; 
    walletType?: string; 
  }>> {
    try {
      if (!token) {
        throw new ValidationError('Token is required');
      }

      if (!this.publicKeyPem) {
        throw new ValidationError('Public key not available for verification');
      }

      // Use public key for secure verification (not private key)
      const decoded = jwt.verify(token, this.publicKeyPem, {
        algorithms: [config.get('auth').jwtAlgorithm as jwt.Algorithm],
        issuer: config.get('auth').supabaseIssuer,
        audience: 'authenticated'
      }) as SupabaseJWTPayload;

      if (!decoded.sub || !decoded.addr) {
        throw new AuthenticationError('Invalid token payload');
      }

      return {
        success: true,
        data: {
          userId: decoded.sub,
          walletAddress: decoded.addr,
          walletType: decoded.wallet_type as WalletType
        }
      };
    } catch (error) {
      logger.error('Token verification failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token verification failed'
      };
    }
  }
}

// Export singleton instance
export const jwtManager = JWTManager.getInstance();