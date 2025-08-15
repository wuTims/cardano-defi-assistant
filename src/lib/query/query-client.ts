import { QueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.status >= 400 && error?.status < 500) return false;
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: 'always',
    },
    mutations: {
      retry: 0, // Let individual mutations handle their own retry logic
      onError: (error) => {
        logger.error('Mutation failed', error);
      },
    },
  },
});

// Helper function to invalidate queries after successful mutations
export const invalidateWalletQueries = () => {
  queryClient.invalidateQueries({ queryKey: ['cardano-wallet'] });
};

export const invalidateTransactionQueries = () => {
  queryClient.invalidateQueries({ queryKey: ['cardano-wallet', 'transactions'] });
};