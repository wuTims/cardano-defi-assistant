import { logger } from '@/lib/logger';
import type { WalletData, SyncJobResponse, SyncJobStatus } from '@/core/types/wallet';

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
        logger.error({ data }, 'API returned wallet data without address');
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
      logger.error({ err: error }, 'Failed to fetch wallet data');
      throw error;
    }
  }

  /**
   * Queue wallet sync job
   * Returns job information instead of blocking for sync to complete
   */
  async syncWallet(token: string): Promise<SyncJobResponse> {
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

    const result: SyncJobResponse = await response.json();
    return result;
  }

  /**
   * Check sync job status
   */
  async getSyncJobStatus(token: string, jobId: string): Promise<SyncJobStatus> {
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`/api/wallet/sync?jobId=${jobId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: this.getSignal('sync-status'),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication failed');
      }
      if (response.status === 404) {
        throw new Error('Job not found');
      }
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to get job status: ${response.status}`);
    }

    const result = await response.json();
    
    // Transform response to SyncJobStatus type
    const jobStatus: SyncJobStatus = {
      id: result.job.id,
      status: result.job.status,
      progress: result.job.progress,
      createdAt: new Date(result.job.createdAt),
      startedAt: result.job.startedAt ? new Date(result.job.startedAt) : undefined,
      completedAt: result.job.completedAt ? new Date(result.job.completedAt) : undefined,
      error: result.job.error,
      retryCount: result.job.retryCount,
    };

    return jobStatus;
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