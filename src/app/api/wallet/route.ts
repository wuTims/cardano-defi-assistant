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
import { DiagnosticLogger } from '@/utils/diagnostic-logger';
import { ServiceFactory } from '@/services/service-factory';
import type { WalletData } from '@/types/wallet';

export const GET = withAuth(async (request, { walletAddress, userId }) => {
  try {
    DiagnosticLogger.logClientData('wallet/route.ts - START', {
      walletAddress,
      userId,
      timestamp: new Date().toISOString()
    });

    // Check cache first
    const cache = ServiceFactory.getWalletCache();
    const cacheKey = ServiceFactory.cacheKey.wallet(walletAddress);
    const cachedData = await cache.get<WalletData>(cacheKey);
    
    if (cachedData) {
      logger.info(`Cache hit for wallet ${walletAddress.slice(0, 12)}...`);
      DiagnosticLogger.logApiResponse('/api/wallet - CACHE HIT', cachedData);
      return NextResponse.json(cachedData);
    }

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    DiagnosticLogger.logClientData('wallet/route.ts - Fetching wallet data', {
      query: 'SELECT * FROM wallet_with_sync_status',
      params: { walletAddress, userId }
    });

    // Use the JOIN view for a single query
    // The view joins on wallet_id internally but we can query by wallet_address
    const { data: walletRecord, error: walletError } = await supabase
      .from('wallet_with_sync_status')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('user_id', userId)
      .single();

    DiagnosticLogger.logDatabaseQuery(
      'wallet/route.ts - view query result',
      'SELECT FROM wallet_with_sync_status',
      { walletRecord, walletError }
    );
    
    // If no wallet record exists, return empty wallet data for new users
    if (walletError) {
      DiagnosticLogger.logClientData('wallet/route.ts - Wallet error', {
        errorCode: walletError.code,
        errorMessage: walletError.message,
        errorDetails: walletError
      });

      if (walletError.code === 'PGRST116') {
        logger.info(`No wallet data found for ${walletAddress.slice(0, 12)}... (new user)`);
        const emptyWalletResponse: WalletData = {
          address: walletAddress,
          balance: { lovelace: '0', assets: [] },
          utxos: [],
          lastSyncedAt: null,
          syncedBlockHeight: 0
        };

        // Cache the empty response for a short time
        await cache.set(cacheKey, emptyWalletResponse, 60); // 1 minute TTL for empty wallets
        
        DiagnosticLogger.logApiResponse('/api/wallet - empty wallet', emptyWalletResponse);
        return NextResponse.json(emptyWalletResponse);
      }
      
      logger.error('Failed to fetch wallet data', walletError);
      DiagnosticLogger.logClientData('wallet/route.ts - ERROR', walletError, walletError);
      return NextResponse.json(
        { error: 'Failed to fetch wallet data', details: walletError },
        { status: 500 }
      );
    }
    
    // Fetch native assets if any
    const { data: assets } = await supabase
      .from('wallet_assets')
      .select('*')
      .eq('wallet_address', walletAddress);
    
    // Transform to WalletData format using the view data
    const walletData: WalletData = {
      address: walletRecord.wallet_address,
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
    
    // Cache the wallet data
    await cache.set(cacheKey, walletData);
    
    logger.info(`Wallet data fetched for ${walletAddress.slice(0, 12)}... (sync status: ${walletRecord.sync_status})`);
    
    DiagnosticLogger.logApiResponse('/api/wallet - SUCCESS', walletData);
    return NextResponse.json(walletData);
    
  } catch (error) {
    logger.error('Error in wallet fetch endpoint', error);
    DiagnosticLogger.logClientData('wallet/route.ts - EXCEPTION', error, error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
});