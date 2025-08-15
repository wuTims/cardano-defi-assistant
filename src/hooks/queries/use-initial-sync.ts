import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSyncMutation } from '@/hooks/mutations/use-sync-mutation';
import { useWalletQuery } from './use-wallet-query';
import { logger } from '@/lib/logger';

/**
 * Hook to handle initial sync when user authenticates
 * 
 * Solves the race condition issue by:
 * - Checking if wallet data exists in database before syncing
 * - Using refs to prevent multiple sync attempts
 * - Only syncing if wallet has never been synced
 * - Handling wallet switching scenarios
 */
export function useInitialSync() {
  const { isAuthenticated, user } = useAuth();
  const { mutate: syncWallet, isPending: isSyncing } = useSyncMutation();
  const { data: walletData, isLoading: isLoadingWallet } = useWalletQuery();
  const hasSyncedRef = useRef(false);
  const lastWalletRef = useRef<string | null>(null);

  useEffect(() => {
    // Reset sync flag if wallet changes
    if (user?.walletAddress !== lastWalletRef.current) {
      hasSyncedRef.current = false;
      lastWalletRef.current = user?.walletAddress || null;
    }

    // Don't do anything while wallet data is loading
    if (isLoadingWallet) {
      return;
    }

    // Only sync if:
    // 1. User is authenticated
    // 2. Has a wallet address
    // 3. Haven't synced yet for this session
    // 4. Not currently syncing
    // 5. Wallet data has loaded from database
    if (
      isAuthenticated && 
      user?.walletAddress && 
      !hasSyncedRef.current && 
      !isSyncing &&
      !isLoadingWallet
    ) {
      // Check if wallet has NEVER been synced (no lastSyncedAt)
      if (walletData && !walletData.lastSyncedAt) {
        logger.info('Wallet has never been synced, performing initial sync');
        hasSyncedRef.current = true;
        syncWallet();
      } else if (!walletData) {
        // This shouldn't happen if API is working correctly
        logger.warn('No wallet data returned from API');
        hasSyncedRef.current = true;
      } else {
        logger.info(`Wallet was last synced at ${walletData.lastSyncedAt}, skipping initial sync`);
        hasSyncedRef.current = true;
      }
    }

    // Clear sync flag when user logs out
    if (!isAuthenticated) {
      hasSyncedRef.current = false;
      lastWalletRef.current = null;
    }
  }, [isAuthenticated, user?.walletAddress, isSyncing, syncWallet, walletData, isLoadingWallet]);

  return {
    hasSynced: hasSyncedRef.current,
    isSyncing,
  };
}