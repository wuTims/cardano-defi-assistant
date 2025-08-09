/**
 * SupabaseProvider - Supabase Client Management
 * 
 * Focused on Supabase client concerns:
 * - Client creation with proper memoization
 * - JWT token integration
 * - Direct database query helpers
 * 
 * Uses useMemo to prevent infinite render loops:
 * - Client only recreated when access token changes
 * - Query functions are memoized for stable references
 */

"use client";

import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from './AuthContext';
import { logger } from '@/lib/logger';

export type SupabaseContextType = {
  // Memoized client - only changes when token changes
  client: SupabaseClient | null;
  isReady: boolean;
  
  // Stable query helpers
  query: (table: string) => any | null;
  rpc: (fn: string, params?: any) => any | null;
  
  // Utility functions
  testConnection: () => Promise<{ success: boolean; error?: string }>;
};

const SupabaseContext = createContext<SupabaseContextType | null>(null);

export const useSupabase = (): SupabaseContextType => {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};

export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();

  // Memoized Supabase client - CRITICAL: prevents infinite loops
  // Only recreates when access token actually changes
  const client = useMemo(() => {
    if (!token?.token) {
      logger.info('Creating unauthenticated Supabase client');
      return createSupabaseClient(); // No token = public client
    }

    logger.info('Creating authenticated Supabase client');
    return createSupabaseClient(token.token);
  }, [token?.token]); // Only depends on token string, not entire token object

  // Memoized ready state
  const isReady = useMemo(() => {
    return client !== null && token !== null;
  }, [client, token]);

  // Memoized query function for stable reference
  const query = useCallback((table: string) => {
    if (!client) {
      logger.warn('Attempted to query without Supabase client');
      return null;
    }
    return client.from(table);
  }, [client]);

  // Memoized RPC function for stable reference
  const rpc = useCallback((fn: string, params?: any) => {
    if (!client) {
      logger.warn('Attempted to call RPC without Supabase client');
      return null;
    }
    return client.rpc(fn, params);
  }, [client]);

  // Test connection function
  const testConnection = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!client || !token) {
      return {
        success: false,
        error: 'No authenticated client available'
      };
    }

    try {
      // Try to access user's own data (should work with RLS)
      const { data, error } = await client
        .from('app_users')
        .select('id, wallet_addr')
        .eq('id', token.userId)
        .single();

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      logger.info(`Supabase connection test successful for user: ${data?.id}`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }, [client, token]);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo<SupabaseContextType>(() => ({
    client,
    isReady,
    query,
    rpc,
    testConnection,
  }), [client, isReady, query, rpc, testConnection]);

  return (
    <SupabaseContext.Provider value={contextValue}>
      {children}
    </SupabaseContext.Provider>
  );
};