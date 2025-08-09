/**
 * WalletProvider - Wallet-Specific Operations
 * 
 * Focused on wallet data concerns:
 * - Wallet data fetching and caching
 * - Blockchain sync operations  
 * - Balance and asset management
 * 
 * Uses modern React patterns:
 * - useMemo for data memoization
 * - useCallback for stable function references
 * - Separates data fetching from auth concerns
 */

"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useSupabase } from './SupabaseProvider';
import { logger } from '@/lib/logger';
import type { WalletData } from '@/types/wallet';

export type WalletContextType = {
  // Wallet data state
  walletData: WalletData | null;
  isSyncing: boolean;
  lastSyncAt: Date | null;
  syncError: string | null;
  
  // Operations
  syncWallet: () => Promise<void>;
  refreshWalletData: () => Promise<void>;
  clearSyncError: () => void;
};

const WalletContext = createContext<WalletContextType | null>(null);

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user, token } = useAuth();
  const { client, isReady } = useSupabase();
  
  // Wallet-specific state
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  
  // Ref to track sync state without causing dependency issues
  const isSyncingRef = useRef(false);

  // Clear sync error
  const clearSyncError = useCallback(() => {
    setSyncError(null);
  }, []);

  // Fetch wallet data from database using Supabase client
  const fetchWalletData = useCallback(async (walletAddress: string): Promise<WalletData | null> => {
    if (!client || !isReady) {
      logger.warn('Cannot fetch wallet data: Supabase client not ready');
      return null;
    }

    try {
      // Query wallet data using RLS-protected view
      const { data, error } = await client
        .from('user_wallet_summary')
        .select('*')
        .eq('wallet_addr', walletAddress)
        .single();

      if (error) {
        logger.error('Failed to fetch wallet data', error);
        throw new Error(error.message);
      }

      if (!data) {
        logger.info(`No wallet data found for address ${walletAddress.slice(0, 12)}...`);
        return null;
      }

      // Transform database data to WalletData type
      const walletData: WalletData = {
        address: data.wallet_address || walletAddress,
        balance: {
          lovelace: data.balance_lovelace || '0',
          assets: [] // TODO: Fetch assets separately if needed
        },
        utxos: [], // TODO: Fetch UTXOs separately if needed
        lastSyncedAt: data.last_synced_at ? new Date(data.last_synced_at) : new Date(),
        syncedBlockHeight: data.synced_block_height || 0
      };

      logger.info(`Wallet data fetched successfully for ${walletAddress.slice(0, 12)}...: balance ${walletData.balance.lovelace} lovelace, last synced: ${walletData.lastSyncedAt}`);

      return walletData;
    } catch (error) {
      logger.error('Error fetching wallet data', error);
      throw error;
    }
  }, [client]); // Only depend on client, check isReady inside function

  // Sync wallet data from blockchain (calls server-side sync service)
  const syncWallet = useCallback(async () => {
    if (!user?.walletAddress || isSyncing) {
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      // Call server-side sync API (to be created)
      const response = await fetch('/api/wallet/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token.token}` })
        },
        body: JSON.stringify({
          walletAddress: user.walletAddress
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Sync failed');
      }

      const syncResult = await response.json();
      
      if (!syncResult.success) {
        throw new Error(syncResult.error || 'Sync failed');
      }

      // Refresh wallet data after successful sync
      await refreshWalletData();
      
      setLastSyncAt(new Date());
      logger.info('Wallet sync completed successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      setSyncError(errorMessage);
      logger.error('Wallet sync failed', error);
    } finally {
      setIsSyncing(false);
    }
  }, [user?.walletAddress, token, isSyncing]); // Keep isSyncing - it's fine

  // Refresh wallet data from database
  const refreshWalletData = useCallback(async () => {
    if (!user?.walletAddress) {
      return;
    }

    try {
      const data = await fetchWalletData(user.walletAddress);
      setWalletData(data);
    } catch (error) {
      logger.error('Failed to refresh wallet data', error);
      // Don't set as sync error since this is just a data refresh
    }
  }, [user?.walletAddress, fetchWalletData]);

  // Load wallet data when user authenticates or Supabase client is ready
  useEffect(() => {
    const loadWalletData = async () => {
      if (isAuthenticated && user?.walletAddress && client && isReady) {
        logger.info('Loading wallet data for authenticated user');
        try {
          const data = await fetchWalletData(user.walletAddress);
          setWalletData(data);
        } catch (error) {
          logger.error('Failed to load wallet data on authentication', error);
        }
      } else if (!isAuthenticated) {
        // Clear wallet data when user logs out
        setWalletData(null);
        setLastSyncAt(null);
        setSyncError(null);
      }
    };

    loadWalletData();
  }, [isAuthenticated, user?.walletAddress, client, isReady, fetchWalletData]); // Direct dependencies only

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo<WalletContextType>(() => ({
    walletData,
    isSyncing,
    lastSyncAt,
    syncError,
    syncWallet,
    refreshWalletData,
    clearSyncError,
  }), [
    walletData,
    isSyncing,
    lastSyncAt,
    syncError,
    syncWallet,
    refreshWalletData,
    clearSyncError,
  ]);

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};