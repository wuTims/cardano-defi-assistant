/**
 * Blockchain Data Fetcher Interfaces
 * 
 * Following Interface Segregation Principle (ISP) from SOLID
 * Split into focused interfaces for different concerns
 */

import type { RawTransaction } from '@/types/transaction';

/**
 * UTXO data structure from blockchain
 */
export type UTXO = {
  readonly tx_hash: string;
  readonly output_index: number;
  readonly address: string;
  readonly amount: readonly {
    readonly unit: string;
    readonly quantity: string;
  }[];
  readonly block: string;
  readonly data_hash?: string;
  readonly inline_datum?: string;
  readonly reference_script_hash?: string;
};

/**
 * Token metadata from blockchain
 */
export type TokenMetadata = {
  readonly asset: string;
  readonly policy_id: string;
  readonly asset_name: string;
  readonly fingerprint: string;
  readonly quantity: string;
  readonly initial_mint_tx_hash: string;
  readonly mint_or_burn_count: number;
  readonly metadata?: {
    readonly name?: string;
    readonly ticker?: string;
    readonly decimals?: number;
    readonly description?: string;
    readonly url?: string;
    readonly logo?: string;
  };
};

/**
 * Interface for fetching blockchain transaction data
 * Single Responsibility: Only transaction-related fetching
 */
export interface IBlockchainDataFetcher {
  /**
   * Fetch transaction hashes for an address
   * Returns paginated results as async iterator for memory efficiency
   */
  fetchAddressTransactions(
    address: string,
    fromBlock?: number,
    toBlock?: number
  ): AsyncIterableIterator<string[]>;

  /**
   * Fetch full transaction details
   */
  fetchTransactionDetails(hash: string): Promise<RawTransaction>;

  /**
   * Fetch current UTXOs for an address
   */
  fetchAddressUTXOs(address: string): Promise<UTXO[]>;

  /**
   * Get current blockchain tip (latest block)
   */
  getCurrentBlockHeight(): Promise<number>;
}

/**
 * Interface for fetching token metadata
 * Single Responsibility: Only token metadata fetching
 */
export interface ITokenMetadataFetcher {
  /**
   * Fetch metadata for a single token
   */
  fetchTokenMetadata(unit: string): Promise<TokenMetadata | null>;

  /**
   * Fetch metadata for multiple tokens (batch operation)
   */
  fetchTokenMetadataBatch(units: string[]): Promise<Map<string, TokenMetadata>>;
}

/**
 * Combined interface for clients that support both operations
 */
export interface IBlockchainClient extends IBlockchainDataFetcher, ITokenMetadataFetcher {}

/**
 * Configuration for blockchain clients
 */
export type BlockchainClientConfig = {
  readonly apiUrl: string;
  readonly apiKey: string;
  readonly network?: 'mainnet' | 'testnet' | 'preview' | 'preprod';
  readonly rateLimitDelay?: number; // milliseconds between requests
  readonly maxRetries?: number;
  readonly timeout?: number; // request timeout in milliseconds
};