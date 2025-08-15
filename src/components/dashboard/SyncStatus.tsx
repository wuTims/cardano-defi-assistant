'use client';

import React from 'react';
import { useManualSync } from '@/hooks/mutations/use-sync-mutation';
import { useWallet } from '@/hooks/queries/use-wallet-query';
import { motion } from 'framer-motion';
import { RefreshCw, Check, AlertCircle, Clock } from 'lucide-react';

export function SyncStatus() {
  const { walletData } = useWallet();
  const { sync, canSync, isLoading: isSyncing, error } = useManualSync();
  const lastSyncAt = walletData?.lastSyncedAt || null;
  
  const formatLastSync = (date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };
  
  const handleSync = () => {
    if (canSync) {
      sync();
    }
  };
  
  const getSyncStatusColor = () => {
    if (error) return 'text-red-500';
    if (isSyncing) return 'text-blue-500';
    if (!lastSyncAt) return 'text-yellow-500';
    
    const hoursSinceSync = (new Date().getTime() - lastSyncAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceSync < 1) return 'text-green-500';
    if (hoursSinceSync < 24) return 'text-blue-500';
    return 'text-yellow-500';
  };
  
  const getSyncIcon = () => {
    if (error) {
      return <AlertCircle className="w-4 h-4" />;
    }
    if (isSyncing) {
      return <RefreshCw className="w-4 h-4 animate-spin" />;
    }
    if (!lastSyncAt) {
      return <AlertCircle className="w-4 h-4" />;
    }
    
    const hoursSinceSync = (new Date().getTime() - lastSyncAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceSync < 1) {
      return <Check className="w-4 h-4" />;
    }
    return <Clock className="w-4 h-4" />;
  };
  
  return (
    <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
      <div className="flex items-center gap-3">
        <div className={`${getSyncStatusColor()}`}>
          {getSyncIcon()}
        </div>
        
        <div>
          <div className="text-sm font-medium">
            {error ? 'Sync Failed' :
             isSyncing ? 'Syncing...' :
             'Blockchain Sync'}
          </div>
          <div className="text-xs text-muted-foreground">
            {error ? (
              <span className="text-red-500">{error.message || 'Sync failed'}</span>
            ) : lastSyncAt ? (
              <>Last synced: {formatLastSync(lastSyncAt)}</>
            ) : (
              'Not synced yet'
            )}
          </div>
        </div>
      </div>
      
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleSync}
        disabled={!canSync}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg transition-all
          ${!canSync 
            ? 'bg-blue-500/20 text-blue-500 cursor-not-allowed' 
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }
        `}
      >
        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
        <span className="text-sm font-medium">
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </span>
      </motion.button>
    </div>
  );
}