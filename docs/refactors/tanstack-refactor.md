Complete TanStack Query Migration Plan

  1. Auth State Analysis

  Our auth uses wallet signature verification with server-generated JWT:
  1. Client requests nonce from server (/api/auth/nonce)
  2. Wallet signs the nonce
  3. Server verifies signature and returns JWT (/api/auth/verify)
  4. JWT contains userId, walletAddress, walletType

  Answer: While the JWT comes from the server, the auth STATE (connected wallet, JWT storage) is client-side. The server validates, but doesn't maintain session state. This is still client state that
   belongs in Context, not TanStack Query.

  2. Complete Implementation Plan

  Phase 1: Core Infrastructure Setup

  1.1 Install Dependencies

  npm install @tanstack/react-query @tanstack/react-query-devtools

  1.2 Query Client Configuration

  // src/lib/query/query-client.ts
  import { QueryClient } from '@tanstack/react-query';
  import { logger } from '@/lib/logger';

  export const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 10 * 60 * 1000, // 10 minutes
        retry: (failureCount, error: any) => {
          if (error?.status >= 400 && error?.status < 500) return false;
          return failureCount < 3;
        },
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 1,
        onError: (error) => {
          logger.error('Mutation failed', error);
        },
      },
    },
  });

  1.3 Query Keys Factory

  // src/lib/query/query-keys.ts
  export const queryKeys = {
    all: ['cardano-wallet'] as const,

    wallet: {
      all: () => [...queryKeys.all, 'wallet'] as const,
      detail: (address: string) => [...queryKeys.wallet.all(), address] as const,
    },

    transactions: {
      all: () => [...queryKeys.all, 'transactions'] as const,
      list: (address: string, filters?: TransactionFilters) =>
        [...queryKeys.transactions.all(), address, filters] as const,
    },

    sync: {
      status: (address: string) => [...queryKeys.all, 'sync', address] as const,
    },
  } as const;

  Phase 2: API Layer (Following Current Patterns)

  2.1 Wallet API Service

  // src/services/wallet-api.ts
  import { logger } from '@/lib/logger';
  import type { WalletData, SyncResult } from '@/types/wallet';

  export class WalletApiService {
    private abortControllers = new Map<string, AbortController>();

    async fetchWalletData(address: string, token: string): Promise<WalletData | null> {
      try {
        const response = await fetch(`/api/wallet/${address}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          signal: this.getSignal(`wallet-${address}`),
        });

        if (!response.ok) {
          if (response.status === 404) return null;
          throw new Error(`Failed to fetch wallet: ${response.status}`);
        }

        return response.json();
      } catch (error) {
        logger.error('Failed to fetch wallet data', error);
        throw error;
      }
    }

    async syncWallet(address: string, token: string): Promise<SyncResult> {
      const response = await fetch('/api/wallet/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: this.getSignal(`sync-${address}`),
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }

      return response.json();
    }

    cancelRequest(key: string) {
      this.abortControllers.get(key)?.abort();
    }

    private getSignal(key: string): AbortSignal {
      this.cancelRequest(key);
      const controller = new AbortController();
      this.abortControllers.set(key, controller);
      return controller.signal;
    }
  }

  export const walletApiService = new WalletApiService();

  2.2 Transaction API Service

  // src/services/transaction-api.ts
  import { logger } from '@/lib/logger';
  import type { WalletTransaction, TransactionFilters } from '@/types/transaction';

  interface TransactionResponse {
    transactions: WalletTransaction[];
    hasMore: boolean;
    total: number;
  }

  export class TransactionApiService {
    async fetchTransactions(
      address: string,
      token: string,
      page: number = 0,
      pageSize: number = 50,
      filters?: TransactionFilters
    ): Promise<TransactionResponse> {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (filters?.action) params.append('action', filters.action);
      if (filters?.protocol) params.append('protocol', filters.protocol);
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);

      const response = await fetch(`/api/transactions?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch transactions: ${response.status}`);
      }

      return response.json();
    }
  }

  export const transactionApiService = new TransactionApiService();

  Phase 3: Query Hooks (Following SOLID Principles)

  3.1 Wallet Hooks

  // src/hooks/queries/use-wallet-query.ts
  import { useQuery } from '@tanstack/react-query';
  import { useAuth } from '@/context/AuthContext';
  import { walletApiService } from '@/services/wallet-api';
  import { queryKeys } from '@/lib/query/query-keys';

  export function useWalletQuery() {
    const { user, token } = useAuth();

    return useQuery({
      queryKey: queryKeys.wallet.detail(user?.walletAddress || ''),
      queryFn: () => walletApiService.fetchWalletData(
        user!.walletAddress,
        token!.accessToken
      ),
      enabled: !!user?.walletAddress && !!token,
      staleTime: 2 * 60 * 1000, // 2 minutes
    });
  }

  3.2 Sync Mutation Hook

  // src/hooks/mutations/use-sync-mutation.ts
  import { useMutation, useQueryClient } from '@tanstack/react-query';
  import { useAuth } from '@/context/AuthContext';
  import { walletApiService } from '@/services/wallet-api';
  import { queryKeys } from '@/lib/query/query-keys';
  import { logger } from '@/lib/logger';

  export function useSyncMutation() {
    const queryClient = useQueryClient();
    const { user, token } = useAuth();

    return useMutation({
      mutationFn: () => {
        if (!user?.walletAddress || !token) {
          throw new Error('Not authenticated');
        }
        return walletApiService.syncWallet(user.walletAddress, token.accessToken);
      },

      onMutate: async () => {
        // Set syncing state optimistically
        queryClient.setQueryData(
          queryKeys.sync.status(user?.walletAddress || ''),
          { isSyncing: true, progress: 0 }
        );
      },

      onSuccess: (result) => {
        logger.info('Sync completed', result);

        // Invalidate wallet and transaction queries
        queryClient.invalidateQueries(queryKeys.wallet.all());
        queryClient.invalidateQueries(queryKeys.transactions.all());

        // Update sync status
        queryClient.setQueryData(
          queryKeys.sync.status(user?.walletAddress || ''),
          {
            isSyncing: false,
            lastSyncAt: new Date(),
            blockHeight: result.transactions.blockHeight,
          }
        );
      },

      onError: (error) => {
        logger.error('Sync failed', error);

        // Reset sync status
        queryClient.setQueryData(
          queryKeys.sync.status(user?.walletAddress || ''),
          { isSyncing: false, error: error.message }
        );
      },
    });
  }

  3.3 Transactions Hook with Pagination

  // src/hooks/queries/use-transactions-query.ts
  import { useInfiniteQuery } from '@tanstack/react-query';
  import { useState, useMemo } from 'react';
  import { useAuth } from '@/context/AuthContext';
  import { transactionApiService } from '@/services/transaction-api';
  import { queryKeys } from '@/lib/query/query-keys';
  import type { TransactionFilters } from '@/types/transaction';

  export function useTransactionsQuery() {
    const { user, token } = useAuth();
    const [filters, setFilters] = useState<TransactionFilters>({});

    const query = useInfiniteQuery({
      queryKey: queryKeys.transactions.list(user?.walletAddress || '', filters),
      queryFn: ({ pageParam = 0 }) =>
        transactionApiService.fetchTransactions(
          user!.walletAddress,
          token!.accessToken,
          pageParam,
          50,
          filters
        ),
      enabled: !!user?.walletAddress && !!token,
      getNextPageParam: (lastPage, pages) =>
        lastPage.hasMore ? pages.length : undefined,
    });

    const transactions = useMemo(
      () => query.data?.pages.flatMap(page => page.transactions) ?? [],
      [query.data]
    );

    return {
      transactions,
      isLoading: query.isLoading,
      isError: query.isError,
      error: query.error,
      hasNextPage: query.hasNextPage,
      isFetchingNextPage: query.isFetchingNextPage,
      fetchNextPage: query.fetchNextPage,
      filters,
      setFilters,
      clearFilters: () => setFilters({}),
    };
  }

  Phase 4: Provider Setup

  4.1 Query Provider

  // src/providers/query-provider.tsx
  'use client';

  import { QueryClientProvider } from '@tanstack/react-query';
  import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
  import { queryClient } from '@/lib/query/query-client';

  export function QueryProvider({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </QueryClientProvider>
    );
  }

  4.2 Updated Root Layout

  // src/app/layout.tsx
  'use client';

  import { AuthProvider } from '@/context/AuthContext';
  import { SupabaseProvider } from '@/context/SupabaseProvider';
  import { QueryProvider } from '@/providers/query-provider';

  export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
      <html lang="en">
        <body>
          <AuthProvider>
            <SupabaseProvider>
              <QueryProvider>
                {children}
              </QueryProvider>
            </SupabaseProvider>
          </AuthProvider>
        </body>
      </html>
    );
  }

  Phase 5: Component Updates

  5.1 Updated WalletDashboard

  // src/components/dashboard/WalletDashboard.tsx
  'use client';

  import { useAuth } from '@/context/AuthContext';
  import { useWalletQuery } from '@/hooks/queries/use-wallet-query';
  import { useSyncMutation } from '@/hooks/mutations/use-sync-mutation';
  import { useTransactionsQuery } from '@/hooks/queries/use-transactions-query';

  export function WalletDashboard() {
    const { isAuthenticated, user } = useAuth();
    const { data: walletData, isLoading: isLoadingWallet } = useWalletQuery();
    const syncMutation = useSyncMutation();
    const {
      transactions,
      isLoading: isLoadingTx,
      fetchNextPage,
      hasNextPage,
    } = useTransactionsQuery();

    if (!isAuthenticated) {
      return <WelcomeMessage />;
    }

    const handleSync = () => {
      syncMutation.mutate();
    };

    return (
      <div>
        <button 
          onClick={handleSync}
          disabled={syncMutation.isLoading}
        >
          {syncMutation.isLoading ? 'Syncing...' : 'Sync Wallet'}
        </button>

        {walletData && <WalletOverview data={walletData} />}

        <TransactionList 
          transactions={transactions}
          isLoading={isLoadingTx}
          onLoadMore={fetchNextPage}
          hasMore={hasNextPage}
        />
      </div>
    );
  }

  Phase 6: Fix Current Issues

  6.1 Fix Race Condition

  // src/hooks/queries/use-initial-sync.ts
  import { useEffect } from 'react';
  import { useAuth } from '@/context/AuthContext';
  import { useSyncMutation } from '@/hooks/mutations/use-sync-mutation';
  import { useQueryClient } from '@tanstack/react-query';

  export function useInitialSync() {
    const { isAuthenticated, user } = useAuth();
    const syncMutation = useSyncMutation();
    const queryClient = useQueryClient();

    useEffect(() => {
      if (isAuthenticated && user?.walletAddress) {
        // Check if we have wallet data
        const hasWalletData = queryClient.getQueryData(
          queryKeys.wallet.detail(user.walletAddress)
        );

        // Only sync if no wallet data exists
        if (!hasWalletData && !syncMutation.isLoading) {
          syncMutation.mutate();
        }
      }
    }, [isAuthenticated, user?.walletAddress]);
  }

  6.2 Add Abort on Unmount

  // src/hooks/use-cleanup.ts
  import { useEffect } from 'react';
  import { walletApiService } from '@/services/wallet-api';

  export function useCleanup(key: string) {
    useEffect(() => {
      return () => {
        walletApiService.cancelRequest(key);
      };
    }, [key]);
  }

  Migration Steps

  1. Day 1: Install TanStack Query, create query client and keys
  2. Day 2: Create API service layer (wallet-api, transaction-api)
  3. Day 3: Implement query hooks (useWalletQuery, useSyncMutation)
  4. Day 4: Update components to use new hooks
  5. Day 5: Remove old contexts (WalletProvider, SyncContext, TransactionContext)
  6. Day 6: Add error boundaries and suspense
  7. Day 7: Test and optimize

  What We Keep vs Remove

  Keep:
  - AuthContext - Client-side auth state
  - SupabaseProvider - Database client instance
  - Current API routes - They work fine

  Remove:
  - WalletProvider - Replaced by useWalletQuery
  - SyncContext - Replaced by useSyncMutation
  - TransactionContext - Replaced by useTransactionsQuery

  Benefits:
  - No race conditions
  - Automatic request cancellation
  - Built-in caching
  - Optimistic updates
  - Better performance
  - Cleaner code