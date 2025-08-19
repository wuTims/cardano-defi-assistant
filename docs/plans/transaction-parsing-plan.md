# Wallet-Centric Transaction Parsing & Categorization System Plan

Generated: 2025-08-11
Last Updated: 2025-08-11

## Overview

This document outlines the comprehensive plan for implementing a wallet-centric transaction parsing and categorization system for the Cardano DeFi Assistant. The system filters all transaction data by the connected wallet address, ensuring efficient storage and relevant display of only the user's transaction history.

## Core Principle: Wallet-Centric Filtering

**Primary Goal**: Parse and store ONLY data relevant to the connected wallet address, ignoring all other participant data in multi-party transactions. This approach:
- Reduces storage requirements by 90%+
- Improves query performance
- Ensures data privacy and relevance
- Simplifies transaction categorization

## Core Design Principles

### SOLID Principles Application
1. **Single Responsibility**: Each service handles one specific domain
2. **Open/Closed**: Services are extensible via interfaces, not modification
3. **Liskov Substitution**: All implementations conform to interfaces
4. **Interface Segregation**: Small, focused interfaces for each capability
5. **Dependency Inversion**: Services depend on abstractions, not concretions

### TypeScript Best Practices: Interface vs Type

#### When to Use Interfaces (Service Contracts):
- **Contract Definition**: For service behaviors and capabilities
- **Dependency Injection**: Abstract dependencies for testability
- **Extensibility**: When inheritance/implementation is expected
- **Open/Closed Principle**: Can be extended via declaration merging

#### When to Use Types (Data Structures):
- **Data Transfer Objects**: Simple data structures (DTOs)
- **Union/Intersection Types**: Complex type compositions
- **Function Signatures**: Standalone function types
- **Utility Types**: Mapped and conditional types
- **Immutable Data**: Use readonly properties for data integrity

### Additional Principles
1. **Type Safety**: Strong TypeScript types with enums (no string unions)
2. **Deterministic Categorization**: Avoid double-counting for accurate portfolio math
3. **Wallet-Centric**: Filter everything by wallet address first
4. **Performance First**: Efficient caching, batch operations, pagination

## Type Definitions & Enums

### Core Enums (src/types/transaction.ts)
```typescript
// Transaction actions from wallet perspective
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
  LEND = 'lend',
  BORROW = 'borrow',
  REPAY = 'repay',
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
```

### Data Types (DTOs)
```typescript
// Wallet-centric transaction type
export type WalletTransaction = {
  readonly id: string;
  readonly walletAddress: string;
  readonly txHash: string;
  readonly blockHeight: number;
  readonly timestamp: Date;
  readonly action: TransactionAction;
  readonly assetFlows: readonly WalletAssetFlow[];
  readonly netADAChange: bigint;
  readonly fees: bigint;
  readonly protocol?: Protocol;
  readonly description: string;
};

export type WalletAssetFlow = {
  readonly token: TokenInfo;
  readonly amountIn: bigint;   // What came into wallet
  readonly amountOut: bigint;  // What left wallet
  readonly netChange: bigint;  // Positive = gained, negative = lost
};

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

export type WalletFilterResult = {
  readonly inputs: readonly TxInput[];
  readonly outputs: readonly TxOutput[];
  readonly isRelevant: boolean;
};

export type TransactionFilters = {
  readonly action?: TransactionAction;
  readonly protocol?: Protocol;
  readonly fromDate?: Date;
  readonly toDate?: Date;
  readonly minAmount?: bigint;
  readonly tokenUnit?: string;
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
```

## Service Interfaces

### Interface Definitions (src/services/interfaces/index.ts)
```typescript
// Interface Segregation Principle - Small, focused interfaces
export interface IWalletFilter {
  isWalletInput(input: TxInput, address: string): boolean;
  isWalletOutput(output: TxOutput, address: string): boolean;
  filterForWallet(tx: RawTransaction, address: string): WalletFilterResult;
}

export interface IAssetFlowCalculator {
  calculateAssetFlows(
    inputs: readonly TxInput[],
    outputs: readonly TxOutput[],
    walletAddress: string
  ): WalletAssetFlow[];
  calculateNetADAChange(flows: readonly WalletAssetFlow[]): bigint;
}

export interface ITokenRegistry {
  getTokenInfo(unit: string): Promise<TokenInfo | null>;
  batchGetTokenInfo(units: readonly string[]): Promise<Map<string, TokenInfo>>;
  refreshToken(unit: string): Promise<TokenInfo | null>;
}

export interface ITokenCache {
  get(unit: string): TokenInfo | null;
  set(unit: string, token: TokenInfo): void;
  has(unit: string): boolean;
  clear(): void;
}

export interface ITransactionCategorizer {
  categorize(tx: RawTransaction, flows: readonly WalletAssetFlow[]): TransactionAction;
  detectProtocol(tx: RawTransaction): Protocol | null;
}

export interface ICategorizationRule {
  readonly priority: number;
  matches(tx: RawTransaction, flows: readonly WalletAssetFlow[]): boolean;
  getAction(tx: RawTransaction, flows: readonly WalletAssetFlow[]): TransactionAction;
  getProtocol(): Protocol;
}

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

export interface ITransactionRepository {
  save(transaction: WalletTransaction, userId: string): Promise<void>;
  saveBatch(transactions: readonly WalletTransaction[], userId: string): Promise<void>;
  findByUser(userId: string, filters?: TransactionFilters): Promise<WalletTransaction[]>;
  findByTxHash(txHash: string, userId: string): Promise<WalletTransaction | null>;
  getLatestBlock(userId: string): Promise<number | null>;
}

export interface ITokenRepository {
  findByUnit(unit: string): Promise<TokenInfo | null>;
  save(token: TokenInfo): Promise<void>;
  saveBatch(tokens: readonly TokenInfo[]): Promise<void>;
  findByCategory(category: TokenCategory): Promise<TokenInfo[]>;
}
```

## Categorization Rules

### Detection Heuristics (Priority Order)

1. **Protocol-Specific (Priority 1)**
   - Liqwid: qTokens (qADA, qiUSD), market state tokens (*ST), action tokens (*AXN)
   - Minswap: LP tokens with MIN prefix, specific metadata patterns
   - Known script addresses for each protocol

2. **Asset Flow Patterns (Priority 2)**
   - Swap: Multiple tokens with opposite flows
   - LP Operations: LP token mints/burns with underlying assets
   - Lending: Position token mints (qTokens) with asset deposits

3. **Simple Transfers (Priority 3)**
   - Single direction flows (all in or all out)
   - No protocol tokens involved
   - Basic ADA transfers with fees only

### Known Protocols & Token Patterns

**Liqwid Protocol Tokens**:
- Position tokens: qADA, qiUSD (minted when lending)
- Market State: AdaST, SNEKST, iUSDST
- Action tokens: AdaAXN, SNEKAXN
- Borrow tokens: SNEKBOR

