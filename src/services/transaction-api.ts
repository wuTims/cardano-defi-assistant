import { logger } from '@/lib/logger';
import { DiagnosticLogger } from '@/utils/diagnostic-logger';
import { TokenCategory, TransactionAction, Protocol } from '@/types/transaction';
import type { WalletTransaction, TransactionFilters, WalletAssetFlow, TokenInfo } from '@/types/transaction';
import type { 
  TransactionPaginatedRow,
  RPCAssetFlow 
} from '@/types/database';

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
 * Raw API response structure
 */
interface RawTransactionResponse {
  transactions: TransactionPaginatedRow[];
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
function transformTransaction(row: TransactionPaginatedRow): WalletTransaction {
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
function transformAssetFlows(assetFlows: RPCAssetFlow[] | string | null): WalletAssetFlow[] {
  if (!assetFlows) return [];
  
  // Handle both array and JSON string formats
  const flows: RPCAssetFlow[] = Array.isArray(assetFlows) 
    ? assetFlows 
    : (typeof assetFlows === 'string' ? JSON.parse(assetFlows) : []);

  return flows.map((flow: RPCAssetFlow) => {
    const token: TokenInfo = {
      unit: flow.token_unit,
      policyId: flow.policy_id || flow.token_unit.slice(0, 56),
      assetName: flow.asset_name || flow.token_unit.slice(56),
      name: flow.name || 'Unknown Token',
      ticker: flow.ticker || 'UNKNOWN',
      decimals: flow.decimals || 0,
      category: (flow.category || 'fungible') as TokenCategory,
      logo: flow.logo,
      metadata: flow.metadata
    };

    return {
      token,
      amountIn: BigInt(flow.in_flow || 0),
      amountOut: BigInt(flow.out_flow || 0),
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
      DiagnosticLogger.logClientData('transaction-api.fetchTransactions - Raw Response', data);

      // Transform each transaction with proper error handling
      const transactions = (data.transactions || []).map((row: TransactionPaginatedRow, index: number) => {
        try {
          const transformed = transformTransaction(row);
          DiagnosticLogger.logTransformation(
            `transaction-api.transformTransaction[${index}]`,
            row,
            transformed
          );
          return transformed;
        } catch (error) {
          logger.error(`Failed to transform transaction at index ${index}`, error);
          DiagnosticLogger.logClientData(
            `transaction-api.transformTransaction[${index}] - ERROR`,
            { row, error }
          );
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
      logger.error('Failed to fetch transactions', error);
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