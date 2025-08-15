import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { walletApiService } from '@/services/wallet-api';
import { queryKeys } from '@/lib/query/query-keys';
import { logger } from '@/lib/logger';
import type { SyncResult } from '@/types/wallet';

/**
 * Hook for wallet sync mutation
 * 
 * Replaces SyncContext's sync logic with TanStack Query mutation.
 * Handles optimistic updates, error recovery, and cache invalidation.
 * 
 * Features:
 * - Optimistic UI updates
 * - Automatic cache invalidation on success
 * - Proper error handling
 * - Progress tracking capability
 */
export function useSyncMutation() {
  const queryClient = useQueryClient();
  const { user, token: authData } = useAuth();

  return useMutation<SyncResult, Error, void>({
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
      logger.info(`Sync completed: ${result.transactions.count} transactions, block ${result.transactions.blockHeight}`);

      if (user?.walletAddress) {
        // Update sync status
        queryClient.setQueryData(
          queryKeys.sync.status(user.walletAddress),
          {
            isSyncing: false,
            lastSyncAt: result.syncedAt,
            blockHeight: result.transactions.blockHeight,
          }
        );

        // Invalidate all wallet and transaction queries to refetch fresh data
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.wallet.detail(user.walletAddress) 
        });
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.transactions.all() 
        });
      }
    },

    onError: (error) => {
      logger.error('Sync failed', error);

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