**DEX LP Tokens**:
- Minswap: MIN prefix or suffix in LP tokens
- SundaeSwap: SUNDAE LP tokens
- WingRiders: WR prefix in LP tokens

**Token Detection Strategy**:
1. Check token ticker/name patterns
2. Verify against known policy IDs
3. Fetch metadata from Cardano Token Registry API
4. Cache results for performance

## Core Services Architecture

### 1. WalletTransactionFilter Service
**Purpose**: Filter transaction data for wallet relevance
**Location**: `src/services/wallet-transaction-filter.ts`
**Implements**: `IWalletFilter`, `IAssetFlowCalculator`

```typescript
export class WalletTransactionFilter implements IWalletFilter, IAssetFlowCalculator {
  // Filter methods
  public isWalletInput(input: TxInput, address: string): boolean {
    return input.address === address;
  }

  public isWalletOutput(output: TxOutput, address: string): boolean {
    return output.address === address;
  }

  public filterForWallet(tx: RawTransaction, address: string): WalletFilterResult {
    const inputs = tx.inputs.filter(i => this.isWalletInput(i, address));
    const outputs = tx.outputs.filter(o => this.isWalletOutput(o, address));
    return {
      inputs,
      outputs,
      isRelevant: inputs.length > 0 || outputs.length > 0
    };
  }

  // Asset flow calculation
  public calculateAssetFlows(
    inputs: readonly TxInput[],
    outputs: readonly TxOutput[],
    walletAddress: string
  ): WalletAssetFlow[] {
    const walletInputs = inputs.filter(i => i.address === walletAddress);
    const walletOutputs = outputs.filter(o => o.address === walletAddress);
    
    const inflows = this.aggregateAssets(walletOutputs.flatMap(o => o.amount));
    const outflows = this.aggregateAssets(walletInputs.flatMap(i => i.amount));
    
    return this.computeNetFlows(inflows, outflows);
  }

  public calculateNetADAChange(flows: readonly WalletAssetFlow[]): bigint {
    const adaFlow = flows.find(f => f.token.unit === 'lovelace');
    return adaFlow?.netChange || 0n;
  }

  private aggregateAssets: AssetAggregator = (assets) => {
    const aggregated = new Map<string, bigint>();
    for (const asset of assets) {
      const current = aggregated.get(asset.unit) || 0n;
      aggregated.set(asset.unit, current + BigInt(asset.quantity));
    }
    return aggregated;
  };

  private computeNetFlows(
    inflows: Map<string, bigint>,
    outflows: Map<string, bigint>
  ): WalletAssetFlow[] {
    const allUnits = new Set([...inflows.keys(), ...outflows.keys()]);
    const flows: WalletAssetFlow[] = [];
    
    for (const unit of allUnits) {
      const amountIn = inflows.get(unit) || 0n;
      const amountOut = outflows.get(unit) || 0n;
      const netChange = amountIn - amountOut;
      
      flows.push({
        token: { unit } as TokenInfo, // Will be enriched later
        amountIn,
        amountOut,
        netChange
      });
    }
    
    return flows;
  }
}
```

### 2. TokenRegistryService
**Purpose**: Manage token metadata with caching and API integration
**Location**: `src/services/token-registry-service.ts`
**Implements**: `ITokenRegistry`

```typescript
class LRUTokenCache implements ITokenCache {
  private cache = new Map<string, TokenInfo>();
  private readonly maxSize = 1000;

  get(unit: string): TokenInfo | null {
    return this.cache.get(unit) || null;
  }

  set(unit: string, token: TokenInfo): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(unit)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(unit, token);
  }

  has(unit: string): boolean {
    return this.cache.has(unit);
  }

  clear(): void {
    this.cache.clear();
  }
}

export class TokenRegistryService implements ITokenRegistry {
  private cache: ITokenCache;
  
  constructor(
    private repository: ITokenRepository,
    cache?: ITokenCache
  ) {
    // Dependency injection
    this.cache = cache || new LRUTokenCache();
  }

  public async getTokenInfo(unit: string): Promise<TokenInfo | null> {
    // 1. Check cache
    const cached = this.cache.get(unit);
    if (cached) return cached;
    
    // 2. Check database
    const dbToken = await this.repository.findByUnit(unit);
    if (dbToken) {
      this.cache.set(unit, dbToken);
      return dbToken;
    }
    
    // 3. Fetch from Cardano Token Registry API
    const apiToken = await this.fetchFromCardanoAPI(unit);
    if (apiToken) {
      await this.repository.save(apiToken);
      this.cache.set(unit, apiToken);
      return apiToken;
    }
    
    return null;
  }

  public async batchGetTokenInfo(
    units: readonly string[]
  ): Promise<Map<string, TokenInfo>> {
    const tokenMap = new Map<string, TokenInfo>();
    const uncachedUnits: string[] = [];
    
    // Check cache first
    for (const unit of units) {
      const cached = this.cache.get(unit);
      if (cached) {
        tokenMap.set(unit, cached);
      } else {
        uncachedUnits.push(unit);
      }
    }
    
    // Fetch uncached tokens
    const tokens = await Promise.all(
      uncachedUnits.map(unit => this.getTokenInfo(unit))
    );
    
    tokens.forEach((token, index) => {
      if (token) {
        tokenMap.set(uncachedUnits[index], token);
      }
    });
    
    return tokenMap;
  }

  public async refreshToken(unit: string): Promise<TokenInfo | null> {
    const token = await this.fetchFromCardanoAPI(unit);
    if (token) {
      await this.repository.save(token);
      this.cache.set(unit, token);
    }
    return token;
  }

  private async fetchFromCardanoAPI(unit: string): Promise<TokenInfo | null> {
    try {
      const response = await fetch(
        `https://tokens.cardano.org/metadata/${unit}`,
        { headers: { 'Accept': 'application/json' } }
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      const token: TokenInfo = {
        unit,
        policyId: unit.slice(0, 56),
        assetName: unit.slice(56),
        name: data.name?.value || '',
        ticker: data.ticker?.value || '',
        decimals: data.decimals?.value || 0,
        category: this.detectCategory(data),
        logo: data.logo?.value,
        metadata: data
      };
      
      return token;
    } catch (error) {
      console.error(`Failed to fetch token ${unit}:`, error);
      return null;
    }
  }

  private detectCategory(metadata: any): TokenCategory {
    const ticker = metadata.ticker?.value || '';
    const name = metadata.name?.value || '';
    
    if (ticker.includes('LP') || name.includes('LP')) return TokenCategory.LP_TOKEN;
    if (ticker.startsWith('q')) return TokenCategory.Q_TOKEN;
    if (name.includes('Governance')) return TokenCategory.GOVERNANCE;
    if (['iUSD', 'DJED', 'USDA', 'USDC'].includes(ticker)) return TokenCategory.STABLECOIN;
    
    return TokenCategory.FUNGIBLE;
  }
}
```

### 3. TransactionCategorizerService
**Purpose**: Apply detection rules to categorize transactions
**Location**: `src/services/transaction-categorizer-service.ts`
**Implements**: `ITransactionCategorizer`

```typescript
// Abstract base class for rules
abstract class BaseCategorizationRule implements ICategorizationRule {
  constructor(public readonly priority: number) {}
  
