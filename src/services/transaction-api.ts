import { logger } from '@/lib/logger';
import { DiagnosticLogger } from '@/utils/diagnostic-logger';
import { TokenCategory, TransactionAction, Protocol } from '@/types/transaction';
import type { WalletTransaction, TransactionFilters, WalletAssetFlow, TokenInfo } from '@/types/transaction';

/**
 * Transaction data transfer object from API (snake_case from database)
 */
interface TransactionDTO {
  id: string;
  wallet_address: string;
  tx_hash: string;
  tx_timestamp: string;
  tx_action: string;
  net_ada_change: string;
  fees: string;
  block_height: number;
  tx_protocol?: string;
  description?: string;
  metadata?: string;
  asset_flows?: AssetFlowDTO[];
}

/**
 * Asset flow data transfer object from API
 */
interface AssetFlowDTO {
  token_unit: string;
  amount_in: string;
  amount_out: string;
  net_change: string;
  token?: TokenDTO;
}

/**
 * Token data transfer object from API
 */
interface TokenDTO {
  unit: string;
  policy_id: string;
  asset_name: string;
  name: string;
  ticker: string;
  decimals: number;
  category: string;
  logo?: string;
  metadata?: Record<string, unknown>;
}

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
  transactions: TransactionDTO[];
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
 * Transform transaction DTO to domain model
 */
function transformTransaction(dto: TransactionDTO): WalletTransaction {
  // Validate required fields
  if (!dto.tx_timestamp) {
    throw new Error(`Transaction ${dto.id} missing required timestamp`);
  }
  if (!dto.tx_hash) {
    throw new Error(`Transaction ${dto.id} missing required tx_hash`);
  }
  if (!dto.wallet_address) {
    throw new Error(`Transaction ${dto.id} missing required wallet_address`);
  }
  
  return {
    id: dto.id,
    walletAddress: dto.wallet_address,
    txHash: dto.tx_hash,
    tx_timestamp: new Date(dto.tx_timestamp),
    tx_action: dto.tx_action as TransactionAction,
    netADAChange: BigInt(dto.net_ada_change || 0),
    fees: BigInt(dto.fees || 0),
    blockHeight: Number(dto.block_height || 0),
    tx_protocol: dto.tx_protocol as Protocol | undefined,
    description: dto.description || '',
    assetFlows: (dto.asset_flows || []).map(transformAssetFlow)
  };
}

/**
 * Transform asset flow DTO to domain model
 */
function transformAssetFlow(dto: AssetFlowDTO): WalletAssetFlow {
  const token: TokenInfo = dto.token ? {
    unit: dto.token.unit,
    policyId: dto.token.policy_id,
    assetName: dto.token.asset_name,
    name: dto.token.name,
    ticker: dto.token.ticker,
    decimals: Number(dto.token.decimals),
    category: dto.token.category as TokenCategory,
    logo: dto.token.logo,
    metadata: dto.token.metadata
  } : {
    // Fallback for missing token info
    unit: dto.token_unit,
    policyId: dto.token_unit.slice(0, 56),
    assetName: dto.token_unit.slice(56),
    name: 'Unknown Token',
    ticker: 'UNKNOWN',
    decimals: 0,
    category: TokenCategory.FUNGIBLE
  };

  return {
    token,
    amountIn: BigInt(dto.amount_in || 0),
    amountOut: BigInt(dto.amount_out || 0),
    netChange: BigInt(dto.net_change || 0)
  };
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
      const transactions = (data.transactions || []).map((dto: TransactionDTO, index: number) => {
        try {
          const transformed = transformTransaction(dto);
          DiagnosticLogger.logTransformation(
            `transaction-api.transformTransaction[${index}]`,
            dto,
            transformed
          );
          return transformed;
        } catch (error) {
          logger.error(`Failed to transform transaction at index ${index}`, error);
          DiagnosticLogger.logClientData(
            `transaction-api.transformTransaction[${index}] - ERROR`,
            { dto, error }
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