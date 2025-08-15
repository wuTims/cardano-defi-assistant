"use client";

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { WalletConnectButton } from '@/components/WalletConnectButton';
import { Button } from '@/components/ui/button';
import { Home, BarChart3 } from 'lucide-react';

export const Navigation: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <nav 
      data-testid="main-navigation" 
      className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="container flex h-14 max-w-screen-2xl items-center">
        {/* Logo */}
        <div className="mr-6 flex items-center space-x-2">
          <Link href="/" data-testid="nav-logo-link" className="flex items-center space-x-2">
            <div 
              data-testid="nav-logo-icon" 
              className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center"
            >
              <span className="text-white font-bold text-sm">W</span>
            </div>
            <span data-testid="nav-logo-text" className="font-bold text-lg">Wallet Sync</span>
          </Link>
        </div>

        {/* Navigation Links */}
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <nav data-testid="nav-links" className="flex items-center space-x-6">
            <Link href="/" data-testid="nav-home-link">
              <Button 
                variant="ghost" 
                data-testid="nav-home-button"
                className="flex items-center space-x-2"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Home</span>
              </Button>
            </Link>
            
            {isAuthenticated && (
              <Link href="/dashboard" data-testid="nav-dashboard-link">
                <Button 
                  variant="ghost" 
                  data-testid="nav-dashboard-button"
                  className="flex items-center space-x-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
              </Link>
            )}
          </nav>

          {/* Wallet Connection */}
          <div data-testid="nav-wallet-section" className="flex items-center space-x-4">
            <WalletConnectButton />
          </div>
        </div>
      </div>
    </nav>
  );
};