  abstract matches(tx: RawTransaction, flows: readonly WalletAssetFlow[]): boolean;
  abstract getAction(tx: RawTransaction, flows: readonly WalletAssetFlow[]): TransactionAction;
  abstract getProtocol(): Protocol;
}

// Liqwid Protocol Rule
class LiqwidLendingRule extends BaseCategorizationRule {
  constructor() {
    super(1); // Highest priority
  }

  matches(tx: RawTransaction, flows: readonly WalletAssetFlow[]): boolean {
    return flows.some(f => 
      f.token.ticker?.startsWith('q') || 
      f.token.ticker?.endsWith('ST') ||
      f.token.ticker?.endsWith('AXN')
    );
  }

  getAction(tx: RawTransaction, flows: readonly WalletAssetFlow[]): TransactionAction {
    const hasQTokenIn = flows.some(f => f.amountIn > 0n && f.token.ticker?.startsWith('q'));
    const hasQTokenOut = flows.some(f => f.amountOut > 0n && f.token.ticker?.startsWith('q'));
    
    if (hasQTokenIn && !hasQTokenOut) return TransactionAction.LEND;
    if (hasQTokenOut && !hasQTokenIn) return TransactionAction.BORROW;
    if (hasQTokenIn && hasQTokenOut) return TransactionAction.REPAY;
    
    return TransactionAction.UNKNOWN;
  }

  getProtocol(): Protocol {
    return Protocol.LIQWID;
  }
}

// Minswap DEX Rule
class MinswapDEXRule extends BaseCategorizationRule {
  constructor() {
    super(2);
  }

  matches(tx: RawTransaction, flows: readonly WalletAssetFlow[]): boolean {
    const hasMinswapLP = flows.some(f => 
      f.token.ticker?.includes('MIN') && f.token.category === TokenCategory.LP_TOKEN
    );
    const hasMinswapMetadata = tx.metadata?.['674']?.msg?.includes('MinswapDEX');
    
    return hasMinswapLP || hasMinswapMetadata;
  }

  getAction(tx: RawTransaction, flows: readonly WalletAssetFlow[]): TransactionAction {
    const lpTokens = flows.filter(f => f.token.category === TokenCategory.LP_TOKEN);
    
    if (lpTokens.some(f => f.amountIn > 0n)) {
      return TransactionAction.PROVIDE_LIQUIDITY;
    }
    if (lpTokens.some(f => f.amountOut > 0n)) {
      return TransactionAction.REMOVE_LIQUIDITY;
    }
    
    // Swap detection
    const nonADAFlows = flows.filter(f => f.token.unit !== 'lovelace');
    if (nonADAFlows.length >= 1) {
      return TransactionAction.SWAP;
    }
    
    return TransactionAction.UNKNOWN;
  }

  getProtocol(): Protocol {
    return Protocol.MINSWAP;
  }
}

// Simple Transfer Rule (catch-all)
class SimpleTransferRule extends BaseCategorizationRule {
  constructor() {
    super(100); // Lowest priority
  }

  matches(tx: RawTransaction, flows: readonly WalletAssetFlow[]): boolean {
    return true; // Always matches as fallback
  }

  getAction(tx: RawTransaction, flows: readonly WalletAssetFlow[]): TransactionAction {
    const hasInflow = flows.some(f => f.amountIn > 0n);
    const hasOutflow = flows.some(f => f.amountOut > 0n);
    
    if (hasInflow && !hasOutflow) return TransactionAction.RECEIVE;
    if (hasOutflow && !hasInflow) return TransactionAction.SEND;
    
    return TransactionAction.UNKNOWN;
  }

  getProtocol(): Protocol {
    return Protocol.UNKNOWN;
  }
}

// Main Categorizer Service
export class TransactionCategorizerService implements ITransactionCategorizer {
  private rules: ICategorizationRule[];

  constructor(rules?: ICategorizationRule[]) {
    // Dependency injection with default rules
    this.rules = rules || [
      new LiqwidLendingRule(),
      new MinswapDEXRule(),
      new SimpleTransferRule()
    ];
    
    // Sort by priority
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  public categorize(
    tx: RawTransaction,
    flows: readonly WalletAssetFlow[]
  ): TransactionAction {
    for (const rule of this.rules) {
      if (rule.matches(tx, flows)) {
        return rule.getAction(tx, flows);
      }
    }
    return TransactionAction.UNKNOWN;
  }

  public detectProtocol(tx: RawTransaction): Protocol | null {
    for (const rule of this.rules) {
      if (rule.matches(tx, [])) {
        const protocol = rule.getProtocol();
        if (protocol !== Protocol.UNKNOWN) {
          return protocol;
        }
      }
    }
    return null;
  }
}
```

### 4. WalletTransactionParser
**Purpose**: Orchestrate parsing of raw transactions into wallet-centric format
**Location**: `src/services/wallet-transaction-parser.ts`
**Implements**: `ITransactionParser`

```typescript
export class WalletTransactionParser implements ITransactionParser {
  private generateDescription: TransactionDescriptionGenerator;

  constructor(
    private filter: IWalletFilter & IAssetFlowCalculator,
    private tokenRegistry: ITokenRegistry,
    private categorizer: ITransactionCategorizer,
    descriptionGenerator?: TransactionDescriptionGenerator
  ) {
    // Default description generator if not provided
    this.generateDescription = descriptionGenerator || this.defaultDescriptionGenerator;
  }

  public async parseTransaction(
    rawTx: RawTransaction,
    walletAddress: string
  ): Promise<WalletTransaction | null> {
    // 1. Filter for wallet relevance - CRITICAL STEP
    const filtered = this.filter.filterForWallet(rawTx, walletAddress);
    if (!filtered.isRelevant) return null; // Skip irrelevant transactions

    // 2. Calculate asset flows for wallet only
    const flows = this.filter.calculateAssetFlows(
      filtered.inputs,
      filtered.outputs,
      walletAddress
    );

    // 3. Enrich token information
    const enrichedFlows = await this.enrichTokenInfo(flows);

    // 4. Categorize transaction
    const action = this.categorizer.categorize(rawTx, enrichedFlows);
    const protocol = this.categorizer.detectProtocol(rawTx);

    // 5. Build wallet transaction
    const transaction: WalletTransaction = {
      id: `${walletAddress}-${rawTx.hash}`,
      walletAddress,
      txHash: rawTx.hash,
      blockHeight: rawTx.block_height,
      timestamp: new Date(rawTx.block_time * 1000),
      action,
      assetFlows: enrichedFlows,
      netADAChange: this.filter.calculateNetADAChange(enrichedFlows),
      fees: BigInt(rawTx.fees),
      protocol,
      description: this.generateDescription(action, enrichedFlows, protocol)
    };

    return transaction;
  }

