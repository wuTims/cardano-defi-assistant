/**
 * GET /api/transactions
 * 
 * Fetch user transactions with optional filters and pagination.
 * Uses GET for proper caching and RESTful semantics.
 */

import { NextResponse } from 'next/server';
import { TransactionFilterBuilder } from '@/utils/transaction-filter-builder';
import { withAuth } from '@/utils/auth-wrapper';
import { ServiceFactory } from '@/services/service-factory';
import { prisma, serialize } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const GET = withAuth(async (request, { walletAddress, userId }) => {
  // Create child logger for this specific request
  const requestLogger = logger.child({ 
    module: 'api', 
    route: '/api/transactions', 
    method: 'GET',
    walletAddress,
    userId 
  });

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
    const cachedResponse = await cache.get(cacheKey);
    if (cachedResponse) {
      requestLogger.debug({ page, cacheKey }, 'Transactions served from cache');
      
      return NextResponse.json(serialize(cachedResponse));
    }

    // Get repository from ServiceFactory
    const transactionRepo = ServiceFactory.getTransactionRepository();
    const transactions = await transactionRepo.findByUser(userId, filters);

    // Apply pagination (simple slice for now, could be done in DB query)
    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedTransactions = transactions.slice(startIndex, endIndex);

    // Get sync status from wallets table using Prisma
    const wallet = await prisma.wallet.findFirst({
      where: { walletAddress },
      select: { 
        lastSyncedAt: true, 
        syncedBlockHeight: true 
      }
    });

    // Transform domain objects to DTOs with correct field names
    const transactionDTOs = paginatedTransactions.map(tx => ({
      transaction_id: tx.id,  // Match database field name
      wallet_address: tx.walletAddress,
      tx_hash: tx.txHash,
      tx_timestamp: tx.txTimestamp.toISOString(),
      tx_action: tx.txAction,
      tx_protocol: tx.txProtocol,
      description: tx.description,
      net_ada_change: tx.netAdaChange.toString(),
      fees: tx.fees.toString(),
      block_height: tx.blockHeight,
      asset_flows: tx.assetFlows.map(flow => ({
        token_unit: flow.tokenUnit,
        net_change: flow.netChange.toString(),
        in_flow: flow.inFlow.toString(),
        out_flow: flow.outFlow.toString(),
        token: flow.token ? {
          unit: flow.token.unit,
          policy_id: flow.token.policyId,
          asset_name: flow.token.assetName,
          name: flow.token.name,
          ticker: flow.token.ticker,
          decimals: flow.token.decimals,
          category: flow.token.category
        } : null
      }))
    }));

    // Build response
    const response = {
      transactions: transactionDTOs,
      total: transactions.length,
      page,
      pageSize,
      hasMore: endIndex < transactions.length,
      syncStatus: wallet ? {
        lastSyncedAt: wallet.lastSyncedAt,
        lastSyncedBlock: wallet.syncedBlockHeight
      } : null
    };
    
    // Cache the response
    await cache.set(cacheKey, response);
    
    // Use centralized serialization
    return NextResponse.json(serialize(response));

  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
});