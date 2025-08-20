/**
 * Clean AuthContext - Authentication State Only
 * 
 * Focused on core authentication concerns:
 * - Token management with proper memoization
 * - Login/logout flow with API integration
 * - User identity state
 * 
 * Uses modern React patterns:
 * - useMemo for expensive computations/object creation
 * - useCallback for stable function references
 * - useEffect only for actual side effects
 */

"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { logger } from '@/lib/logger';
import { getCardanoWallet, CardanoWalletApi } from '@/lib/cardano/wallets';
import {
  WalletType,
  WalletConnectionState,
} from '@/core/types/auth';
import type {
  NonceRequest,
  NonceResponse,
  VerifyRequest,
  VerifyResponse,
  AuthUser,
  AuthToken,
} from '@/core/types/auth';

// Re-export types for backward compatibility
export type { WalletConnectionState, WalletType } from '@/core/types/auth';
export type User = AuthUser;

export type AuthContextType = {
  // Direct state exposure (no wrapper)
  isAuthenticated: boolean;
  user: User | null;
  token: AuthToken | null;
  connectionState: WalletConnectionState;
  error: string | null;
  
  // Computed values
  isTokenExpired: boolean;
  tokenExpiresIn: number; // minutes until expiration
  
  // Stable action functions
  connectWallet: (walletType: WalletType) => Promise<void>;
  disconnect: () => void;
  refreshToken: () => Promise<void>;
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
  // Core state - kept minimal
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<AuthToken | null>(null);
  const [connectionState, setConnectionState] = useState<WalletConnectionState>(WalletConnectionState.DISCONNECTED);
  const [error, setError] = useState<string | null>(null);

  // Computed values for token expiration
  const isTokenExpired = useMemo(() => {
    if (!token) return true;
    return new Date(token.expiresAt) <= new Date();
  }, [token]);

  const tokenExpiresIn = useMemo(() => {
    if (!token) return 0;
    const now = new Date().getTime();
    const expires = new Date(token.expiresAt).getTime();
    return Math.max(0, Math.floor((expires - now) / (1000 * 60))); // minutes
  }, [token]);

  // Stable function to request nonce from API
  const requestNonce = useCallback(async (walletAddress: string): Promise<NonceResponse> => {
    const request: NonceRequest = { walletAddress };
    
    const response = await fetch('/api/auth/nonce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate challenge');
    }

    return response.json();
  }, []);

  // Stable function to verify signature with API
  const verifySignature = useCallback(async (verifyData: VerifyRequest): Promise<VerifyResponse> => {
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verifyData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Authentication failed');
    }

    return response.json();
  }, []);

  // Stable function to refresh token
  const refreshTokenAPI = useCallback(async (walletAddress: string): Promise<VerifyResponse> => {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token.token}` })
      },
      body: JSON.stringify({ walletAddress }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Token refresh failed');
    }

    return response.json();
  }, [token]);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initialize auth from localStorage - runs once
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem('wallet-sync-auth-token');
        if (!storedToken) return;

        let tokenData: AuthToken;
        try {
          tokenData = JSON.parse(storedToken);
        } catch (error) {
          logger.error({ err: error }, 'Invalid token format in localStorage');
          localStorage.removeItem('wallet-sync-auth-token');
          return;
        }

        // Validate token structure
        if (!tokenData.token || !tokenData.walletAddress || !tokenData.userId) {
          logger.error({ err: error }, 'Incomplete token data in localStorage');
          localStorage.removeItem('wallet-sync-auth-token');
          return;
        }
        
        // Check if token is expired
        if (new Date(tokenData.expiresAt) <= new Date()) {
          localStorage.removeItem('wallet-sync-auth-token');
          return;
        }

        // Token is valid, restore auth state
        const restoredUser: User = {
          id: tokenData.userId,
          walletAddress: tokenData.walletAddress,
          walletType: tokenData.walletType
        };

        setToken(tokenData);
        setUser(restoredUser);
        setIsAuthenticated(true);
        setConnectionState(WalletConnectionState.CONNECTED);

        logger.info('Authentication restored from storage');
      } catch (error) {
        logger.error({ err: error }, 'Failed to initialize auth from storage');
        localStorage.removeItem('wallet-sync-auth-token');
      }
    };

    initializeAuth();
  }, []); // Empty dependencies - runs once only


  // Connect wallet with proper CIP-30 integration
  const connectWallet = useCallback(async (walletType: WalletType) => {
    setConnectionState(WalletConnectionState.CONNECTING);
    setError(null);

    try {
      // Get wallet API
      const walletApi = await getWalletApi(walletType);
      if (!walletApi) {
        throw new Error(`${walletType} wallet not found`);
      }

      // Enable wallet and get instance
      const walletInstance = await walletApi.enable();
      const hexAddresses = await walletInstance.getUsedAddresses();
      
      if (!hexAddresses || hexAddresses.length === 0) {
        throw new Error('No addresses found in wallet');
      }

      // Use hex address directly - server will handle conversion to Bech32
      const hexAddress = hexAddresses[0];
      logger.info(`Got hex address from wallet: ${hexAddress.slice(0, 20)}...`);

      // Request challenge from server using hex address
      const nonceResponse = await requestNonce(hexAddress);

      // Request signature from wallet using hex address per CIP-30
      const messageHex = Buffer.from(nonceResponse.challenge, 'utf8').toString('hex');
      const signatureResult = await walletInstance.signData(hexAddress, messageHex);

      // Verify signature and get JWT
      const verifyRequest: VerifyRequest = {
        walletAddress: hexAddress, // Send hex address - server will convert to Bech32
        walletType,
        nonce: nonceResponse.nonce,
        signatureData: {
          coseSignature: signatureResult.signature,
          publicKey: signatureResult.key
        }
      };

      const authResponse = await verifySignature(verifyRequest);

      // Update auth state
      const newToken: AuthToken = {
        token: authResponse.accessToken,
        expiresAt: new Date(authResponse.expiresAt),
        walletAddress: authResponse.user.walletAddress, // Server returns Bech32
        walletType,
        userId: authResponse.user.id
      };

      const newUser: User = {
        id: authResponse.user.id,
        walletAddress: authResponse.user.walletAddress,
        walletType
      };

      // Store token in localStorage for persistence
      localStorage.setItem('wallet-sync-auth-token', JSON.stringify(newToken));

      // Update state
      setToken(newToken);
      setUser(newUser);
      setIsAuthenticated(true);
      setConnectionState(WalletConnectionState.CONNECTED);

      logger.info(`Wallet connected successfully: ${walletType} - ${authResponse.user.walletAddress}`);

      // Redirect to dashboard
      if (typeof window !== 'undefined') {
        window.location.href = '/dashboard';
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
      setError(errorMessage);
      setConnectionState(WalletConnectionState.ERROR);
      logger.error({ err: error }, 'Wallet connection failed');
    }
  }, [requestNonce, verifySignature]);

  // Disconnect and clear all auth state
  const disconnect = useCallback(() => {
    localStorage.removeItem('wallet-sync-auth-token');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setConnectionState(WalletConnectionState.DISCONNECTED);
    setError(null);
    logger.info('Wallet disconnected');
  }, []);

  // Refresh token before expiration
  const refreshToken = useCallback(async () => {
    if (!user?.walletAddress) {
      throw new Error('No user to refresh token for');
    }

    try {
      const refreshResponse = await refreshTokenAPI(user.walletAddress);
      
      const newToken: AuthToken = {
        token: refreshResponse.accessToken,
        expiresAt: new Date(refreshResponse.expiresAt),
        walletAddress: refreshResponse.user.walletAddress,
        walletType: refreshResponse.user.walletType as WalletType,
        userId: refreshResponse.user.id
      };

      // Update localStorage
      localStorage.setItem('wallet-sync-auth-token', JSON.stringify(newToken));
      
      // Update state
      setToken(newToken);
      
      logger.info('Token refreshed successfully');
    } catch (error) {
      logger.error({ err: error }, 'Token refresh failed');
      // If refresh fails, logout user
      disconnect();
      throw error;
    }
  }, [user?.walletAddress, refreshTokenAPI, disconnect]);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo<AuthContextType>(() => ({
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
    clearError,
  }), [isAuthenticated, user, token, connectionState, error, isTokenExpired, tokenExpiresIn, connectWallet, disconnect, refreshToken, clearError]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Get wallet API instance from browser
 */
async function getWalletApi(walletType: WalletType): Promise<CardanoWalletApi | null> {
  if (typeof window === 'undefined') return null;

  const walletApiMap: Record<WalletType, string> = {
    [WalletType.NAMI]: 'nami',
    [WalletType.ETERNL]: 'eternl',
    [WalletType.FLINT]: 'flint',
    [WalletType.LACE]: 'lace',
    [WalletType.GEROWALLET]: 'gerowallet',
    [WalletType.YOROI]: 'yoroi',
    [WalletType.CCVAULT]: 'ccvault',
    [WalletType.VESPR]: 'vespr',
    [WalletType.NUFI]: 'nufi',
    [WalletType.TYPHON]: 'typhon',
  };

  const walletName = walletApiMap[walletType];
  const walletApi = getCardanoWallet(walletName);

  if (!walletApi) {
    throw new Error(`${walletType} wallet not installed`);
  }

  return walletApi;
}