  public async parseTransactionBatch(
    rawTxs: readonly RawTransaction[],
    walletAddress: string
  ): Promise<WalletTransaction[]> {
    const parsed = await Promise.all(
      rawTxs.map(tx => this.parseTransaction(tx, walletAddress))
    );
    
    return parsed.filter((tx): tx is WalletTransaction => tx !== null);
  }

  private async enrichTokenInfo(
    flows: WalletAssetFlow[]
  ): Promise<WalletAssetFlow[]> {
    const units = flows.map(f => f.token.unit);
    const tokenMap = await this.tokenRegistry.batchGetTokenInfo(units);
    
    return flows.map(flow => ({
      ...flow,
      token: tokenMap.get(flow.token.unit) || flow.token
    }));
  }

  private defaultDescriptionGenerator: TransactionDescriptionGenerator = (
    action,
    flows,
    protocol
  ) => {
    const protocolName = protocol ? ` on ${protocol}` : '';
    
    switch (action) {
      case TransactionAction.SWAP: {
        const inToken = flows.find(f => f.amountIn > 0n);
        const outToken = flows.find(f => f.amountOut > 0n);
        if (inToken && outToken) {
          return `Swapped ${outToken.token.ticker} for ${inToken.token.ticker}${protocolName}`;
        }
        return `Token swap${protocolName}`;
      }
      
      case TransactionAction.LEND: {
        const lentToken = flows.find(f => f.amountOut > 0n && !f.token.ticker?.startsWith('q'));
        if (lentToken) {
          return `Lent ${lentToken.token.ticker}${protocolName}`;
        }
        return `Lending operation${protocolName}`;
      }
      
      case TransactionAction.RECEIVE: {
        const mainToken = flows.find(f => f.amountIn > 0n);
        if (mainToken) {
          return `Received ${mainToken.token.ticker}`;
        }
        return 'Received tokens';
      }
      
      case TransactionAction.SEND: {
        const mainToken = flows.find(f => f.amountOut > 0n);
        if (mainToken) {
          return `Sent ${mainToken.token.ticker}`;
        }
        return 'Sent tokens';
      }
      
      default:
        return `${action}${protocolName}`;
    }
  };
}
```

### 5. TransactionFetchService
**Purpose**: Fetch transaction history from Blockfrost API
**Location**: `src/services/transaction-fetch-service.ts`

```typescript
export class TransactionFetchService {
  constructor(
    private blockfrostUrl: string,
    private blockfrostKey: string
  ) {}

  public async fetchTransactionHistory(
    address: string,
    fromBlock?: number
  ): Promise<RawTransaction[]> {
    const transactions: RawTransaction[] = [];
    let page = 1;
    const count = 100; // Max per page
    
    while (true) {
      const response = await fetch(
        `${this.blockfrostUrl}/addresses/${address}/transactions?page=${page}&count=${count}`,
        {
          headers: {
            'project_id': this.blockfrostKey,
            'Accept': 'application/json'
          }
        }
      );
      
      if (!response.ok) break;
      
      const txRefs = await response.json();
      if (txRefs.length === 0) break;
      
      // Fetch full transaction details
      const txDetails = await Promise.all(
        txRefs.map((ref: any) => this.fetchTransactionDetails(ref.tx_hash))
      );
      
      transactions.push(...txDetails);
      
      if (txRefs.length < count) break;
      page++;
    }
    
    return transactions;
  }

  private async fetchTransactionDetails(txHash: string): Promise<RawTransaction> {
    const response = await fetch(
      `${this.blockfrostUrl}/txs/${txHash}`,
      {
        headers: {
          'project_id': this.blockfrostKey,
          'Accept': 'application/json'
        }
      }
    );
    
    const tx = await response.json();
    
    // Fetch UTXOs for inputs and outputs
    const [inputs, outputs] = await Promise.all([
      this.fetchTransactionInputs(txHash),
      this.fetchTransactionOutputs(txHash)
    ]);
    
    return {
      hash: tx.hash,
      block: tx.block,
      block_height: tx.block_height,
      block_time: tx.block_time,
      slot: tx.slot,
      index: tx.index,
      inputs,
      outputs,
      fees: tx.fees,
      metadata: tx.metadata,
      certificates: tx.certificates,
      withdrawals: tx.withdrawals
    };
  }

  private async fetchTransactionInputs(txHash: string): Promise<TxInput[]> {
    const response = await fetch(
      `${this.blockfrostUrl}/txs/${txHash}/utxos`,
      {
        headers: {
          'project_id': this.blockfrostKey,
          'Accept': 'application/json'
        }
      }
    );
    
    const data = await response.json();
    return data.inputs || [];
  }

  private async fetchTransactionOutputs(txHash: string): Promise<TxOutput[]> {
    const response = await fetch(
      `${this.blockfrostUrl}/txs/${txHash}/utxos`,
      {
        headers: {
          'project_id': this.blockfrostKey,
          'Accept': 'application/json'
        }
      }
    );
    
    const data = await response.json();
    return data.outputs || [];
  }
}
```

## Repository Pattern Implementation

### TransactionRepository
**Purpose**: Handle database operations for wallet transactions
**Location**: `src/repositories/transaction-repository.ts`
**Implements**: `ITransactionRepository`

```typescript
export class TransactionRepository implements ITransactionRepository {
  constructor(private supabase: SupabaseClient) {}

  public async save(
    transaction: WalletTransaction,
    userId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('wallet_transactions')
      .upsert({
        user_id: userId,
        wallet_address: transaction.walletAddress,
        tx_hash: transaction.txHash,
        block_height: transaction.blockHeight,
        timestamp: transaction.timestamp.toISOString(),
        action: transaction.action,
        protocol: transaction.protocol,
        description: transaction.description,
        net_ada_change: transaction.netADAChange.toString(),
        fees: transaction.fees.toString(),
        metadata: {
          assetFlows: transaction.assetFlows.map(f => ({
            unit: f.token.unit,
            amountIn: f.amountIn.toString(),
            amountOut: f.amountOut.toString(),
            netChange: f.netChange.toString()
          }))
        }
      });

    if (error) throw new Error(`Failed to save transaction: ${error.message}`);

    // Save asset flows separately for better querying
    await this.saveAssetFlows(transaction, userId);
  }

  public async saveBatch(
    transactions: readonly WalletTransaction[],
    userId: string
  ): Promise<void> {
    const records = transactions.map(tx => ({
      user_id: userId,
      wallet_address: tx.walletAddress,
      tx_hash: tx.txHash,
      block_height: tx.blockHeight,
      timestamp: tx.timestamp.toISOString(),
      action: tx.action,
      protocol: tx.protocol,
      description: tx.description,
      net_ada_change: tx.netADAChange.toString(),
      fees: tx.fees.toString()
    }));

    const { error } = await this.supabase
      .from('wallet_transactions')
      .upsert(records);

    if (error) throw new Error(`Failed to save transactions: ${error.message}`);
  }

