import { logger } from '@/lib/logger';
import type { WalletData, SyncResult } from '@/types/wallet';

/**
 * Wallet API Service
 * 
 * Handles all wallet-related API calls with proper error handling,
 * request cancellation, and auth token management.
 * 
 * Features:
 * - Abort controller management for request cancellation
 * - Type-safe API responses
 * - Centralized error handling
 * - Auth token injection
 */
export class WalletApiService {
  private abortControllers = new Map<string, AbortController>();

  /**
   * Fetch wallet data from API
   */
  async fetchWalletData(token: string): Promise<WalletData | null> {
    if (!token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch('/api/wallet', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: this.getSignal('wallet'),
      });

      if (!response.ok) {
        if (response.status === 404) {
          logger.info('No wallet data found');
          return null;
        }
        if (response.status === 401) {
          throw new Error('Authentication failed');
        }
        throw new Error(`Failed to fetch wallet: ${response.status}`);
      }

      const data = await response.json();
      
      // Defensive check - address should always be present from our API
      if (!data.address) {
        logger.error('API returned wallet data without address', data);
        throw new Error('Invalid wallet data: missing address');
      }
      
      // Transform API response to WalletData type
      const walletData: WalletData = {
        address: data.address,
        balance: {
          lovelace: data.balance?.lovelace || '0',
          assets: data.balance?.assets || [],
        },
        utxos: data.utxos || [],
        lastSyncedAt: data.lastSyncedAt ? new Date(data.lastSyncedAt) : null,
        syncedBlockHeight: data.syncedBlockHeight || 0,
      };

      logger.info('Wallet data fetched successfully');
      return walletData;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.info('Wallet request cancelled');
        throw new Error('Request cancelled');
      }
      logger.error('Failed to fetch wallet data', error);
      throw error;
    }
  }

  /**
   * Sync wallet with blockchain
   */
  async syncWallet(token: string): Promise<SyncResult> {
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch('/api/wallet/sync', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: this.getSignal('sync'),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication failed');
      }
      if (response.status === 409) {
        throw new Error('Sync already in progress');
      }
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Sync failed: ${response.status}`);
    }

    const result = await response.json();
    
    // Ensure proper typing
    const syncResult: SyncResult = {
      success: result.success,
      syncedAt: new Date(result.syncedAt),
      transactions: {
        count: result.transactions?.count || 0,
        blockHeight: result.transactions?.blockHeight || 0,
      },
      wallet: {
        balance: result.wallet?.balance || '0',
        assets: result.wallet?.assets || 0,
      },
      error: result.error,
    };

    return syncResult;
  }


  /**
   * Cancel a specific request
   */
  cancelRequest(key: string) {
    const controller = this.abortControllers.get(key);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(key);
      logger.info(`Cancelled request: ${key}`);
    }
  }

  /**
   * Cancel all requests
   */
  cancelAllRequests() {
    this.abortControllers.forEach((controller, key) => {
      controller.abort();
      logger.info(`Cancelled request: ${key}`);
    });
    this.abortControllers.clear();
  }

  /**
   * Get abort signal for a request
   */
  private getSignal(key: string): AbortSignal {
    // Simple: cancel old, create new
    this.cancelRequest(key);
    
    const controller = new AbortController();
    this.abortControllers.set(key, controller);
    
    return controller.signal;
  }
}

// Singleton instance
export const walletApiService = new WalletApiService();