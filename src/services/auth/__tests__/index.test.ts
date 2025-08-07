/**
 * Authentication Service Tests
 */

import { authService } from '../index';
import { WalletSignatureArgs } from '../../../types/auth';

// Mock JWT to avoid requiring JWT_SECRET in tests
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-jwt-token'),
  verify: jest.fn(() => ({
    walletAddress: 'addr1test123',
    walletType: 'nami',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  }))
}));

// Mock config
jest.mock('../../../lib/config', () => ({
  config: {
    get: jest.fn((section) => {
      switch (section) {
        case 'auth':
          return {
            jwtSecret: 'test-secret',
            jwtAlgorithm: 'HS256',
            tokenExpiresIn: 3600,
            challengeTTL: 300
          };
        default:
          return {};
      }
    })
  }
}));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateChallenge', () => {
    it('should generate valid challenge for wallet address', () => {
      const walletAddress = 'addr1test123';
      const result = authService.generateChallenge(walletAddress);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.walletAddress).toBe(walletAddress);
      expect(result.data?.nonce).toBeDefined();
      expect(result.data?.challenge).toContain(walletAddress);
      expect(result.data?.expiresAt).toBeDefined();
    });

    it('should fail when wallet address is empty', () => {
      const result = authService.generateChallenge('');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('verifySignatureAndGenerateToken', () => {
    it('should verify signature and generate token', async () => {
      // First generate a challenge
      const walletAddress = 'addr1test123';
      const challengeResult = authService.generateChallenge(walletAddress);
      expect(challengeResult.success).toBe(true);

      const signatureData: WalletSignatureArgs = {
        address: walletAddress,
        signature: 'a'.repeat(128), // Valid length signature
        key: 'b'.repeat(64), // Valid length key
        nonce: challengeResult.data!.nonce
      };

      const result = await authService.verifySignatureAndGenerateToken(signatureData, 'nami');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.token).toBeDefined();
      expect(result.data?.walletAddress).toBe(walletAddress);
      expect(result.data?.walletType).toBe('nami');
    });

    it('should fail with invalid nonce', async () => {
      const signatureData: WalletSignatureArgs = {
        address: 'addr1test123',
        signature: 'a'.repeat(128),
        key: 'b'.repeat(64),
        nonce: 'invalid-nonce'
      };

      const result = await authService.verifySignatureAndGenerateToken(signatureData, 'nami');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('verifyToken', () => {
    it('should verify valid JWT token', () => {
      const token = 'mock-jwt-token';
      const result = authService.verifyToken(token);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.walletAddress).toBe('addr1test123');
      expect(result.data?.walletType).toBe('nami');
    });

    it('should fail with empty token', () => {
      const result = authService.verifyToken('');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getChallengeCount', () => {
    it('should return current challenge count', () => {
      const count = authService.getChallengeCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});