/**
 * Transaction Types & Enums - Wallet-Centric Transaction Processing
 * 
 * Following SOLID principles and TypeScript best practices:
 * - Enums for type safety (no string unions per CLAUDE.md)
 * - Types for data structures (DTOs)
 * - Interfaces for service contracts (defined separately)
 * - Readonly properties for immutability
 */

// ENUMS - For type safety (per CLAUDE.md guidelines)
export enum TransactionAction {
  // Basic Operations
  RECEIVE = 'receive',
  SEND = 'send',
  
  // DEX Operations  
  SWAP = 'swap',
  PROVIDE_LIQUIDITY = 'provide_liquidity',
  REMOVE_LIQUIDITY = 'remove_liquidity',
  
  // Staking
  STAKE = 'stake',
  UNSTAKE = 'unstake',
  CLAIM_REWARDS = 'claim_rewards',
  
  // Lending/Borrowing
  SUPPLY = 'supply',        // Provide assets to lending protocol (receive qTokens)
  WITHDRAW = 'withdraw',    // Remove supplied assets (burn qTokens)
  BORROW = 'borrow',        // Take a loan against collateral
  REPAY = 'repay',          // Pay back a loan
  LEND = 'lend',            // Legacy/alternative term for SUPPLY
  COLLATERALIZE = 'collateralize',
  
  // Fallback
  UNKNOWN = 'unknown'
}

export enum TokenCategory {
  NATIVE = 'native',
  FUNGIBLE = 'fungible',
  LP_TOKEN = 'lp_token',
  Q_TOKEN = 'q_token',
  GOVERNANCE = 'governance',
  STABLECOIN = 'stablecoin',
  NFT = 'nft'
}

export enum Protocol {
  MINSWAP = 'minswap',
  LIQWID = 'liqwid',
  SUNDAESWAP = 'sundaeswap',
  WINGRIDERS = 'wingriders',
  INDIGO = 'indigo',
  DJED = 'djed',
  UNKNOWN = 'unknown'
}

// TYPES - For data structures (DTOs)

/**
 * Wallet-centric transaction - only contains data relevant to the connected wallet
 */
export type WalletTransaction = {
  readonly id: string;
  readonly walletAddress: string;
  readonly txHash: string;
  readonly blockHeight: number;
  readonly tx_timestamp: Date;
  readonly tx_action: TransactionAction;
  readonly assetFlows: readonly WalletAssetFlow[];
  readonly netADAChange: bigint;
  readonly fees: bigint;
  readonly tx_protocol?: Protocol;
  readonly description: string;
};

/**
 * Asset flow for a specific token from wallet perspective
 */
export type WalletAssetFlow = {
  readonly token: TokenInfo;
  readonly inFlow: bigint;   // What came into wallet
  readonly outFlow: bigint;  // What left wallet
  readonly netChange: bigint;  // Positive = gained, negative = lost
};

/**
 * Token metadata information
 */
export type TokenInfo = {
  readonly unit: string;
  readonly policyId: string;
  readonly assetName: string;
  readonly name: string;
  readonly ticker: string;
  readonly decimals: number;
  readonly category: TokenCategory;
  readonly logo?: string;
  readonly metadata?: Record<string, unknown>;
};

/**
 * Result of filtering a raw transaction for wallet relevance
 */
export type WalletFilterResult = {
  readonly inputs: readonly TxInput[];
  readonly outputs: readonly TxOutput[];
  readonly isRelevant: boolean;
};

/**
 * Filters for querying transactions
 */
export type TransactionFilters = {
  action?: TransactionAction;
  protocol?: Protocol;
  fromDate?: Date;
  toDate?: Date;
  minAmount?: bigint;
  tokenUnit?: string;
};

// Raw blockchain types (from external APIs)
export type RawTransaction = {
  readonly hash: string;
  readonly block: string;
  readonly block_height: number;
  readonly block_time: number;
  readonly slot: number;
  readonly index: number;
  readonly inputs: readonly TxInput[];
  readonly outputs: readonly TxOutput[];
  readonly fees: string;
  readonly metadata?: any;
  readonly certificates?: readonly Certificate[];
  readonly withdrawals?: readonly Withdrawal[];
};

export type TxInput = {
  readonly address: string;
  readonly amount: readonly AssetAmount[];
  readonly tx_hash: string;
  readonly output_index: number;
  readonly data_hash?: string;
  readonly inline_datum?: string;
  readonly reference_script_hash?: string;
};

export type TxOutput = {
  readonly address: string;
  readonly amount: readonly AssetAmount[];
  readonly output_index: number;
  readonly data_hash?: string;
  readonly inline_datum?: string;
  readonly reference_script_hash?: string;
};

export type AssetAmount = {
  readonly unit: string;
  readonly quantity: string;
};

export type Certificate = {
  readonly cert_index: number;
  readonly type: string;
  readonly address: string;
  readonly pool_id?: string;
};

export type Withdrawal = {
  readonly address: string;
  readonly amount: string;
};

// Function type definitions
export type AssetAggregator = (
  assets: readonly AssetAmount[]
) => Map<string, bigint>;

export type TransactionDescriptionGenerator = (
  action: TransactionAction,
  flows: readonly WalletAssetFlow[],
  protocol?: Protocol
) => string;

// Sync and API response types
export type SyncResult = {
  readonly success: boolean;
  readonly walletAddress: string;
  readonly syncedAt: Date;
  readonly blockHeight: number;
  readonly transactionCount: number;
  readonly error?: string;
};

export type ApiResponse<T> = {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly statusCode?: number;
};