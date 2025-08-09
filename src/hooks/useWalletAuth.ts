/**
 * useWalletAuth - Combined Hook
 * 
 * Combines all auth-related hooks for convenient consumption
 * Provides a clean interface that matches the old AuthContext
 * while using the new clean architecture underneath
 */

import { useAuth } from '@/context/AuthContext';
import { useSupabase } from '@/context/SupabaseProvider';
import { useWallet } from '@/context/WalletProvider';

import type { WalletType, WalletConnectionState } from '@/types/auth';
import type { WalletData } from '@/types/wallet';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Combined interface that matches the old AuthContext for backward compatibility
 * while using the new clean architecture
 */
export type WalletAuthHook = {
  // Auth state (from AuthContext)
  isAuthenticated: boolean;
  user: {
    id: string;
    walletAddress: string;
    walletType: WalletType;
  } | null;
  token: string | null;
  connectionState: WalletConnectionState;
  error: string | null;
  
  // Computed auth values
  isTokenExpired: boolean;
  tokenExpiresIn: number;
  
  // Supabase integration (from SupabaseProvider)
  supabaseClient: SupabaseClient | null;
  isSupabaseReady: boolean;
  
  // Wallet data (from WalletProvider)
  walletData: WalletData | null;
  isSyncing: boolean;
  syncError: string | null;
  
  // Convenience properties for backward compatibility
  walletAddress: string | null;
  walletType: WalletType | null;
  
  // Combined actions
  connectWallet: (walletType: WalletType) => Promise<void>;
  disconnect: () => void;
  refreshToken: () => Promise<void>;
  syncWalletData: () => Promise<void>;
  clearError: () => void;
  testConnection: () => Promise<{ success: boolean; error?: string }>;
};

/**
 * Custom hook that combines auth, Supabase, and wallet concerns
 * Provides backward compatibility while using clean architecture
 */
export function useWalletAuth(): WalletAuthHook {
  const { 
    isAuthenticated,
    user,
    token,
    connectionState,
    error,
    isTokenExpired,
    tokenExpiresIn,
    connectWallet,
    disconnect,
    refreshToken,
    clearError 
  } = useAuth();
  
  const { client: supabaseClient, isReady: isSupabaseReady, testConnection } = useSupabase();
  const { walletData, isSyncing, syncError, syncWallet, clearSyncError } = useWallet();

  // Combined error clearing
  const clearAllErrors = () => {
    clearError();
    clearSyncError();
  };

  return {
    // Auth state
    isAuthenticated,
    user,
    token: token?.token || null,
    connectionState,
    error,
    isTokenExpired,
    tokenExpiresIn,
    
    // Supabase
    supabaseClient,
    isSupabaseReady,
    
    // Wallet data
    walletData,
    isSyncing,
    syncError,
    
    // Convenience properties for backward compatibility
    walletAddress: user?.walletAddress || null,
    walletType: user?.walletType || null,
    
    // Actions
    connectWallet,
    disconnect,
    refreshToken,
    syncWalletData: syncWallet,
    clearError: clearAllErrors,
    testConnection,
  };
}

export default useWalletAuth;