  public async findByUser(
    userId: string,
    filters?: TransactionFilters
  ): Promise<WalletTransaction[]> {
    let query = this.supabase
      .from('wallet_transactions')
      .select(`
        *,
        wallet_transaction_assets (
          *,
          tokens (*)
        )
      `)
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    // Apply filters
    if (filters?.action) {
      query = query.eq('action', filters.action);
    }
    if (filters?.protocol) {
      query = query.eq('protocol', filters.protocol);
    }
    if (filters?.fromDate) {
      query = query.gte('timestamp', filters.fromDate.toISOString());
    }
    if (filters?.toDate) {
      query = query.lte('timestamp', filters.toDate.toISOString());
    }

    const { data, error } = await query;
    
    if (error) throw new Error(`Failed to fetch transactions: ${error.message}`);
    
    return this.mapToWalletTransactions(data || []);
  }

  public async findByTxHash(
    txHash: string,
    userId: string
  ): Promise<WalletTransaction | null> {
    const { data, error } = await this.supabase
      .from('wallet_transactions')
      .select(`
        *,
        wallet_transaction_assets (
          *,
          tokens (*)
        )
      `)
      .eq('tx_hash', txHash)
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    
    return this.mapToWalletTransaction(data);
  }

  public async getLatestBlock(userId: string): Promise<number | null> {
    const { data } = await this.supabase
      .from('wallet_transactions')
      .select('block_height')
      .eq('user_id', userId)
      .order('block_height', { ascending: false })
      .limit(1)
      .single();

    return data?.block_height || null;
  }

  private async saveAssetFlows(
    transaction: WalletTransaction,
    userId: string
  ): Promise<void> {
    const flows = transaction.assetFlows.map(flow => ({
      transaction_id: transaction.id,
      token_unit: flow.token.unit,
      amount_in: flow.amountIn.toString(),
      amount_out: flow.amountOut.toString(),
      net_change: flow.netChange.toString()
    }));

    if (flows.length > 0) {
      const { error } = await this.supabase
        .from('wallet_transaction_assets')
        .insert(flows);

      if (error) {
        console.error('Failed to save asset flows:', error);
      }
    }
  }

  private mapToWalletTransactions(data: any[]): WalletTransaction[] {
    return data.map(d => this.mapToWalletTransaction(d));
  }

  private mapToWalletTransaction(data: any): WalletTransaction {
    return {
      id: data.id,
      walletAddress: data.wallet_address,
      txHash: data.tx_hash,
      blockHeight: data.block_height,
      timestamp: new Date(data.timestamp),
      action: data.action as TransactionAction,
      assetFlows: this.mapAssetFlows(data.wallet_transaction_assets || []),
      netADAChange: BigInt(data.net_ada_change || 0),
      fees: BigInt(data.fees || 0),
      protocol: data.protocol as Protocol,
      description: data.description
    };
  }

  private mapAssetFlows(assets: any[]): WalletAssetFlow[] {
    return assets.map(asset => ({
      token: {
        unit: asset.token_unit,
        policyId: asset.tokens?.policy_id || '',
        assetName: asset.tokens?.asset_name || '',
        name: asset.tokens?.name || '',
        ticker: asset.tokens?.ticker || '',
        decimals: asset.tokens?.decimals || 0,
        category: asset.tokens?.category || TokenCategory.FUNGIBLE,
        logo: asset.tokens?.logo
      },
      amountIn: BigInt(asset.amount_in || 0),
      amountOut: BigInt(asset.amount_out || 0),
      netChange: BigInt(asset.net_change || 0)
    }));
  }
}
```

### TokenRepository
**Purpose**: Handle database operations for token metadata
**Location**: `src/repositories/token-repository.ts`
**Implements**: `ITokenRepository`

```typescript
export class TokenRepository implements ITokenRepository {
  constructor(private supabase: SupabaseClient) {}

  public async findByUnit(unit: string): Promise<TokenInfo | null> {
    const { data, error } = await this.supabase
      .from('tokens')
      .select('*')
      .eq('unit', unit)
      .single();

    if (error || !data) return null;

    return this.mapToTokenInfo(data);
  }

  public async save(token: TokenInfo): Promise<void> {
    const { error } = await this.supabase
      .from('tokens')
      .upsert({
        unit: token.unit,
        policy_id: token.policyId,
        asset_name: token.assetName,
        name: token.name,
        ticker: token.ticker,
        decimals: token.decimals,
        category: token.category,
        logo: token.logo,
        metadata: token.metadata,
        source: 'cardano_api',
        fetched_at: new Date().toISOString()
      });

    if (error) throw new Error(`Failed to save token: ${error.message}`);
  }

  public async saveBatch(tokens: readonly TokenInfo[]): Promise<void> {
    const records = tokens.map(token => ({
      unit: token.unit,
      policy_id: token.policyId,
      asset_name: token.assetName,
      name: token.name,
      ticker: token.ticker,
      decimals: token.decimals,
      category: token.category,
      logo: token.logo,
      metadata: token.metadata,
      source: 'cardano_api',
      fetched_at: new Date().toISOString()
    }));

    const { error } = await this.supabase
      .from('tokens')
      .upsert(records);

    if (error) throw new Error(`Failed to save tokens: ${error.message}`);
  }

  public async findByCategory(category: TokenCategory): Promise<TokenInfo[]> {
    const { data, error } = await this.supabase
      .from('tokens')
      .select('*')
      .eq('category', category);

    if (error) throw new Error(`Failed to fetch tokens: ${error.message}`);

    return (data || []).map(d => this.mapToTokenInfo(d));
  }

