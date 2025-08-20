import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { walletApiService } from '@/services/wallet-api';
import { queryKeys } from '@/lib/query/query-keys';
import { logger } from '@/lib/logger';
import type { SyncJobResponse } from '@/core/types/wallet';

/**
 * Hook for wallet sync mutation
 * 
 * Queues a sync job in BullMQ and returns job information.
 * The actual sync happens asynchronously in the background worker.
 * 
 * Features:
 * - BullMQ job queue integration
 * - Returns job ID for status tracking
 * - Immediate cached data response for seamless UX
 * - Proper error handling for queue operations
 */
export function useSyncMutation() {
  const queryClient = useQueryClient();
  const { user, token: authData } = useAuth();

  return useMutation<SyncJobResponse, Error, void>({
    mutationFn: async () => {
      if (!user?.walletAddress || !authData?.token) {
        throw new Error('Not authenticated');
      }
      return walletApiService.syncWallet(authData.token);
    },

    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ 
        queryKey: queryKeys.wallet.all() 
      });
      await queryClient.cancelQueries({ 
        queryKey: queryKeys.transactions.all() 
      });

      // Set optimistic sync status
      if (user?.walletAddress) {
        queryClient.setQueryData(
          queryKeys.sync.status(user.walletAddress),
          { 
            isSyncing: true, 
            progress: 0,
            message: 'Starting sync...'
          }
        );
      }

      logger.info('Sync started');
    },

    onSuccess: (result) => {
      if (result.jobId) {
        logger.info(`Sync job queued: ${result.jobId}`);
      } else if (result.error) {
        logger.error(`Sync failed: ${result.error}`);
      }

      if (user?.walletAddress) {
        // Update sync status with job info
        queryClient.setQueryData(
          queryKeys.sync.status(user.walletAddress),
          {
            isSyncing: result.status === 'processing',
            jobId: result.jobId,
            status: result.status,
            message: result.message,
          }
        );

        // If cached data was returned, update the wallet data
        if (result.cachedData) {
          queryClient.setQueryData(
            queryKeys.wallet.detail(user.walletAddress),
            result.cachedData
          );
        }
      }
    },

    onError: (error) => {
      logger.error({ err: error }, 'Sync failed');

      if (user?.walletAddress) {
        // Reset sync status on error
        queryClient.setQueryData(
          queryKeys.sync.status(user.walletAddress),
          { 
            isSyncing: false, 
            error: error.message 
          }
        );
      }
    },

    retry: (failureCount, error) => {
      // Don't retry certain errors
      const noRetryErrors = ['Sync already in progress', 'Request cancelled', 'Not authenticated'];
      if (noRetryErrors.includes(error.message)) {
        return false;
      }
      // Retry once for other errors
      return failureCount < 1;
    },
  });
}

/**
 * Hook for manual sync trigger
 * 
 * Provides a simple interface for triggering sync from components
 */
export function useManualSync() {
  const mutation = useSyncMutation();

  return {
    sync: mutation.mutate,
    syncAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    canSync: !mutation.isPending,
    error: mutation.error,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}