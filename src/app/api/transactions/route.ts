/**
 * GET /api/transactions
 * 
 * Fetch user transactions with optional filters and pagination.
 * Uses GET for proper caching and RESTful semantics.
 */

import { NextResponse } from 'next/server';
import { createRepositories } from '@/repositories';
import { TransactionFilterBuilder } from '@/utils/transaction-filter-builder';
import { withAuth } from '@/utils/auth-wrapper';
import { createClient } from '@supabase/supabase-js';
import { DiagnosticLogger } from '@/utils/diagnostic-logger';
import { ServiceFactory } from '@/services/service-factory';
import { logger } from '@/lib/logger';

export const GET = withAuth(async (request, { walletAddress, userId }) => {
  try {
    // JWT must have userId - if not, auth service needs fixing
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid authentication token - missing user ID' },
        { status: 401 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    
    // Build filters using the builder pattern
    const filters = TransactionFilterBuilder.fromSearchParams(searchParams);
    
    // Generate cache key based on wallet, page, and filters
    const cache = ServiceFactory.getTransactionsCache();
    const filterString = JSON.stringify(filters);
    const cacheKey = ServiceFactory.cacheKey.transactions(walletAddress, page, filterString);
    
    // Check cache first
    const cachedResponse = await cache.get<any>(cacheKey);
    if (cachedResponse) {
      logger.info(`Cache hit for transactions ${walletAddress.slice(0, 12)}... page ${page}`);
      DiagnosticLogger.logApiResponse('/api/transactions - CACHE HIT', cachedResponse);
      
      // Serialize with BigInt support
      const jsonString = JSON.stringify(cachedResponse, (_key, value) => 
        typeof value === 'bigint' ? value.toString() : value
      );
      
      return new NextResponse(jsonString, {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create repository with service role client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const repos = createRepositories(supabase);
    const transactions = await repos.transaction.findByUser(userId, filters);

    // Apply pagination (simple slice for now, could be done in DB query)
    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedTransactions = transactions.slice(startIndex, endIndex);

    // Get sync status from wallets table
    const { data: syncStatus } = await supabase
      .from('wallets')
      .select('last_synced_at, synced_block_height')
      .eq('wallet_address', walletAddress)
      .single();

    // Transform domain objects to DTOs with correct field names
    const transactionDTOs = paginatedTransactions.map(tx => ({
      id: tx.id,
      wallet_address: tx.walletAddress,
      tx_hash: tx.txHash,
      tx_timestamp: tx.tx_timestamp.toISOString(),
      tx_action: tx.tx_action,
      tx_protocol: tx.tx_protocol,
      description: tx.description,
      net_ada_change: tx.netADAChange.toString(),
      fees: tx.fees.toString(),
      block_height: tx.blockHeight,
      asset_flows: tx.assetFlows.map(flow => ({
        token_unit: flow.token.unit,
        net_change: flow.netChange.toString(),
        amount_in: flow.amountIn.toString(),
        amount_out: flow.amountOut.toString(),
        token: {
          unit: flow.token.unit,
          policy_id: flow.token.policyId,
          asset_name: flow.token.assetName,
          name: flow.token.name,
          ticker: flow.token.ticker,
          decimals: flow.token.decimals,
          category: flow.token.category,
          logo: flow.token.logo,
          metadata: flow.token.metadata
        }
      }))
    }));

    // Use custom replacer to handle BigInt serialization
    const response = {
      transactions: transactionDTOs,
      total: transactions.length,
      page,
      pageSize,
      hasMore: endIndex < transactions.length,
      syncStatus: syncStatus ? {
        lastSyncedAt: syncStatus.last_synced_at,
        lastSyncedBlock: syncStatus.synced_block_height
      } : null
    };
    
    // Cache the response
    await cache.set(cacheKey, response);
    
    // Log API response for diagnostics
    DiagnosticLogger.logApiResponse('/api/transactions', response);
    
    // Serialize with BigInt support
    const jsonString = JSON.stringify(response, (_key, value) => 
      typeof value === 'bigint' ? value.toString() : value
    );
    
    return new NextResponse(jsonString, {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
});