  private mapToTokenInfo(data: any): TokenInfo {
    return {
      unit: data.unit,
      policyId: data.policy_id,
      assetName: data.asset_name,
      name: data.name,
      ticker: data.ticker,
      decimals: data.decimals,
      category: data.category as TokenCategory,
      logo: data.logo,
      metadata: data.metadata
    };
  }
}
```

## Database Schema

### Migration Files

#### 001_create_tokens_table.sql
```sql
-- Token metadata storage
CREATE TYPE token_category AS ENUM (
  'native',
  'fungible',
  'lp_token',
  'q_token',
  'governance',
  'stablecoin',
  'nft'
);

CREATE TABLE tokens (
  unit TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL,
  asset_name TEXT,
  name TEXT,
  ticker TEXT,
  decimals INTEGER DEFAULT 0,
  logo TEXT,
  category token_category DEFAULT 'fungible',
  metadata JSONB,
  source TEXT DEFAULT 'cardano_api',
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tokens_policy ON tokens(policy_id);
CREATE INDEX idx_tokens_ticker ON tokens(ticker);
CREATE INDEX idx_tokens_category ON tokens(category);
```

#### 002_create_wallet_transactions_table.sql
```sql
-- Transaction action enum
CREATE TYPE transaction_action AS ENUM (
  'receive',
  'send',
  'swap',
  'stake',
  'unstake',
  'claim_rewards',
  'provide_liquidity',
  'remove_liquidity',
  'lend',
  'borrow',
  'repay',
  'collateralize',
  'unknown'
);

-- Protocol enum
CREATE TYPE protocol AS ENUM (
  'minswap',
  'liqwid',
  'sundaeswap',
  'wingriders',
  'indigo',
  'djed',
  'unknown'
);

-- Wallet transactions table
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  block_height INTEGER,
  timestamp TIMESTAMPTZ,
  action transaction_action NOT NULL,
  protocol protocol,
  description TEXT,
  net_ada_change BIGINT,
  fees BIGINT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tx_hash)
);

CREATE INDEX idx_wallet_tx_user ON wallet_transactions(user_id);
CREATE INDEX idx_wallet_tx_timestamp ON wallet_transactions(timestamp DESC);
CREATE INDEX idx_wallet_tx_action ON wallet_transactions(action);
CREATE INDEX idx_wallet_tx_protocol ON wallet_transactions(protocol);
```

#### 003_create_wallet_transaction_assets_table.sql
```sql
-- Transaction asset flows
CREATE TABLE wallet_transaction_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE CASCADE,
  token_unit TEXT REFERENCES tokens(unit),
  amount_in NUMERIC DEFAULT 0,
  amount_out NUMERIC DEFAULT 0,
  net_change NUMERIC NOT NULL
);

CREATE INDEX idx_tx_assets_transaction ON wallet_transaction_assets(transaction_id);
CREATE INDEX idx_tx_assets_token ON wallet_transaction_assets(token_unit);
```

#### 004_create_rls_policies.sql
```sql
-- Enable RLS
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transaction_assets ENABLE ROW LEVEL SECURITY;

-- Policies for wallet_transactions
CREATE POLICY "Users can view own transactions"
  ON wallet_transactions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own transactions"
  ON wallet_transactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own transactions"
  ON wallet_transactions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policies for wallet_transaction_assets
