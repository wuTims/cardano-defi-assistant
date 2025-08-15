"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useWallet } from '@/hooks/queries/use-wallet-query';
import { useManualSync } from '@/hooks/mutations/use-sync-mutation';
import { useInitialSync } from '@/hooks/queries/use-initial-sync';
import { WalletOverview } from './WalletOverview';
import { TransactionList } from './TransactionList';
import { TransactionFilters } from './TransactionFilters';
import { SyncStatus } from './SyncStatus';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  ArrowUpDown,
  Receipt
} from 'lucide-react';
import { Card } from '@/components/ui/card';

/**
 * Main wallet dashboard component
 * 
 * Displays portfolio overview and wallet data for authenticated users.
 * Shows welcome message for unauthenticated users.
 */
export function WalletDashboard() {
  const { isAuthenticated } = useAuth();
  const { walletData, isLoading: isLoadingWallet } = useWallet();
  const { sync: syncWallet, canSync, isLoading: isSyncing } = useManualSync();
  
  // Handle initial sync automatically
  useInitialSync();
  
  /**
   * Calculate portfolio value from actual wallet data
   * TODO: Integrate with price service for real-time ADA pricing
   */
  const calculatePortfolioValue = (): { value: string; change: number } => {
    if (!walletData) return { value: '$0.00', change: 0 };
    
    // Type-safe access to balance.lovelace (string type)
    const lovelaceBalance = parseFloat(walletData.balance.lovelace);
    const adaBalance = lovelaceBalance / 1_000_000;
    
    // TODO: Fetch real ADA price from price service
    const adaPrice = 0.45; // Placeholder until price service integration
    const totalValue = adaBalance * adaPrice;
    
    // TODO: Calculate actual 24h change from historical data
    const change = 0; // Placeholder - will be calculated from price history
    
    return {
      value: `$${totalValue.toFixed(2)}`,
      change
    };
  };

  const { value: totalPortfolioValue, change: portfolioChange } = calculatePortfolioValue();

  const handleSyncWallet = async () => {
    if (canSync) {
      await syncWallet();
    }
  };

  if (!isAuthenticated) {
    return (
      <div data-testid="dashboard-not-authenticated" className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div data-testid="welcome-message" className="text-center space-y-6">
          <Wallet className="w-16 h-16 text-muted-foreground mx-auto" />
          <div>
            <h1 data-testid="welcome-title" className="text-2xl font-bold text-foreground mb-2">Welcome to Your Dashboard</h1>
            <p data-testid="welcome-subtitle" className="text-muted-foreground">Connect your Cardano wallet to get started</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="wallet-dashboard" className="min-h-screen bg-background text-foreground">
      <div data-testid="dashboard-container" className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          data-testid="dashboard-header"
          className="flex items-center justify-between"
        >
          <div data-testid="dashboard-header-text">
            <h1 data-testid="dashboard-title" className="text-3xl font-bold text-foreground">Portfolio</h1>
            <p data-testid="dashboard-subtitle" className="text-muted-foreground">Your Cardano wallet overview</p>
          </div>
          <div data-testid="dashboard-actions" className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSyncWallet}
              disabled={!canSync}
              data-testid="dashboard-sync-button"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
            >
              <ArrowUpDown className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Wallet'}
            </motion.button>
          </div>
        </motion.div>

        {/* Portfolio Overview */}
        {isLoadingWallet ? (
          <Card className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border-border/50 p-8 animate-pulse">
            <div className="h-32" />
          </Card>
        ) : walletData ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            data-testid="portfolio-overview"
          >
            <Card data-testid="portfolio-overview-card" className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border-border/50 p-8">
              <div data-testid="portfolio-content" className="flex items-center justify-between">
                <div data-testid="portfolio-stats">
                  <p data-testid="portfolio-label" className="text-muted-foreground mb-2">Total Portfolio Value</p>
                  <h2 data-testid="portfolio-value" className="text-4xl font-bold text-foreground">{totalPortfolioValue}</h2>
                  {portfolioChange !== 0 && (
                    <div data-testid="portfolio-change" className={`flex items-center gap-2 mt-2 ${
                      portfolioChange >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {portfolioChange >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                      <span className="font-semibold">{Math.abs(portfolioChange)}% (24h)</span>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground mt-4">
                    Last synced: {walletData.lastSyncedAt ? new Date(walletData.lastSyncedAt).toLocaleString() : 'Never'}
                  </p>
                </div>
                <div data-testid="portfolio-decoration" className="w-32 h-32 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full opacity-20" />
              </div>
            </Card>
          </motion.div>
        ) : (
          <Card className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border-border/50 p-8">
            <div className="text-center">
              <p className="text-muted-foreground">No wallet data available yet</p>
              <p className="text-sm text-muted-foreground mt-2">Click &quot;Sync Wallet&quot; to fetch your latest data</p>
            </div>
          </Card>
        )}

        {/* Wallet Overview - Shows actual wallet data */}
        <WalletOverview />
        
        {/* Transaction Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          {/* Section Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Receipt className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">Transaction History</h2>
            </div>
          </div>
          
          {/* Sync Status */}
          <SyncStatus />
          
          {/* Filters */}
          <TransactionFilters />
          
          {/* Transaction List */}
          <Card className="p-6">
            <TransactionList />
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

export default WalletDashboard;