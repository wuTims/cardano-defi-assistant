import { logger } from '@/lib/logger';
import { TokenCategory, TransactionAction, Protocol } from '@/core/types/transaction';

// Create module-level logger once
const transactionApiLogger = logger.child({ module: 'transaction-api' });
import type { WalletTransaction, TransactionFilters, WalletAssetFlow, TokenInfo } from '@/core/types/transaction';

/**
 * Transaction API response interface
 */
export interface TransactionResponse {
  transactions: WalletTransaction[];
  hasMore: boolean;
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Raw transaction from API (matches what transaction route returns)
 */
interface RawTransaction {
  transaction_id: string;
  wallet_address: string;
  tx_hash: string;
  tx_timestamp: string;
  tx_action: string;
  tx_protocol?: string;
  description?: string;
  net_ada_change: string;
  fees: string;
  block_height: number;
  asset_flows: Array<{
    token_unit: string;
    net_change: string;
    in_flow: string;
    out_flow: string;
    token?: {
      unit: string;
      policy_id: string;
      asset_name: string;
      name?: string;
      ticker?: string;
      decimals: number;
      category: string;
      logo?: string;
    };
  }>;
}

/**
 * Raw API response structure
 */
interface RawTransactionResponse {
  transactions: RawTransaction[];
  hasMore: boolean;
  total: number;
  page: number;
  pageSize: number;
  syncStatus?: {
    lastSyncedAt: string;
    lastSyncedBlock: number;
  } | null;
}

/**
 * Transform transaction from database/API to domain model
 */
function transformTransaction(row: RawTransaction): WalletTransaction {
  // Validate required fields
  if (!row.tx_timestamp) {
    throw new Error(`Transaction ${row.transaction_id} missing required timestamp`);
  }
  if (!row.tx_hash) {
    throw new Error(`Transaction ${row.transaction_id} missing required tx_hash`);
  }
  if (!row.wallet_address) {
    throw new Error(`Transaction ${row.transaction_id} missing required wallet_address`);
  }
  
  return {
    id: row.transaction_id,
    walletAddress: row.wallet_address,
    txHash: row.tx_hash,
    tx_timestamp: new Date(row.tx_timestamp),
    tx_action: row.tx_action as TransactionAction,
    netADAChange: BigInt(row.net_ada_change || 0),
    fees: BigInt(row.fees || 0),
    blockHeight: Number(row.block_height || 0),
    tx_protocol: row.tx_protocol as Protocol | undefined,
    description: row.description || '',
    assetFlows: transformAssetFlows(row.asset_flows)
  };
}

/**
 * Transform asset flows from database/API to domain model
 */
function transformAssetFlows(flows: RawTransaction['asset_flows']): WalletAssetFlow[] {
  if (!flows || !Array.isArray(flows)) return [];

  return flows.map(flow => {
    const token: TokenInfo = flow.token ? {
      unit: flow.token.unit,
      policyId: flow.token.policy_id,
      assetName: flow.token.asset_name,
      name: flow.token.name || 'Unknown Token',
      ticker: flow.token.ticker || 'UNKNOWN',
      decimals: flow.token.decimals || 0,
      category: (flow.token.category || 'fungible') as TokenCategory,
      logo: flow.token.logo,
      metadata: undefined
    } : {
      // Fallback if token data is missing
      unit: flow.token_unit,
      policyId: flow.token_unit.slice(0, 56),
      assetName: flow.token_unit.slice(56),
      name: 'Unknown Token',
      ticker: 'UNKNOWN',
      decimals: 0,
      category: TokenCategory.FUNGIBLE,
      metadata: undefined
    };

    return {
      token,
      inFlow: BigInt(flow.in_flow || 0),
      outFlow: BigInt(flow.out_flow || 0),
      netChange: BigInt(flow.net_change || 0)
    };
  });
}

/**
 * Transaction API Service
 * 
 * Handles transaction fetching with pagination and filtering.
 * Follows SOLID principles - single responsibility for transaction API calls.
 */
export class TransactionApiService {
  private abortControllers = new Map<string, AbortController>();

  /**
   * Build query parameters from filters
   */
  private buildQueryParams(
    page: number,
    pageSize: number,
    filters?: TransactionFilters
  ): URLSearchParams {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (filters) {
      // Only add defined filter values
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          const paramValue = value instanceof Date 
            ? value.toISOString() 
            : value.toString();
          params.append(key, paramValue);
        }
      });
    }

    return params;
  }

  /**
   * Fetch transactions with pagination and filters
   */
  async fetchTransactions(
    address: string,
    token: string,
    page: number = 0,
    pageSize: number = 50,
    filters?: TransactionFilters
  ): Promise<TransactionResponse> {
    if (!token) {
      throw new Error('Authentication required');
    }

    if (!address) {
      throw new Error('Wallet address required');
    }

    const params = this.buildQueryParams(page, pageSize, filters);

    try {
      const response = await fetch(`/api/transactions?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: this.getSignal(`transactions-${address}-${page}`),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed');
        }
        throw new Error(`Failed to fetch transactions: ${response.status}`);
      }

      const data: RawTransactionResponse = await response.json();

      // Log raw API response
      transactionApiLogger.debug({ 
        responseCount: data.transactions?.length || 0,
        hasMore: data.hasMore,
        total: data.total,
        page: data.page
      }, 'Raw API response received');

      // Transform each transaction with proper error handling
      const transactions = (data.transactions || []).map((row: RawTransaction, index: number) => {
        try {
          const transformed = transformTransaction(row);
          
          // Log transformation success at trace level
          transactionApiLogger.trace({ 
            txIndex: index, 
            txHash: row.tx_hash 
          }, 'Transaction transformed successfully');
          
          return transformed;
        } catch (error) {
          logger.error({ err: error, index }, `Failed to transform transaction at index ${index}`);
          
          // Log error details with context
          transactionApiLogger.error({
            txIndex: index,
            txHash: row.tx_hash,
            error: error instanceof Error ? error.message : error
          }, 'Transaction transformation failed');
          
          // Skip invalid transactions
          return null;
        }
      }).filter((tx): tx is WalletTransaction => tx !== null);

      return {
        transactions,
        hasMore: data.hasMore ?? (transactions.length >= pageSize),
        total: data.total || transactions.length,
        page: data.page || page,
        pageSize: data.pageSize || pageSize,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.info('Transaction fetch cancelled');
        throw new Error('Request cancelled');
      }
      logger.error({ err: error }, 'Failed to fetch transactions');
      throw error;
    }
  }

  /**
   * Cancel a specific request
   */
  cancelRequest(key: string) {
    const controller = this.abortControllers.get(key);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(key);
    }
  }

  /**
   * Cancel all requests
   */
  cancelAllRequests() {
    this.abortControllers.forEach((controller) => {
      controller.abort();
    });
    this.abortControllers.clear();
  }

  /**
   * Get abort signal for a request
   */
  private getSignal(key: string): AbortSignal {
    // Simple: cancel old, create new
    this.cancelRequest(key);
    
    const controller = new AbortController();
    this.abortControllers.set(key, controller);
    return controller.signal;
  }
}

// Export singleton instance
export const transactionApi = new TransactionApiService();