CREATE POLICY "Users can view own transaction assets"
  ON wallet_transaction_assets FOR SELECT
  USING (
    transaction_id IN (
      SELECT id FROM wallet_transactions
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own transaction assets"
  ON wallet_transaction_assets FOR INSERT
  WITH CHECK (
    transaction_id IN (
      SELECT id FROM wallet_transactions
      WHERE user_id = auth.uid()
    )
  );

-- Create view for easy querying
CREATE VIEW user_wallet_transactions AS
SELECT 
  wt.*,
  json_agg(
    json_build_object(
      'token', t.*,
      'amount_in', wta.amount_in,
      'amount_out', wta.amount_out,
      'net_change', wta.net_change
    )
  ) FILTER (WHERE wta.id IS NOT NULL) as asset_flows
FROM wallet_transactions wt
LEFT JOIN wallet_transaction_assets wta ON wta.transaction_id = wt.id
LEFT JOIN tokens t ON t.unit = wta.token_unit
GROUP BY wt.id;
```

## React State Management

### TransactionProvider Context
**Location**: `src/context/TransactionProvider.tsx`

```typescript
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useSupabase } from './SupabaseProvider';
import type { WalletTransaction, TransactionFilters } from '@/types/transaction';

interface TransactionContextType {
  transactions: WalletTransaction[];
  isLoading: boolean;
  isSyncing: boolean;
  filters: TransactionFilters;
  error: string | null;
  
  // Operations
  loadTransactions: () => Promise<void>;
  syncTransactions: () => Promise<void>;
  setFilters: (filters: TransactionFilters) => void;
  clearError: () => void;
}

const TransactionContext = createContext<TransactionContextType | null>(null);

export const useTransactions = (): TransactionContextType => {
  const context = useContext(TransactionContext);
  if (!context) {
    throw new Error('useTransactions must be used within TransactionProvider');
  }
  return context;
};

export const TransactionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { client } = useSupabase();
  
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [error, setError] = useState<string | null>(null);

  // Create service instances with dependency injection
  const createServices = useCallback(() => {
    if (!client) return null;
    
    const tokenRepo = new TokenRepository(client);
    const txRepo = new TransactionRepository(client);
    const filter = new WalletTransactionFilter();
    const tokenRegistry = new TokenRegistryService(tokenRepo);
    const categorizer = new TransactionCategorizerService();
    const parser = new WalletTransactionParser(
      filter,
      tokenRegistry,
      categorizer
    );
    
    return { parser, txRepo };
  }, [client]);

  const loadTransactions = useCallback(async () => {
    if (!user?.id || !client) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const services = createServices();
      if (!services) throw new Error('Services not initialized');
      
      const txs = await services.txRepo.findByUser(user.id, filters);
      setTransactions(txs);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load transactions';
      setError(message);
      console.error('Error loading transactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, client, filters, createServices]);

  const syncTransactions = useCallback(async () => {
    if (!user?.walletAddress || !user?.id || !client) return;
    
    setIsSyncing(true);
    setError(null);
    
    try {
      const services = createServices();
      if (!services) throw new Error('Services not initialized');
      
      // Get latest synced block
      const latestBlock = await services.txRepo.getLatestBlock(user.id);
      
      // Fetch new transactions from Blockfrost
      const fetcher = new TransactionFetchService(
        process.env.NEXT_PUBLIC_BLOCKFROST_URL!,
        process.env.NEXT_PUBLIC_BLOCKFROST_KEY!
      );
      
      const rawTxs = await fetcher.fetchTransactionHistory(
        user.walletAddress,
        latestBlock || undefined
      );
      
      // Parse transactions (wallet-centric filtering happens here)
      const parsed = await services.parser.parseTransactionBatch(
        rawTxs,
        user.walletAddress
      );
      
      // Save to database
      if (parsed.length > 0) {
        await services.txRepo.saveBatch(parsed, user.id);
      }
      
      // Reload transactions
      await loadTransactions();
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync transactions';
      setError(message);
      console.error('Error syncing transactions:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [user, client, createServices, loadTransactions]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load transactions when user changes or filters change
  useEffect(() => {
    if (user?.id && client) {
      loadTransactions();
    }
  }, [user?.id, client, filters]); // loadTransactions is stable due to useCallback

  const value: TransactionContextType = {
    transactions,
    isLoading,
    isSyncing,
    filters,
    error,
    loadTransactions,
    syncTransactions,
    setFilters,
    clearError
  };

  return (
    <TransactionContext.Provider value={value}>
      {children}
    </TransactionContext.Provider>
  );
};
```

## Implementation Phases

### Phase 1: Foundation & Types (Day 1-2)
1. **Create type definitions** (`src/types/transaction.ts`)
   - Enums: TransactionAction, TokenCategory, Protocol
   - Types: WalletTransaction, WalletAssetFlow, TokenInfo
   - Interfaces: All service contracts
2. **Set up project structure**
   - Create service directories
   - Create repository directories
   - Set up interface definitions

### Phase 2: Core Services (Day 3-5)
3. **Implement WalletTransactionFilter**
   - Wallet filtering logic
   - Asset flow calculations
4. **Implement TokenRegistryService**
   - Token caching with LRU
   - Cardano API integration
   - Database persistence
5. **Implement TransactionCategorizerService**
   - Rule-based categorization
   - Protocol detection

### Phase 3: Parser & Fetching (Day 6-7)
6. **Implement WalletTransactionParser**
   - Orchestration logic
   - Token enrichment
   - Description generation
7. **Implement TransactionFetchService**
   - Blockfrost API integration
   - Pagination handling
   - Transaction detail fetching

### Phase 4: Database Layer (Day 8-9)
8. **Create database migrations**
   - Tokens table
   - Wallet transactions table
   - Transaction assets table
   - RLS policies
9. **Implement repositories**
   - TransactionRepository
   - TokenRepository

### Phase 5: React Integration (Day 10-11)
10. **Create TransactionProvider**
    - State management
    - Service orchestration
    - Error handling
11. **Update existing contexts**
    - Integrate with AuthContext
    - Update WalletProvider

### Phase 6: UI Components (Day 12-14)
12. **TransactionList component**
    - Virtual scrolling
    - Filter controls
    - Action icons
13. **TransactionDetail component**
    - Asset flow display
    - Protocol badges
    - Timestamp formatting
14. **Dashboard integration**
    - Transaction summary
    - Recent transactions
    - Quick filters

## Testing Strategy

### Unit Tests
```typescript
// Example: WalletTransactionFilter.test.ts
describe('WalletTransactionFilter', () => {
  let filter: WalletTransactionFilter;
  
  beforeEach(() => {
    filter = new WalletTransactionFilter();
  });
  
  describe('filterForWallet', () => {
    it('should filter inputs and outputs for wallet address', () => {
      const tx = createMockTransaction();
      const result = filter.filterForWallet(tx, 'addr1...');
      
      expect(result.isRelevant).toBe(true);
      expect(result.inputs).toHaveLength(1);
      expect(result.outputs).toHaveLength(2);
    });
    
    it('should mark irrelevant transactions', () => {
      const tx = createMockTransaction();
      const result = filter.filterForWallet(tx, 'different_address');
      
      expect(result.isRelevant).toBe(false);
    });
  });
  
  describe('calculateAssetFlows', () => {
    it('should calculate net flows correctly', () => {
      const inputs = [/* mock inputs */];
      const outputs = [/* mock outputs */];
      const flows = filter.calculateAssetFlows(inputs, outputs, 'addr1...');
      
      expect(flows).toHaveLength(3);
      expect(flows[0].netChange).toBe(1000000n);
    });
  });
});

// Example: TokenRegistryService.test.ts
describe('TokenRegistryService', () => {
  let service: TokenRegistryService;
  let mockRepo: jest.Mocked<ITokenRepository>;
  let mockCache: jest.Mocked<ITokenCache>;
  
  beforeEach(() => {
    mockRepo = createMockTokenRepository();
    mockCache = createMockTokenCache();
    service = new TokenRegistryService(mockRepo, mockCache);
  });
  
  describe('getTokenInfo', () => {
    it('should return cached token if available', async () => {
      const token = createMockToken();
      mockCache.get.mockReturnValue(token);
      
      const result = await service.getTokenInfo('unit123');
      
      expect(result).toEqual(token);
      expect(mockRepo.findByUnit).not.toHaveBeenCalled();
    });
    
    it('should fetch from API if not cached or in DB', async () => {
      mockCache.get.mockReturnValue(null);
      mockRepo.findByUnit.mockResolvedValue(null);
      
      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ /* token data */ })
      });
      
      const result = await service.getTokenInfo('unit123');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://tokens.cardano.org/metadata/unit123',
        expect.any(Object)
      );
    });
  });
});
```

### Integration Tests
```typescript
// Example: TransactionParsing.integration.test.ts
describe('Transaction Parsing Integration', () => {
  let parser: WalletTransactionParser;
  let supabase: SupabaseClient;
  
  beforeAll(async () => {
    // Set up test database
    supabase = createTestSupabaseClient();
    
    // Initialize services with real implementations
    const tokenRepo = new TokenRepository(supabase);
    const filter = new WalletTransactionFilter();
    const tokenRegistry = new TokenRegistryService(tokenRepo);
    const categorizer = new TransactionCategorizerService();
    
    parser = new WalletTransactionParser(
      filter,
      tokenRegistry,
      categorizer
    );
  });
  
  it('should parse Minswap swap transaction correctly', async () => {
    const rawTx = loadTestTransaction('minswap_swap.json');
    const walletAddress = 'addr1...';
    
    const result = await parser.parseTransaction(rawTx, walletAddress);
    
    expect(result).not.toBeNull();
    expect(result?.action).toBe(TransactionAction.SWAP);
    expect(result?.protocol).toBe(Protocol.MINSWAP);
    expect(result?.assetFlows).toHaveLength(2);
  });
  
  it('should parse Liqwid lending transaction correctly', async () => {
    const rawTx = loadTestTransaction('liqwid_lend.json');
    const walletAddress = 'addr1...';
    
    const result = await parser.parseTransaction(rawTx, walletAddress);
    
    expect(result).not.toBeNull();
    expect(result?.action).toBe(TransactionAction.LEND);
    expect(result?.protocol).toBe(Protocol.LIQWID);
    // Should have qToken inflow and base asset outflow
    const qToken = result?.assetFlows.find(f => f.token.ticker?.startsWith('q'));
    expect(qToken?.amountIn).toBeGreaterThan(0n);
  });
});
```

### E2E Tests
```typescript
// Example: TransactionFlow.e2e.test.ts
import { test, expect } from '@playwright/test';

test.describe('Transaction Flow', () => {
  test('should connect wallet, sync and display transactions', async ({ page }) => {
    // Navigate to app
    await page.goto('/');
    
    // Connect wallet
    await page.click('[data-testid="connect-wallet-btn"]');
    await page.click('[data-testid="wallet-nami"]');
    
    // Wait for authentication
    await expect(page.locator('[data-testid="wallet-address"]')).toBeVisible();
    
    // Navigate to transactions
    await page.click('[data-testid="nav-transactions"]');
    
    // Trigger sync
    await page.click('[data-testid="sync-transactions-btn"]');
    
    // Wait for transactions to load
    await expect(page.locator('[data-testid="transaction-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="transaction-item"]')).toHaveCount.greaterThan(0);
  });
  
  test('should filter transactions by action', async ({ page }) => {
    // Assume wallet is connected and transactions loaded
    await page.goto('/transactions');
    
    // Apply filter
    await page.selectOption('[data-testid="filter-action"]', TransactionAction.SWAP);
    
    // Verify filtered results
    const items = page.locator('[data-testid="transaction-item"]');
    const count = await items.count();
    
    for (let i = 0; i < count; i++) {
      const action = await items.nth(i).getAttribute('data-action');
      expect(action).toBe(TransactionAction.SWAP);
    }
  });
});
```

## UI Components

### TransactionList Component
**Location**: `src/components/transactions/TransactionList.tsx`

```typescript
import React from 'react';
import { useTransactions } from '@/context/TransactionProvider';
import { VirtualList } from '@/components/ui/VirtualList';
import { TransactionItem } from './TransactionItem';
import { TransactionFilters } from './TransactionFilters';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

export const TransactionList: React.FC = () => {
  const { transactions, isLoading, isSyncing, error, syncTransactions } = useTransactions();
  
  if (isLoading) {
    return <LoadingSpinner message="Loading transactions..." />;
  }
  
  if (error) {
    return <ErrorMessage message={error} />;
  }
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-semibold">Transaction History</h2>
        <button
          onClick={syncTransactions}
          disabled={isSyncing}
          className="btn btn-primary"
          data-testid="sync-transactions-btn"
        >
          {isSyncing ? 'Syncing...' : 'Sync'}
        </button>
      </div>
      
      <TransactionFilters />
      
      <div className="flex-1 overflow-hidden" data-testid="transaction-list">
        {transactions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            No transactions found
          </div>
        ) : (
          <VirtualList
            items={transactions}
            itemHeight={80}
            renderItem={(tx) => (
              <TransactionItem
                key={tx.id}
                transaction={tx}
                data-testid="transaction-item"
                data-action={tx.action}
              />
            )}
          />
        )}
      </div>
    </div>
  );
};
```

### TransactionItem Component
**Location**: `src/components/transactions/TransactionItem.tsx`

```typescript
import React from 'react';
import type { WalletTransaction } from '@/types/transaction';
import { ActionIcon } from './ActionIcon';
import { AssetFlowSummary } from './AssetFlowSummary';
import { TimeAgo } from '@/components/ui/TimeAgo';
import { formatTxHash } from '@/utils/format';

