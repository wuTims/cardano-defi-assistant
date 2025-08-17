"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wallet, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useWallet } from '@/hooks/queries/use-wallet-query';
import { useManualSync } from '@/hooks/mutations/use-sync-mutation';
import { priceService } from '@/services/price-service';
import { logger } from '@/lib/logger';

export const WalletOverview: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { walletData, error } = useWallet();
  const { sync: syncWallet, isLoading: isSyncing } = useManualSync();
  
  const walletAddress = user?.walletAddress;
  const walletType = user?.walletType;

  const [usdValue, setUsdValue] = useState<string>('$0.00');
  const [priceChange, setPriceChange] = useState<{ change: number; isPositive: boolean } | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(true);

  // Fetch price data when wallet data changes
  useEffect(() => {
    const fetchPriceData = async () => {
      if (!walletData?.balance.lovelace) {
        setUsdValue('$0.00');
        setIsLoadingPrice(false);
        return;
      }

      try {
        setIsLoadingPrice(true);
        const adaBalance = priceService.lovelaceToADA(walletData.balance.lovelace);
        const usdAmount = await priceService.adaToUSD(adaBalance);
        setUsdValue(priceService.formatUSD(usdAmount));
        
        const changeData = await priceService.getPriceChangeDisplay();
        setPriceChange(changeData);
      } catch (error) {
        logger.error({ err: error }, 'Failed to fetch price data');
        setUsdValue('$--');
        setPriceChange(null);
      } finally {
        setIsLoadingPrice(false);
      }
    };

    fetchPriceData();
  }, [walletData?.balance.lovelace]);

  if (!isAuthenticated || !walletAddress) {
    return (
      <Card data-testid="wallet-not-connected-card" className="p-6 text-center">
        <Wallet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 data-testid="no-wallet-title" className="text-lg font-semibold text-gray-600 mb-2">
          No Wallet Connected
        </h3>
        <p data-testid="no-wallet-message" className="text-gray-500">
          Connect your Cardano wallet to view your balance and transaction history.
        </p>
      </Card>
    );
  }

  const adaBalance = walletData ? priceService.lovelaceToADA(walletData.balance.lovelace) : 0;
  const hasAssets = walletData?.balance.assets && walletData.balance.assets.length > 0;
  const lastSyncText = walletData?.lastSyncedAt 
    ? new Date(walletData.lastSyncedAt).toLocaleString()
    : 'Never';

  return (
    <div data-testid="wallet-overview" className="space-y-6">
      {/* Wallet Header */}
      <Card data-testid="wallet-header-card" className="p-6">
        <div data-testid="wallet-header" className="flex items-center justify-between mb-6">
          <div data-testid="wallet-info" className="flex items-center space-x-3">
            <div data-testid="wallet-icon" className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
              <Wallet className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h2 data-testid="wallet-type-title" className="text-2xl font-bold text-foreground">
                {walletType?.charAt(0).toUpperCase()}{walletType?.slice(1)} Wallet
              </h2>
              <p data-testid="wallet-address-display" className="text-muted-foreground font-mono text-sm">
                {walletAddress ? `${walletAddress.slice(0, 12)}...${walletAddress.slice(-8)}` : 'No address'}
              </p>
            </div>
          </div>
          
          <Button
            variant="outline"
            onClick={() => syncWallet()}
            disabled={isSyncing}
            data-testid="wallet-sync-button"
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
            data-testid="wallet-error-alert"
            className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
          >
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <p data-testid="wallet-error-message" className="text-sm text-red-300">
                {error.message || 'Failed to load wallet data'}
              </p>
            </div>
          </motion.div>
        )}

        {/* Balance Display */}
        <div data-testid="balance-display" className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            data-testid="ada-balance-section"
            className="space-y-2"
          >
            <p className="text-sm text-muted-foreground">ADA Balance</p>
            <p data-testid="ada-balance-amount" className="text-3xl font-bold text-foreground">
              ₳{adaBalance.toLocaleString()}
            </p>
            <div data-testid="ada-balance-details" className="flex items-center space-x-2">
              <p data-testid="ada-usd-value" className="text-sm text-muted-foreground">
                {isLoadingPrice ? '...' : usdValue}
              </p>
              {priceChange && (
                <div data-testid="ada-price-change" className={`flex items-center text-xs ${
                  priceChange.isPositive ? 'text-green-500' : 'text-red-500'
                }`}>
                  {priceChange.isPositive ? (
                    <TrendingUp className="w-3 h-3 mr-1" />
                  ) : (
                    <TrendingDown className="w-3 h-3 mr-1" />
                  )}
                  {priceChange.change.toFixed(2)}%
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            data-testid="native-assets-section"
            className="space-y-2"
          >
            <p className="text-sm text-muted-foreground">Native Assets</p>
            <p data-testid="native-assets-count" className="text-3xl font-bold text-foreground">
              {walletData?.balance.assets.length || 0}
            </p>
            <p data-testid="native-assets-status" className="text-sm text-muted-foreground">
              {hasAssets ? 'Assets in wallet' : 'No assets'}
            </p>
          </motion.div>
        </div>

        <div data-testid="wallet-sync-info" className="mt-6 pt-6 border-t border-border/50">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span data-testid="last-updated">Last Updated: {lastSyncText}</span>
            <span data-testid="block-height">Block Height: {walletData?.syncedBlockHeight || 'Unknown'}</span>
          </div>
        </div>
      </Card>

      {/* Assets Grid */}
      {hasAssets && (
        <Card data-testid="native-assets-card" className="p-6">
          <h3 data-testid="native-assets-title" className="text-lg font-semibold text-foreground mb-4">Native Assets</h3>
          <div data-testid="native-assets-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {walletData?.balance.assets.map((asset, index) => (
              <motion.div
                key={asset.unit}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                data-testid={`native-asset-item-${index}`}
                className="p-4 bg-muted/30 rounded-lg border border-border/50"
              >
                <div data-testid={`asset-header-${index}`} className="flex items-center space-x-3 mb-2">
                  <div data-testid={`asset-icon-${index}`} className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {asset.assetName.slice(0, 2).toUpperCase() || 'NA'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p data-testid={`asset-name-${index}`} className="font-medium text-foreground truncate">
                      {asset.assetName || 'Unknown Asset'}
                    </p>
                    <p data-testid={`asset-policy-${index}`} className="text-xs text-muted-foreground font-mono truncate">
                      {asset.policyId.slice(0, 8)}...
                    </p>
                  </div>
                </div>
                <div data-testid={`asset-details-${index}`} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Quantity</span>
                    <span data-testid={`asset-quantity-${index}`} className="font-semibold text-foreground">
                      {parseInt(asset.quantity).toLocaleString()}
                    </span>
                  </div>
                  {asset.fingerprint && (
                    <div data-testid={`asset-fingerprint-${index}`} className="text-xs text-muted-foreground font-mono">
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
        <Card data-testid="utxo-summary-card" className="p-6">
          <h3 data-testid="utxo-summary-title" className="text-lg font-semibold text-foreground mb-4">UTXO Summary</h3>
          <div data-testid="utxo-summary-grid" className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              data-testid="utxo-total-count"
              className="text-center p-4 bg-muted/30 rounded-lg"
            >
              <p data-testid="utxo-total-number" className="text-2xl font-bold text-foreground">{walletData.utxos.length}</p>
              <p className="text-sm text-muted-foreground">Total UTXOs</p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              data-testid="utxo-ada-count"
              className="text-center p-4 bg-muted/30 rounded-lg"
            >
              <p data-testid="utxo-ada-number" className="text-2xl font-bold text-foreground">
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
              data-testid="utxo-assets-count"
              className="text-center p-4 bg-muted/30 rounded-lg"
            >
              <p data-testid="utxo-assets-number" className="text-2xl font-bold text-foreground">
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