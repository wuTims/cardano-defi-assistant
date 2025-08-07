"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wallet, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const formatADA = (lovelace: string): string => {
  const ada = parseFloat(lovelace) / 1_000_000;
  return ada.toFixed(6);
};

const formatUSD = (ada: number): string => {
  // Mock ADA price - in production, fetch from a price API
  const adaPrice = 0.45;
  const usdValue = ada * adaPrice;
  return `$${usdValue.toFixed(2)}`;
};

export const WalletOverview: React.FC = () => {
  const {
    isAuthenticated,
    walletAddress,
    walletType,
    walletData,
    isSyncing,
    error,
    syncWalletData,
    clearError
  } = useAuth();

  if (!isAuthenticated || !walletAddress) {
    return (
      <Card className="p-6 text-center">
        <Wallet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-600 mb-2">
          No Wallet Connected
        </h3>
        <p className="text-gray-500">
          Connect your Cardano wallet to view your balance and transaction history.
        </p>
      </Card>
    );
  }

  const adaBalance = walletData ? parseFloat(formatADA(walletData.balance.lovelace)) : 0;
  const usdValue = formatUSD(adaBalance);
  const hasAssets = walletData?.balance.assets && walletData.balance.assets.length > 0;
  const lastSyncText = walletData?.lastSyncedAt 
    ? new Date(walletData.lastSyncedAt).toLocaleString()
    : 'Never';

  return (
    <div className="space-y-6">
      {/* Wallet Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
              <Wallet className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {walletType?.charAt(0).toUpperCase()}{walletType?.slice(1)} Wallet
              </h2>
              <p className="text-muted-foreground font-mono text-sm">
                {walletAddress.slice(0, 12)}...{walletAddress.slice(-8)}
              </p>
            </div>
          </div>
          
          <Button
            variant="outline"
            onClick={syncWalletData}
            disabled={isSyncing}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Refresh'}</span>
          </Button>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearError}
                className="text-red-400 hover:text-red-300 h-auto p-1"
              >
                ×
              </Button>
            </div>
          </motion.div>
        )}

        {/* Balance Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-2"
          >
            <p className="text-sm text-muted-foreground">ADA Balance</p>
            <p className="text-3xl font-bold text-foreground">
              ₳{adaBalance.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">{usdValue}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-2"
          >
            <p className="text-sm text-muted-foreground">Native Assets</p>
            <p className="text-3xl font-bold text-foreground">
              {walletData?.balance.assets.length || 0}
            </p>
            <p className="text-sm text-muted-foreground">
              {hasAssets ? 'Assets in wallet' : 'No assets'}
            </p>
          </motion.div>
        </div>

        <div className="mt-6 pt-6 border-t border-border/50">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Last Updated: {lastSyncText}</span>
            <span>Block Height: {walletData?.syncedBlockHeight || 'Unknown'}</span>
          </div>
        </div>
      </Card>

      {/* Assets Grid */}
      {hasAssets && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Native Assets</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {walletData?.balance.assets.map((asset, index) => (
              <motion.div
                key={asset.unit}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 bg-muted/30 rounded-lg border border-border/50"
              >
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {asset.assetName.slice(0, 2).toUpperCase() || 'NA'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {asset.assetName || 'Unknown Asset'}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {asset.policyId.slice(0, 8)}...
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Quantity</span>
                    <span className="font-semibold text-foreground">
                      {parseInt(asset.quantity).toLocaleString()}
                    </span>
                  </div>
                  {asset.fingerprint && (
                    <div className="text-xs text-muted-foreground font-mono">
                      {asset.fingerprint}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      )}

      {/* UTXOs Summary */}
      {walletData && walletData.utxos.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">UTXO Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center p-4 bg-muted/30 rounded-lg"
            >
              <p className="text-2xl font-bold text-foreground">{walletData.utxos.length}</p>
              <p className="text-sm text-muted-foreground">Total UTXOs</p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-center p-4 bg-muted/30 rounded-lg"
            >
              <p className="text-2xl font-bold text-foreground">
                {walletData.utxos.filter(utxo => 
                  utxo.amount.some(amt => amt.unit === 'lovelace')
                ).length}
              </p>
              <p className="text-sm text-muted-foreground">With ADA</p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center p-4 bg-muted/30 rounded-lg"
            >
              <p className="text-2xl font-bold text-foreground">
                {walletData.utxos.filter(utxo => 
                  utxo.amount.some(amt => amt.unit !== 'lovelace')
                ).length}
              </p>
              <p className="text-sm text-muted-foreground">With Assets</p>
            </motion.div>
          </div>
        </Card>
      )}
    </div>
  );
};