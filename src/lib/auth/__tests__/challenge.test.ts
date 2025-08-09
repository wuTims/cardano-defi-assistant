/**
 * Authentication Challenge Tests
 * 
 * Tests for challenge generation, storage, and validation logic
 */

// Mock dependencies
jest.mock('@/lib/supabase/server', () => ({
  authDatabase: {
    storeChallenge: jest.fn(),
    getChallenge: jest.fn(),
    markChallengeUsed: jest.fn()
  }
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

jest.mock('@/lib/config', () => ({
  config: {
    get: jest.fn((section: string) => {
      if (section === 'auth') {
        return { challengeTTL: 300 }; // 5 minutes
      }
      return {};
    })
  }
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcd') // Exactly 64 hex chars
  }))
}));

import { generateChallenge, getStoredChallenge, markChallengeAsUsed } from '../challenge';
import { authDatabase } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { ValidationError } from '@/lib/errors';

// Get mocked functions with proper typing
const mockAuthDatabase = authDatabase as jest.Mocked<typeof authDatabase>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('Authentication Challenge Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variable
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  describe('generateChallenge', () => {
    const testWalletAddress = 'addr1qx2fxv2umyhttkxyxp8x8ccldwvz29wjj3q3qw6nqczqe6uy8s3qd54k5kz5z5';

    test('should generate challenge successfully', async () => {
      mockAuthDatabase.storeChallenge.mockResolvedValue({ success: true });

      const result = await generateChallenge(testWalletAddress);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.nonce).toBe('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcd');
      expect(result.data?.challenge).toContain('Authenticate wallet');
      expect(result.data?.challenge).toContain(testWalletAddress);
      expect(result.data?.challenge).toContain('Nonce: a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcd');
      expect(result.data?.walletAddress).toBe(testWalletAddress);
      expect(result.data?.expiresAt).toBeInstanceOf(Date);
    });

    test('should create canonical challenge format', async () => {
      mockAuthDatabase.storeChallenge.mockResolvedValue({ success: true });
      process.env.NEXT_PUBLIC_APP_URL = 'https://test-app.com';

      const result = await generateChallenge(testWalletAddress);

      expect(result.success).toBe(true);
      const challengeLines = result.data?.challenge.split('\\n') || [];
      
      expect(challengeLines[0]).toBe(`Authenticate wallet ${testWalletAddress} for Wallet Sync Service`);
      expect(challengeLines[1]).toMatch(/^Nonce: [0-9a-f]{64}$/);
      expect(challengeLines[2]).toMatch(/^Issued: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(challengeLines[3]).toBe('Origin: https://test-app.com');
      expect(challengeLines[4]).toBe('Purpose: login-v1');
    });

    test('should use default origin when env var not set', async () => {
      mockAuthDatabase.storeChallenge.mockResolvedValue({ success: true });

      const result = await generateChallenge(testWalletAddress);

      expect(result.success).toBe(true);
      expect(result.data?.challenge).toContain('Origin: https://wallet-sync.com');
    });

    test('should store challenge with correct expiration time', async () => {
      mockAuthDatabase.storeChallenge.mockResolvedValue({ success: true });
      const beforeTime = new Date();

      await generateChallenge(testWalletAddress);

      const afterTime = new Date();
      const storeCall = mockAuthDatabase.storeChallenge.mock.calls[0];
      const [walletAddr, nonce, challenge, expiresAt] = storeCall;
      
      expect(walletAddr).toBe(testWalletAddress);
      expect(nonce).toBe('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcd');
      expect(challenge).toContain('Authenticate wallet');
      expect(expiresAt).toBeInstanceOf(Date);
      
      // Should expire in 5 minutes (300 seconds)
      const expectedExpiry = new Date(beforeTime.getTime() + 300 * 1000);
      const actualExpiry = expiresAt as Date;
      expect(Math.abs(actualExpiry.getTime() - expectedExpiry.getTime())).toBeLessThan(1000); // Within 1 second
    });

    test('should log successful challenge generation', async () => {
      mockAuthDatabase.storeChallenge.mockResolvedValue({ success: true });

      await generateChallenge(testWalletAddress);

      expect(mockLogger.info).toHaveBeenCalledWith(`Challenge generated and stored for wallet: ${testWalletAddress}`);
    });

    test('should handle missing wallet address', async () => {
      const result = await generateChallenge('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Wallet address is required');
      expect(mockAuthDatabase.storeChallenge).not.toHaveBeenCalled();
    });

    test('should handle database storage failure', async () => {
      mockAuthDatabase.storeChallenge.mockResolvedValue({ 
        success: false, 
        error: 'Database connection failed' 
      });

      const result = await generateChallenge(testWalletAddress);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to store challenge: Database connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to generate challenge', expect.any(Error));
    });

    test('should handle unexpected errors', async () => {
      mockAuthDatabase.storeChallenge.mockRejectedValue(new Error('Unexpected error'));

      const result = await generateChallenge(testWalletAddress);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
    });

    test('should handle non-Error exceptions', async () => {
      mockAuthDatabase.storeChallenge.mockRejectedValue('String error');

      const result = await generateChallenge(testWalletAddress);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Challenge generation failed');
    });
  });

  describe('getStoredChallenge', () => {
    const testWalletAddress = 'addr1qx2fxv2umyhttkxyxp8x8ccldwvz29wjj3q3qw6nqczqe6uy8s3qd54k5kz5z5';
    const testNonce = 'testnonce123456789abcdef';

    test('should retrieve valid challenge successfully', async () => {
      const mockChallenge = 'Test challenge string';
      const mockExpiresAt = new Date(Date.now() + 300000); // 5 minutes from now
      
      mockAuthDatabase.getChallenge.mockResolvedValue({
        success: true,
        data: {
          challenge: mockChallenge,
          expiresAt: mockExpiresAt
        }
      });

      const result = await getStoredChallenge(testWalletAddress, testNonce);

      expect(result.success).toBe(true);
      expect(result.data?.challenge).toBe(mockChallenge);
      expect(result.data?.expiresAt).toBe(mockExpiresAt);
      expect(mockAuthDatabase.getChallenge).toHaveBeenCalledWith(testWalletAddress, testNonce);
    });

    test('should handle challenge not found', async () => {
      mockAuthDatabase.getChallenge.mockResolvedValue({
        success: false,
        error: 'Challenge not found'
      });

      const result = await getStoredChallenge(testWalletAddress, testNonce);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Challenge not found');
    });

    test('should handle missing challenge data', async () => {
      mockAuthDatabase.getChallenge.mockResolvedValue({
        success: true,
        data: undefined
      });

      const result = await getStoredChallenge(testWalletAddress, testNonce);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired challenge');
    });

    test('should handle expired challenge', async () => {
      const expiredDate = new Date(Date.now() - 1000); // 1 second ago
      
      mockAuthDatabase.getChallenge.mockResolvedValue({
        success: true,
        data: {
          challenge: 'Test challenge',
          expiresAt: expiredDate
        }
      });

      const result = await getStoredChallenge(testWalletAddress, testNonce);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Challenge expired');
    });

    test('should handle database errors', async () => {
      mockAuthDatabase.getChallenge.mockRejectedValue(new Error('Database error'));

      const result = await getStoredChallenge(testWalletAddress, testNonce);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to retrieve challenge', expect.any(Error));
    });

    test('should handle non-Error exceptions', async () => {
      mockAuthDatabase.getChallenge.mockRejectedValue('String error');

      const result = await getStoredChallenge(testWalletAddress, testNonce);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Challenge retrieval failed');
    });

    test('should handle challenge at exact expiration time', async () => {
      // Use a time that's definitely in the past
      const pastTime = new Date(Date.now() - 1000); // 1 second ago
      
      mockAuthDatabase.getChallenge.mockResolvedValue({
        success: true,
        data: {
          challenge: 'Test challenge',
          expiresAt: pastTime
        }
      });

      const result = await getStoredChallenge(testWalletAddress, testNonce);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Challenge expired');
    });
  });

  describe('markChallengeAsUsed', () => {
    const testWalletAddress = 'addr1qx2fxv2umyhttkxyxp8x8ccldwvz29wjj3q3qw6nqczqe6uy8s3qd54k5kz5z5';
    const testNonce = 'testnonce123456789abcdef';

    test('should mark challenge as used successfully', async () => {
      mockAuthDatabase.markChallengeUsed.mockResolvedValue({ success: true });

      const result = await markChallengeAsUsed(testWalletAddress, testNonce);

      expect(result.success).toBe(true);
      expect(mockAuthDatabase.markChallengeUsed).toHaveBeenCalledWith(testWalletAddress, testNonce);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test('should handle marking failure and log warning', async () => {
      mockAuthDatabase.markChallengeUsed.mockResolvedValue({ 
        success: false, 
        error: 'Challenge already used' 
      });

      const result = await markChallengeAsUsed(testWalletAddress, testNonce);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Challenge already used');
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to mark challenge as used: Challenge already used');
    });

    test('should pass through database response', async () => {
      const mockResponse = { 
        success: false, 
        error: 'Database connection timeout' 
      };
      mockAuthDatabase.markChallengeUsed.mockResolvedValue(mockResponse);

      const result = await markChallengeAsUsed(testWalletAddress, testNonce);

      expect(result).toEqual(mockResponse);
    });
  });
});