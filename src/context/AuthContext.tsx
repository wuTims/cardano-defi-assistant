"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authService } from '@/services/auth';
import { walletSyncService } from '@/services/sync';
import { logger } from '@/lib/logger';
import type {
  AuthChallenge,
  AuthToken,
  WalletSignatureArgs,
  WalletType,
  AuthServiceResponse
} from '@/types/auth';
import type { WalletData } from '@/types/wallet';

/**
 * Wallet connection state
 */
export type WalletConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Authentication context type
 */
export type AuthContextType = {
  // Authentication state
  isAuthenticated: boolean;
  authToken: AuthToken | null;
  walletAddress: string | null;
  walletType: WalletType | null;
  connectionState: WalletConnectionState;
  error: string | null;

  // Wallet data
  walletData: WalletData | null;
  isSyncing: boolean;

  // Methods
  connectWallet: (walletType: WalletType) => Promise<void>;
  disconnect: () => void;
  syncWalletData: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState<AuthToken | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [connectionState, setConnectionState] = useState<WalletConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  /**
   * Load wallet data from database
   */
  const loadWalletData = useCallback(async (address: string) => {
    try {
      const data = await walletSyncService.getWalletData(address);
      setWalletData(data);
    } catch (error) {
      logger.error('Failed to load wallet data', error);
    }
  }, []);

  /**
   * Initialize auth state from localStorage on mount
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem('wallet-sync-auth-token');
        if (!storedToken) return;

        const tokenData: AuthToken = JSON.parse(storedToken);
        
        // Check if token is expired
        if (new Date(tokenData.expiresAt) <= new Date()) {
          localStorage.removeItem('wallet-sync-auth-token');
          return;
        }

        // Verify token with auth service
        const verifyResult = authService.verifyToken(tokenData.token);
        if (verifyResult.success && verifyResult.data) {
          setAuthToken(tokenData);
          setWalletAddress(tokenData.walletAddress);
          setWalletType(tokenData.walletType);
          setIsAuthenticated(true);
          setConnectionState('connected');

          // Load wallet data
          await loadWalletData(tokenData.walletAddress);
        } else {
          localStorage.removeItem('wallet-sync-auth-token');
        }
      } catch (error) {
        logger.error('Failed to initialize auth from storage', error);
        localStorage.removeItem('wallet-sync-auth-token');
      }
    };

    initializeAuth();
  }, [loadWalletData]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Connect to a Cardano wallet using CIP-30
   */
  const connectWallet = useCallback(async (selectedWalletType: WalletType) => {
    setConnectionState('connecting');
    setError(null);

    try {
      // Check if wallet is available in the browser
      const walletApi = await getWalletApi(selectedWalletType);
      if (!walletApi) {
        throw new Error(`${selectedWalletType} wallet not found`);
      }

      // Enable the wallet
      const enabledApi = await walletApi.enable();
      const addresses = await enabledApi.getUsedAddresses();
      
      if (!addresses || addresses.length === 0) {
        throw new Error('No addresses found in wallet');
      }

      // Use the first address
      const firstAddress = addresses[0];

      // Generate authentication challenge
      const challengeResponse = authService.generateChallenge(firstAddress);
      if (!challengeResponse.success || !challengeResponse.data) {
        throw new Error(challengeResponse.error || 'Failed to generate challenge');
      }

      const challenge = challengeResponse.data;

      // Request signature from wallet
      const signatureResult = await requestWalletSignature(
        enabledApi,
        challenge.challenge,
        firstAddress
      );

      // Verify signature and get JWT token
      const authResponse = await authService.verifySignatureAndGenerateToken(
        signatureResult,
        selectedWalletType
      );

      if (!authResponse.success || !authResponse.data) {
        throw new Error(authResponse.error || 'Authentication failed');
      }

      const token = authResponse.data;

      // Store token in localStorage
      localStorage.setItem('wallet-sync-auth-token', JSON.stringify(token));

      // Update state
      setAuthToken(token);
      setWalletAddress(token.walletAddress);
      setWalletType(selectedWalletType);
      setIsAuthenticated(true);
      setConnectionState('connected');

      // Load and sync wallet data
      await loadWalletData(token.walletAddress);
      // Note: syncWalletData will be called separately by user interaction to avoid circular dependency

      logger.info(`Wallet connected successfully: ${selectedWalletType} - ${token.walletAddress}`);

      // Redirect to dashboard after successful connection
      if (typeof window !== 'undefined') {
        window.location.href = '/dashboard';
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
      setError(errorMessage);
      setConnectionState('error');
      logger.error('Wallet connection failed', error);
    }
  }, [loadWalletData]);

  /**
   * Disconnect wallet and clear authentication state
   */
  const disconnect = useCallback(() => {
    localStorage.removeItem('wallet-sync-auth-token');
    setAuthToken(null);
    setWalletAddress(null);
    setWalletType(null);
    setIsAuthenticated(false);
    setConnectionState('disconnected');
    setWalletData(null);
    setError(null);
    logger.info('Wallet disconnected');
  }, []);

  /**
   * Sync wallet data from blockchain
   */
  const syncWalletData = useCallback(async () => {
    if (!walletAddress) return;

    setIsSyncing(true);
    try {
      const syncResult = await walletSyncService.syncWallet(walletAddress);
      
      if (syncResult.success) {
        // Reload wallet data after sync
        await loadWalletData(walletAddress);
        logger.info('Wallet sync completed successfully');
      } else {
        throw new Error(syncResult.error || 'Sync failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync wallet';
      setError(errorMessage);
      logger.error('Wallet sync failed', error);
    } finally {
      setIsSyncing(false);
    }
  }, [walletAddress, loadWalletData]);

  const contextValue: AuthContextType = {
    isAuthenticated,
    authToken,
    walletAddress,
    walletType,
    connectionState,
    error,
    walletData,
    isSyncing,
    connectWallet,
    disconnect,
    syncWalletData,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Get wallet API instance from browser
 */
const getWalletApi = async (walletType: WalletType): Promise<any> => {
  if (typeof window === 'undefined') return null;

  const walletApiMap: Record<WalletType, string> = {
    nami: 'nami',
    eternl: 'eternl',
    flint: 'flint',
    gerowallet: 'gerowallet',
    yoroi: 'yoroi',
    ccvault: 'ccvault',
  };

  const walletName = walletApiMap[walletType];
  const walletApi = (window as any).cardano?.[walletName];

  if (!walletApi) {
    throw new Error(`${walletType} wallet not installed`);
  }

  return walletApi;
};

/**
 * Request signature from wallet using CIP-30
 */
const requestWalletSignature = async (
  enabledApi: any,
  message: string,
  address: string
): Promise<WalletSignatureArgs> => {
  try {
    // Convert message to hex
    const messageHex = Buffer.from(message, 'utf8').toString('hex');
    
    // Request signature
    const signature = await enabledApi.signData(address, messageHex);
    
    // Get public key
    const publicKey = signature.key;
    const signatureHex = signature.signature;

    return {
      address,
      signature: signatureHex,
      key: publicKey,
      nonce: extractNonceFromMessage(message),
    };
  } catch (error) {
    throw new Error(`Failed to sign message: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Extract nonce from challenge message
 */
const extractNonceFromMessage = (message: string): string => {
  const nonceMatch = message.match(/nonce: ([a-fA-F0-9]+)/);
  if (!nonceMatch) {
    throw new Error('Invalid challenge format');
  }
  return nonceMatch[1];
};