import type { TransactionFilters } from '@/types/transaction';

/**
 * Centralized query keys factory for TanStack Query
 * 
 * This ensures consistent query key structure across the application
 * and makes cache invalidation predictable and maintainable.
 * 
 * Key structure follows a hierarchical pattern:
 * ['cardano-wallet'] - root namespace
 * ['cardano-wallet', 'wallet'] - wallet data
 * ['cardano-wallet', 'transactions'] - transaction data
 * ['cardano-wallet', 'sync'] - sync status
 */
export const queryKeys = {
  all: ['cardano-wallet'] as const,

  wallet: {
    all: () => [...queryKeys.all, 'wallet'] as const,
    detail: (address: string) => [...queryKeys.wallet.all(), address] as const,
    balance: (address: string) => [...queryKeys.wallet.detail(address), 'balance'] as const,
    assets: (address: string) => [...queryKeys.wallet.detail(address), 'assets'] as const,
  },

  transactions: {
    all: () => [...queryKeys.all, 'transactions'] as const,
    list: (address: string, filters?: TransactionFilters) =>
      [...queryKeys.transactions.all(), address, filters] as const,
    detail: (txHash: string) => [...queryKeys.transactions.all(), 'detail', txHash] as const,
    infinite: (address: string, filters?: TransactionFilters) =>
      [...queryKeys.transactions.all(), 'infinite', address, filters] as const,
  },

  sync: {
    all: () => [...queryKeys.all, 'sync'] as const,
    status: (address: string) => [...queryKeys.sync.all(), 'status', address] as const,
    history: (address: string) => [...queryKeys.sync.all(), 'history', address] as const,
  },

  auth: {
    all: () => [...queryKeys.all, 'auth'] as const,
    session: () => [...queryKeys.auth.all(), 'session'] as const,
    user: (userId: string) => [...queryKeys.auth.all(), 'user', userId] as const,
  },
} as const;

/**
 * Type-safe query key type
 */
export type QueryKeys = typeof queryKeys;

/**
 * Helper to get all query keys for a specific wallet
 * Useful for prefetching all wallet data at once
 */
export const getWalletQueryKeys = (address: string) => {
  return [
    queryKeys.wallet.detail(address),
    queryKeys.wallet.balance(address),
    queryKeys.wallet.assets(address),
    queryKeys.transactions.list(address),
    queryKeys.sync.status(address),
  ];
};

/**
 * Helper to invalidate all queries for a specific wallet
 * Used after sync operations to refresh all wallet-related data
 */
export const getInvalidationKeys = (address: string) => {
  return {
    wallet: queryKeys.wallet.detail(address),
    transactions: queryKeys.transactions.all(),
    sync: queryKeys.sync.status(address),
  };
};