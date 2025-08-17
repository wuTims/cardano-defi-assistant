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
import { createClient } from '@supabase/supabase-js';
import { withAuth } from '@/utils/auth-wrapper';
import { logger } from '@/lib/logger';

import { ServiceFactory } from '@/services/service-factory';
import { createWalletRepository } from '@/repositories';
import type { WalletData } from '@/types/wallet';

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
    const cachedData = await cache.get<WalletData>(cacheKey);
    
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

    // Create Supabase client and wallet repository
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const walletRepo = createWalletRepository(supabase);
    
    requestLogger.debug('Fetching wallet data from database');

    // Use repository with proper typing
    const walletRecord = await walletRepo.findWithSyncStatus(walletAddress, userId);

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
    
    // Fetch native assets if any
    const { data: assets } = await supabase
      .from('wallet_assets')
      .select('*')
      .eq('wallet_address', walletAddress);
    
    // Transform to WalletData format using the view data
    // Note: Database uses wallet_address, frontend uses address for cleaner API
    const walletData: WalletData = {
      address: walletRecord.wallet_address,  // Map wallet_address -> address
      balance: {
        lovelace: walletRecord.balance_lovelace || '0',
        assets: assets?.map(asset => ({
          unit: asset.unit,
          quantity: asset.quantity,
          policyId: asset.policy_id,
          assetName: asset.asset_name,
          fingerprint: asset.fingerprint
        })) || []
      },
      utxos: [], // UTXOs not stored separately for now
      lastSyncedAt: walletRecord.last_synced_at ? new Date(walletRecord.last_synced_at) : null,
      syncedBlockHeight: walletRecord.last_synced_block || 0
    };
    
    // Cache the wallet data with TTL based on sync status
    const cacheTTL = walletRecord.sync_status === 'fresh' 
      ? 5 * 60   // 5 minutes for fresh data
      : walletRecord.sync_status === 'never'
      ? 60       // 1 minute for never-synced wallets  
      : 2 * 60;  // 2 minutes for stale data
      
    await cache.set(cacheKey, walletData, cacheTTL);
    
    return NextResponse.json(walletData);
    
  } catch (error) {
    requestLogger.error({ error: error instanceof Error ? error.message : error }, 'Wallet API error');
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
});