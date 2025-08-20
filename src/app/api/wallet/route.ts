/**
 * GET /api/wallet
 * 
 * Fetches wallet data for the authenticated user.
 * 
 * Returns:
 * - Wallet balance (ADA and native assets)
 * - Last sync timestamp
 * - Block height
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/utils/auth-wrapper';
import { logger } from '@/lib/logger';
import { ServiceFactory } from '@/services/service-factory';
import { prisma, serialize } from '@/lib/prisma';
import type { WalletData } from '@/core/types/wallet';

export const GET = withAuth(async (request, { walletAddress, userId }) => {
  // Create child logger for this specific request
  const requestLogger = logger.child({ 
    module: 'api', 
    route: '/api/wallet', 
    method: 'GET',
    walletAddress,
    userId 
  });

  try {
    requestLogger.debug('Wallet API request started');

    // Check cache first, but only use if wallet was recently synced
    const cache = ServiceFactory.getWalletCache();
    const cacheKey = ServiceFactory.cacheKey.wallet(walletAddress);
    const cachedData = await cache.get(cacheKey) as WalletData | null;
    
    if (cachedData && cachedData.lastSyncedAt) {
      // Only use cache if wallet was synced within last 5 minutes
      const syncAge = Date.now() - cachedData.lastSyncedAt.getTime();
      
      if (syncAge < 5 * 60 * 1000) {
        requestLogger.debug({ syncAge: Math.round(syncAge / 1000) }, 'Wallet data served from cache');
        return NextResponse.json(cachedData);
      } else {
        requestLogger.debug({ syncAge: Math.round(syncAge / 60000) }, 'Cache invalidated - stale sync');
        // Clear stale cache
        await cache.delete(cacheKey);
      }
    } else if (cachedData) {
      requestLogger.debug('Cache invalidated - never synced');
      // Clear cache for never-synced wallets
      await cache.delete(cacheKey);
    }

    // Get wallet repository from ServiceFactory
    const walletRepo = ServiceFactory.getWalletRepository();
    
    requestLogger.debug('Fetching wallet data from database');

    // Use repository to find wallet
    const walletRecord = await walletRepo.findByAddressAndUser(walletAddress, userId);

    // If no wallet record exists, return empty wallet data for new users
    if (!walletRecord) {
      requestLogger.debug('No wallet record found - new user');
      const emptyWalletResponse: WalletData = {
        address: walletAddress,
        balance: { lovelace: '0', assets: [] },
        utxos: [],
        lastSyncedAt: null,
        syncedBlockHeight: 0
      };

      // Cache the empty response for a short time
      await cache.set(cacheKey, emptyWalletResponse, 60); // 1 minute TTL for empty wallets
      
      return NextResponse.json(emptyWalletResponse);
    }
    
    // For now, we'll get asset information from transactions if needed
    // In the future, we might add a separate asset_balances table
    
    // Transform to WalletData format
    const walletData: WalletData = {
      address: walletRecord.walletAddress,
      balance: {
        lovelace: walletRecord.balanceLovelace?.toString() || '0',
        assets: [] // TODO: Calculate from transactions or add asset_balances table
      },
      utxos: [], // UTXOs not stored separately for now
      lastSyncedAt: walletRecord.lastSyncedAt,
      syncedBlockHeight: walletRecord.syncedBlockHeight || 0
    };
    
    // Cache the wallet data with simple TTL
    const cacheTTL = walletRecord.lastSyncedAt ? 5 * 60 : 60; // 5 minutes if synced, 1 minute if not
    await cache.set(cacheKey, walletData, cacheTTL);
    
    return NextResponse.json(serialize(walletData));
    
  } catch (error) {
    requestLogger.error({ error: error instanceof Error ? error.message : error }, 'Wallet API error');
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
});