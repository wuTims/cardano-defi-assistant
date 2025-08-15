/**
 * Service Interfaces - SOLID Principles Compliance
 * 
 * Following Interface Segregation Principle with small, focused interfaces
 * Supporting Dependency Inversion by defining contracts, not implementations
 */

import type {
  WalletTransaction,
  WalletAssetFlow,
  WalletFilterResult,
  TokenInfo,
  TokenCategory,
  TransactionFilters,
  RawTransaction,
  TxInput,
  TxOutput
} from '@/types/transaction';
import { TransactionAction, Protocol } from '@/types/transaction';

// WALLET FILTERING INTERFACES

/**
 * Interface for filtering transaction data by wallet address
 * Single Responsibility: Wallet-specific data filtering
 */
export interface IWalletFilter {
  isWalletInput(input: TxInput, address: string): boolean;
  isWalletOutput(output: TxOutput, address: string): boolean;
  filterForWallet(tx: RawTransaction, address: string): WalletFilterResult;
}

/**
 * Interface for calculating asset flows from transaction data
 * Single Responsibility: Asset flow calculations
 */
export interface IAssetFlowCalculator {
  calculateAssetFlows(
    inputs: readonly TxInput[],
    outputs: readonly TxOutput[],
    walletAddress: string
  ): WalletAssetFlow[];
  
  calculateNetADAChange(flows: readonly WalletAssetFlow[]): bigint;
}

// TOKEN REGISTRY INTERFACES

/**
 * Interface for token information retrieval
 * Single Responsibility: Token metadata management
 */
export interface ITokenRegistry {
  getTokenInfo(unit: string): Promise<TokenInfo | null>;
  batchGetTokenInfo(units: readonly string[]): Promise<Map<string, TokenInfo>>;
}

/**
 * Interface for token caching
 * Single Responsibility: Token cache management
 */
export interface ITokenCache {
  get(unit: string): TokenInfo | null;
  set(unit: string, token: TokenInfo): void;
  has(unit: string): boolean;
  clear(): void;
}

// TRANSACTION CATEGORIZATION INTERFACES

/**
 * Interface for transaction categorization
 * Single Responsibility: Transaction action detection
 */
export interface ITransactionCategorizer {
  categorize(
    tx: RawTransaction,
    flows: readonly WalletAssetFlow[]
  ): TransactionAction;
  
  detectProtocol(tx: RawTransaction, flows?: readonly WalletAssetFlow[]): Protocol | null;
}

/**
 * Interface for categorization rules
 * Open/Closed Principle: Extensible via new implementations
 */
export interface ICategorizationRule {
  readonly priority: number;
  matches(tx: RawTransaction, flows: readonly WalletAssetFlow[]): boolean;
  getAction(tx: RawTransaction, flows: readonly WalletAssetFlow[]): TransactionAction;
  getProtocol(): Protocol;
}

// TRANSACTION PARSING INTERFACES

/**
 * Interface for parsing raw transactions into wallet-centric format
 * Single Responsibility: Transaction parsing orchestration
 */
export interface ITransactionParser {
  parseTransaction(
    rawTx: RawTransaction,
    walletAddress: string
  ): Promise<WalletTransaction | null>;
  
  parseTransactionBatch(
    rawTxs: readonly RawTransaction[],
    walletAddress: string
  ): Promise<WalletTransaction[]>;
}

// REPOSITORY INTERFACES (Data Access Layer)

/**
 * Interface for wallet transaction persistence
 * Single Responsibility: Transaction data access
 */
export interface ITransactionRepository {
  save(transaction: WalletTransaction, userId: string): Promise<void>;
  saveBatch(transactions: readonly WalletTransaction[], userId: string): Promise<void>;
  findByUser(userId: string, filters?: TransactionFilters): Promise<WalletTransaction[]>;
  findByTxHash(txHash: string, userId: string): Promise<WalletTransaction | null>;
  getLatestBlock(userId: string): Promise<number | null>;
  delete(txHash: string, userId: string): Promise<void>;
  deleteByUser(userId: string): Promise<void>;
}

/**
 * Interface for token metadata persistence
 * Single Responsibility: Token data access
 */
export interface ITokenRepository {
  findByUnit(unit: string): Promise<TokenInfo | null>;
  save(token: TokenInfo): Promise<void>;
  saveBatch(tokens: readonly TokenInfo[]): Promise<void>;
  findByCategory(category: TokenCategory): Promise<TokenInfo[]>;
  findByPolicy(policyId: string): Promise<TokenInfo[]>;
  delete(unit: string): Promise<void>;
  cleanup(olderThan: Date): Promise<void>;
}

// TRANSACTION FETCHING INTERFACES

/**
 * Interface for fetching transaction data from external APIs
 * Single Responsibility: External API integration
 */
export interface ITransactionFetcher {
  fetchTransactionHistory(
    address: string,
    fromBlock?: number,
    count?: number
  ): Promise<RawTransaction[]>;
  
  fetchTransaction(txHash: string): Promise<RawTransaction | null>;
  getCurrentBlockHeight(): Promise<number>;
}

// VALIDATION INTERFACES

/**
 * Interface for validating transaction data
 * Single Responsibility: Data validation
 */
export interface ITransactionValidator {
  validateRawTransaction(tx: RawTransaction): boolean;
  validateWalletTransaction(tx: WalletTransaction): boolean;
  validateAssetFlows(flows: readonly WalletAssetFlow[]): boolean;
}

/**
 * Interface for validating wallet addresses
 * Single Responsibility: Address validation
 */
export interface IAddressValidator {
  isValidCardanoAddress(address: string): boolean;
  getAddressType(address: string): 'payment' | 'stake' | 'script' | 'unknown';
  normalizeAddress(address: string): string;
}