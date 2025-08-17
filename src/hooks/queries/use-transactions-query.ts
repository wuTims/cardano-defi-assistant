import { useInfiniteQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { transactionApi } from '@/services/transaction-api';
import { queryKeys } from '@/lib/query/query-keys';
import type { TransactionFilters, WalletTransaction } from '@/types/transaction';

/**
 * Hook for fetching transactions with infinite scrolling
 * 
 * Replaces TransactionContext with TanStack Query's infinite query.
 * Handles pagination, filtering, and automatic fetching.
 * 
 * Features:
 * - Infinite scrolling support
 * - Client-side and server-side filtering
 * - Automatic page fetching
 * - Optimized re-renders
 */
export function useTransactionsQuery(pageSize: number = 50) {
  const { user, token: authData } = useAuth();
  const [filters, setFilters] = useState<TransactionFilters>({});

  const query = useInfiniteQuery({
    queryKey: queryKeys.transactions.infinite(user?.walletAddress || '', filters),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!user?.walletAddress || !authData?.token) {
        return { 
          transactions: [], 
          hasMore: false, 
          total: 0, 
          page: 0, 
          pageSize 
        };
      }

      return transactionApi.fetchTransactions(
        user.walletAddress,
        authData.token,
        pageParam,
        pageSize,
        filters
      );
    },
    enabled: !!user?.walletAddress && !!authData?.token,
    getNextPageParam: (lastPage) => {
      // Return next page number if there are more pages
      return lastPage.hasMore ? lastPage.page + 1 : undefined;
    },
    staleTime: 1 * 60 * 1000, // Consider data stale after 1 minute
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  // Flatten all pages into a single transaction array
  const transactions = useMemo(
    () => query.data?.pages.flatMap(page => page.transactions) ?? [],
    [query.data]
  );

  // Calculate total count
  const totalCount = query.data?.pages[0]?.total || 0;

  return {
    // Data
    transactions,
    totalCount,
    
    // Loading states
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    isRefetching: query.isRefetching,
    
    // Error handling
    isError: query.isError,
    error: query.error,
    
    // Pagination
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    
    // Filtering
    filters,
    setFilters,
    clearFilters: () => setFilters({}),
    
    // Refetch
    refetch: query.refetch,
  };
}

/**
 * Simplified hook for transaction list components
 */
export function useTransactionList() {
  const {
    transactions,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    filters,
    setFilters,
    clearFilters,
  } = useTransactionsQuery();

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      console.log('Loading more transactions...');
      fetchNextPage();
    }
  };

  return {
    transactions,
    isLoading,
    isError,
    error,
    hasMore: hasNextPage || false,
    loadMore: handleLoadMore,
    isLoadingMore: isFetchingNextPage,
    filters,
    setFilters,
    clearFilters,
  };
}