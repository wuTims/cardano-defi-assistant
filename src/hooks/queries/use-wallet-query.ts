import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { walletApiService } from '@/services/wallet-api';
import { queryKeys } from '@/lib/query/query-keys';
import type { WalletData } from '@/core/types/wallet';

/**
 * Hook to fetch wallet data
 * 
 * Replaces WalletProvider's data fetching logic with TanStack Query.
 * Only runs when user is authenticated with a valid token.
 * 
 * Features:
 * - Auto-refetch on mount
 * - Proper error handling
 * - Request cancellation on unmount
 * - Type-safe wallet data
 */
export function useWalletQuery() {
  const { user, token: authData } = useAuth();

  return useQuery<WalletData | null, Error>({
    queryKey: queryKeys.wallet.detail(user?.walletAddress || ''),
    queryFn: async () => {
      if (!authData?.token) {
        return null;
      }
      return walletApiService.fetchWalletData(authData.token);
    },
    // Only run query if authenticated with wallet address
    enabled: !!user?.walletAddress && !!authData?.token,
    staleTime: 2 * 60 * 1000, // Consider data stale after 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error.message === 'Authentication failed') {
        return false;
      }
      // Retry up to 3 times for other errors
      return failureCount < 3;
    },
  });
}

/**
 * Hook to get wallet data with simplified interface
 * 
 * Provides a simpler API for components that just need wallet data
 */
export function useWallet() {
  const { data: walletData, isLoading, error, refetch } = useWalletQuery();

  return {
    walletData,
    isLoading,
    error,
    refreshWalletData: refetch,
  };
}