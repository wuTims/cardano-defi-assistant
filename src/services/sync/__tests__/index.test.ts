/**
 * Wallet Sync Service Tests
 */

import { walletSyncService } from '../index';

// Mock Supabase client
const mockSupabaseResponse = {
  data: null as any,
  error: null as any
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => mockSupabaseResponse)
        }))
      })),
      upsert: jest.fn(() => mockSupabaseResponse),
      delete: jest.fn(() => ({
        eq: jest.fn(() => mockSupabaseResponse)
      })),
      insert: jest.fn(() => mockSupabaseResponse)
    }))
  }))
}));

// Mock config
jest.mock('../../../lib/config', () => ({
  config: {
    get: jest.fn((section) => {
      switch (section) {
        case 'database':
          return {
            supabaseUrl: 'https://test.supabase.co',
            supabaseServiceKey: 'test-key'
          };
        case 'api':
          return {
            blockfrostUrl: 'https://test-blockfrost.com',
            blockfrostKey: 'test-blockfrost-key',
            maxConcurrentRequests: 5
          };
        case 'wallet':
          return {
            syncInterval: 3600,
            maxRetries: 3,
            retryDelay: 1000
          };
        default:
          return {};
      }
    })
  }
}));

// Mock fetch
global.fetch = jest.fn();

describe('WalletSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('syncWallet', () => {
    it('should fail when wallet address is empty', async () => {
      const result = await walletSyncService.syncWallet('');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should prevent duplicate syncs', async () => {
      const walletAddress = 'addr1test123';

      // Mock fetch to return valid responses
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            amount: [{ unit: 'lovelace', quantity: '1000000' }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([])
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ height: 12345 })
        });

      // Start first sync (don't wait)
      const firstSync = walletSyncService.syncWallet(walletAddress);
      
      // Immediately start second sync
      const secondSync = await walletSyncService.syncWallet(walletAddress);

      expect(secondSync.success).toBe(false);
      expect(secondSync.error).toBe('Sync already in progress');

      // Wait for first sync to complete
      await firstSync;
    });
  });

  describe('getWalletData', () => {
    it('should return null when wallet not found', async () => {
      mockSupabaseResponse.data = null;
      mockSupabaseResponse.error = { message: 'Not found' };

      const result = await walletSyncService.getWalletData('nonexistent');

      expect(result).toBeNull();
    });

    it('should return wallet data when found', async () => {
      const mockWalletData = {
        address: 'addr1test123',
        balance_lovelace: '1000000',
        last_synced_at: new Date().toISOString(),
        synced_block_height: 12345,
        wallet_assets: [],
        wallet_utxos: []
      };

      mockSupabaseResponse.data = mockWalletData;
      mockSupabaseResponse.error = null;

      const result = await walletSyncService.getWalletData('addr1test123');

      expect(result).toBeDefined();
      expect(result?.address).toBe('addr1test123');
      expect(result?.balance.lovelace).toBe('1000000');
    });
  });

  describe('shouldSync', () => {
    it('should return true when wallet never synced', async () => {
      mockSupabaseResponse.data = null;
      mockSupabaseResponse.error = { message: 'Not found' };

      const result = await walletSyncService.shouldSync('new-wallet');

      expect(result).toBe(true);
    });

    it('should return false when recently synced', async () => {
      const recentSync = new Date();
      mockSupabaseResponse.data = {
        address: 'addr1test123',
        balance_lovelace: '1000000',
        last_synced_at: recentSync.toISOString(),
        synced_block_height: 12345,
        wallet_assets: [],
        wallet_utxos: []
      };
      mockSupabaseResponse.error = null;

      const result = await walletSyncService.shouldSync('addr1test123');

      expect(result).toBe(false);
    });
  });

  describe('getSyncStatus', () => {
    it('should return current sync status', () => {
      const status = walletSyncService.getSyncStatus();

      expect(status).toBeDefined();
      expect(typeof status.queueSize).toBe('number');
      expect(Array.isArray(status.activeAddresses)).toBe(true);
    });
  });
});