interface TransactionItemProps {
  transaction: WalletTransaction;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({ transaction }) => {
  const { action, description, timestamp, txHash, protocol, assetFlows } = transaction;
  
  return (
    <div className="flex items-center p-4 hover:bg-gray-50 border-b transition-colors">
      <ActionIcon action={action} className="mr-4" />
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{description}</span>
          {protocol && protocol !== 'unknown' && (
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
              {protocol}
            </span>
          )}
        </div>
        <div className="text-sm text-gray-500 mt-1">
          <a
            href={`https://cardanoscan.io/transaction/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {formatTxHash(txHash)}
          </a>
        </div>
      </div>
      
      <AssetFlowSummary flows={assetFlows} className="mr-4" />
      
      <TimeAgo timestamp={timestamp} className="text-sm text-gray-500" />
    </div>
  );
};
```

### AssetFlowSummary Component
**Location**: `src/components/transactions/AssetFlowSummary.tsx`

```typescript
import React from 'react';
import type { WalletAssetFlow } from '@/types/transaction';
import { formatAmount } from '@/utils/format';
import { cn } from '@/utils/cn';

interface AssetFlowSummaryProps {
  flows: readonly WalletAssetFlow[];
  className?: string;
}

export const AssetFlowSummary: React.FC<AssetFlowSummaryProps> = ({ flows, className }) => {
  // Group by positive/negative changes
  const inflows = flows.filter(f => f.netChange > 0n);
  const outflows = flows.filter(f => f.netChange < 0n);
  
  return (
    <div className={cn('flex flex-col items-end', className)}>
      {inflows.map(flow => (
        <div key={flow.token.unit} className="text-green-600 font-medium">
          +{formatAmount(flow.netChange, flow.token.decimals)} {flow.token.ticker}
        </div>
      ))}
      {outflows.map(flow => (
        <div key={flow.token.unit} className="text-red-600 font-medium">
          {formatAmount(flow.netChange, flow.token.decimals)} {flow.token.ticker}
        </div>
      ))}
    </div>
  );
};
```

## Performance Considerations

### Optimization Strategies

1. **Wallet-Centric Filtering**
   - Filter transactions at parse time
   - Only store wallet-relevant data
   - Reduces storage by 90%+

2. **Efficient Caching**
   - LRU cache for token metadata (1000 items)
   - Database caching for historical data
   - Memory cache for active session

3. **Batch Operations**
   - Batch token lookups
   - Batch database inserts
   - Batch API requests where possible

4. **Virtual Scrolling**
   - Render only visible transactions
   - Maintain scroll position
   - Smooth scrolling performance

5. **Database Indexing**
   ```sql
   -- Critical indices for performance
   CREATE INDEX idx_wallet_tx_user_timestamp 
     ON wallet_transactions(user_id, timestamp DESC);
   CREATE INDEX idx_wallet_tx_user_action 
     ON wallet_transactions(user_id, action);
   CREATE INDEX idx_tokens_unit_hash 
     ON tokens USING hash(unit);
   ```

6. **Pagination Strategy**
   - Load 100 transactions initially
   - Infinite scroll for more
   - Maintain filter state

7. **Lazy Loading**
   - Load transaction details on demand
   - Defer token metadata fetching
   - Progressive enhancement

### Performance Metrics
- Initial load: <500ms for 100 transactions
- Parse rate: 100+ transactions/second
- Token cache hit rate: >80%
- UI response time: <100ms for interactions

## Security Considerations

1. **Input Validation**: Validate all Blockfrost responses
2. **RLS Policies**: Ensure users can only see their own transactions
3. **Rate Limiting**: Implement rate limits for API calls
4. **Error Handling**: Never expose sensitive data in errors

## Future Enhancements

1. **Price Integration**: Add historical price data for USD values
2. **Advanced Analytics**: Transaction patterns, spending insights
3. **Export Features**: CSV/PDF export for tax reporting
4. **Protocol Decoders**: Deep integration with protocol datums
5. **Real-time Updates**: WebSocket for new transactions

## Success Metrics

1. **Accuracy**: >95% correct transaction categorization
2. **Performance**: <2s to load 1000 transactions
3. **Reliability**: <0.1% sync failure rate
4. **User Satisfaction**: Clear, understandable transaction history

## Dependencies

- Blockfrost API for transaction data
- Supabase for persistence
- Token registry for metadata
- Protocol registry for identification

## Next Steps

1. Begin with TokenRegistryService implementation
2. Set up protocol registry data structure
3. Create transaction types
4. Implement services in order of dependency