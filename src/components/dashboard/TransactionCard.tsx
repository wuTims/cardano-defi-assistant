'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import type { WalletTransaction, TransactionAction, Protocol } from '@/core/types/transaction';
import { 
  formatADA, 
  formatTokenAmount, 
  formatTransactionDate, 
  isDust 
} from '@/utils/cardano-format';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowRightLeft,
  Coins,
  TrendingUp,
  Package,
  Droplets,
  CircleDollarSign
} from 'lucide-react';

interface TransactionCardProps {
  transaction: WalletTransaction;
  onCardClick?: () => void;
}

function getActionIcon(action: TransactionAction) {
  switch (action) {
    case 'send':
      return <ArrowUpRight className="w-5 h-5 text-red-500" />;
    case 'receive':
      return <ArrowDownLeft className="w-5 h-5 text-green-500" />;
    case 'swap':
      return <ArrowRightLeft className="w-5 h-5 text-blue-500" />;
    case 'supply':
    case 'lend':
      return <TrendingUp className="w-5 h-5 text-purple-500" />;
    case 'withdraw':
      return <Package className="w-5 h-5 text-orange-500" />;
    case 'provide_liquidity':
      return <Droplets className="w-5 h-5 text-cyan-500" />;
    case 'stake':
      return <Coins className="w-5 h-5 text-yellow-500" />;
    default:
      return <CircleDollarSign className="w-5 h-5 text-gray-500" />;
  }
}

function getProtocolBadge(protocol?: Protocol) {
  if (!protocol || protocol === 'unknown') return null;
  
  const colors: Record<Protocol, string> = {
    minswap: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    liqwid: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    sundaeswap: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    wingriders: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    djed: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    unknown: ''
  };
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[protocol]}`}>
      {protocol.charAt(0).toUpperCase() + protocol.slice(1)}
    </span>
  );
}

export function TransactionCard({ transaction, onCardClick }: TransactionCardProps) {
  // Filter out ADA and dust from asset count
  const relevantAssets = transaction.assetFlows.filter(flow => 
    flow.token.unit !== 'lovelace' && 
    !isDust(flow.netChange, flow.token.decimals)
  );
  
  // Find ADA flow or use first relevant asset
  const mainAssetFlow = transaction.assetFlows.find(f => 
    f.token.unit === 'lovelace'
  ) || relevantAssets[0] || transaction.assetFlows[0];
  
  const hasMultipleAssets = relevantAssets.length > 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      className="cursor-pointer"
      onClick={onCardClick}
    >
      <Card className="p-4 hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {getActionIcon(transaction.tx_action)}
            
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {transaction.description}
                </span>
                {getProtocolBadge(transaction.tx_protocol)}
              </div>
              
              <div className="text-sm text-muted-foreground mt-1">
                {formatTransactionDate(transaction.tx_timestamp)}
                {' • '}
                Block #{transaction.blockHeight.toLocaleString()}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            {mainAssetFlow && (
              <>
                <div className={`font-semibold ${
                  mainAssetFlow.netChange > 0n ? 'text-green-600 dark:text-green-400' : 
                  mainAssetFlow.netChange < 0n ? 'text-red-600 dark:text-red-400' : 
                  'text-foreground'
                }`}>
                  {mainAssetFlow.netChange > 0n ? '+' : ''}
                  {mainAssetFlow.token.unit === 'lovelace' 
                    ? formatADA(mainAssetFlow.netChange)
                    : formatTokenAmount(mainAssetFlow.netChange, mainAssetFlow.token.decimals)}
                  {' '}
                  {mainAssetFlow.token.ticker}
                </div>
                
                {hasMultipleAssets && (
                  <div className="text-xs text-muted-foreground">
                    +{relevantAssets.length} more {relevantAssets.length === 1 ? 'asset' : 'assets'}
                  </div>
                )}
              </>
            )}
            
            {transaction.fees > 0n && (
              <div className="text-xs text-muted-foreground mt-1">
                Fee: {formatADA(transaction.fees)} ADA
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}