/**
 * AppProviders - Root Provider Composition
 * 
 * Composes all context providers in the correct order:
 * AuthProvider -> SupabaseProvider -> WalletProvider
 * 
 * This ensures proper dependency flow and prevents provider hell
 */

"use client";

import React from 'react';
import { AuthProvider } from './AuthContext';
import { SupabaseProvider } from './SupabaseProvider';
import { WalletProvider } from './WalletProvider';

export interface AppProvidersProps {
  children: React.ReactNode;
}

/**
 * Root providers component that wraps the entire app
 * Order is important: Auth -> Supabase -> Wallet
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <AuthProvider>
      <SupabaseProvider>
        <WalletProvider>
          {children}
        </WalletProvider>
      </SupabaseProvider>
    </AuthProvider>
  );
};

export default AppProviders;