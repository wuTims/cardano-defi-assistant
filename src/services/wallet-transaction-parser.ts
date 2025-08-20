/**
 * WalletTransactionParser Implementation
 * 
 * Purpose: Parse raw transactions into wallet-centric format with token discovery
 * Implements: ITransactionParser
 * 
 * Following SOLID principles:
 * - Single Responsibility: Transaction parsing orchestration
 * - Dependency Injection: All dependencies injected via constructor
 * - Interface Segregation: Depends only on needed interfaces
 */

import type { 
  RawTransaction, 
  WalletTransaction, 
  WalletAssetFlow,
  TokenInfo 
} from '@/core/types/transaction';
import { TransactionAction, Protocol } from '@/core/types/transaction';
import type {
  ITransactionParser,
  ITransactionCategorizer,
  ITokenRegistry,
  ICacheService
} from '@/core/interfaces/services';
import type { IWalletFilter } from './internal/filtering-interfaces';
import type { IAssetFlowCalculator } from './internal/calculation-interfaces';
import { ProtocolTokenRegistry } from '@/config/protocol-tokens';

export class WalletTransactionParser implements ITransactionParser {
  private unknownTokens = new Set<string>();
  
  constructor(
    private walletFilter: IWalletFilter,
    private flowCalculator: IAssetFlowCalculator,
    private categorizer: ITransactionCategorizer,
    private tokenRegistry: ITokenRegistry,
    private tokenCache: ICacheService<TokenInfo>
  ) {}

  parseTransactions(raws: RawTransaction[], walletAddress: string): Promise<WalletTransaction[]> {
    throw new Error('Method not implemented.');
  }

  /**
   * Parse single transaction into wallet-centric format
   */
  public async parseTransaction(
    rawTx: RawTransaction,
    walletAddress: string
  ): Promise<WalletTransaction | null> {
    // Filter for wallet relevance
    const filtered = this.walletFilter.filterForWallet(rawTx, walletAddress);
    if (!filtered.isRelevant) {
      return null;
    }

    // Calculate asset flows
    const flows = this.flowCalculator.calculateAssetFlows(
      filtered.inputs,
      filtered.outputs,
      walletAddress
    );

    // Resolve token metadata for all flows
    const resolvedFlows = await this.resolveTokenMetadata(flows);

    // Categorize transaction
    const action = this.categorizer.categorize(rawTx, resolvedFlows);
    const protocol = this.categorizer.detectProtocol(rawTx, resolvedFlows);

    // Build wallet transaction (using last 6 chars of wallet address to save storage)
    const walletTx: WalletTransaction = {
      id: `${walletAddress.slice(-6)}_${rawTx.hash}`,
      walletAddress,
      txHash: rawTx.hash,
      blockHeight: rawTx.block_height,
      tx_timestamp: new Date(rawTx.block_time * 1000),
      tx_action: action,
      assetFlows: resolvedFlows,
      netADAChange: this.flowCalculator.calculateNetADAChange(resolvedFlows),
      fees: BigInt(rawTx.fees),
      tx_protocol: protocol || undefined,
      description: this.generateDescription(action, resolvedFlows, protocol)
    };

    return walletTx;
  }

  /**
   * Parse batch of transactions
   */
  public async parseTransactionBatch(
    rawTxs: readonly RawTransaction[],
    walletAddress: string
  ): Promise<WalletTransaction[]> {
    // First pass: collect all unique tokens for batch discovery
    await this.discoverTokensFromBatch(rawTxs);

    // Second pass: parse transactions with resolved tokens
    const walletTxs: WalletTransaction[] = [];
    
    for (const rawTx of rawTxs) {
      const parsed = await this.parseTransaction(rawTx, walletAddress);
      if (parsed) {
        walletTxs.push(parsed);
      }
    }

    // Log discovery stats
    if (this.unknownTokens.size > 0) {
      console.log(`[WalletTransactionParser] Discovered ${this.unknownTokens.size} new tokens during sync`);
      this.logUnknownTokens();
    }

    return walletTxs;
  }

  /**
   * Discover and cache tokens from a batch of transactions
   * This implements our simple token discovery approach
   */
  private async discoverTokensFromBatch(transactions: readonly RawTransaction[]): Promise<void> {
    const allUnits = new Set<string>();

    // Extract all unique token units
    for (const tx of transactions) {
      for (const input of tx.inputs) {
        for (const amount of input.amount) {
          allUnits.add(amount.unit);
        }
      }
      for (const output of tx.outputs) {
        for (const amount of output.amount) {
          allUnits.add(amount.unit);
        }
      }
    }

    // Filter to unknown tokens only
    const unknownUnits: string[] = [];
    for (const unit of allUnits) {
      if (unit === 'lovelace') continue;
      
      // Check cache first
      if (!(await this.tokenCache.has(unit))) {
        // Check protocol registry
        const protocolToken = ProtocolTokenRegistry.getInstance().getProtocolToken(unit);
        if (!protocolToken) {
          unknownUnits.push(unit);
        }
      }
    }

    if (unknownUnits.length === 0) return;

    console.log(`[WalletTransactionParser] Fetching metadata for ${unknownUnits.length} unknown tokens...`);

    // Batch fetch unknown tokens
    const tokenMap = await this.tokenRegistry.getTokensInfo(unknownUnits);
    
    // Check for potential qTokens (empty asset names)
    for (const [unit] of tokenMap) {
      const assetName = unit.slice(56);
      if (!assetName) {
        this.unknownTokens.add(unit);
        console.log(`[Potential qToken] ${unit.slice(0, 20)}... has empty asset name`);
      }
    }
  }

  /**
   * Resolve token metadata for asset flows
   */
  private async resolveTokenMetadata(
    flows: WalletAssetFlow[]
  ): Promise<WalletAssetFlow[]> {
    const resolvedFlows: WalletAssetFlow[] = [];

    for (const flow of flows) {
      // Get token info from cache or registry
      let tokenInfo = await this.tokenCache.get(flow.token.unit);
      
      if (!tokenInfo) {
        // Check protocol registry for known protocol tokens
        const protocolToken = ProtocolTokenRegistry.getInstance().getProtocolToken(flow.token.unit);
        if (protocolToken) {
          tokenInfo = {
            unit: flow.token.unit,
            policyId: protocolToken.policyId,
            assetName: '',
            name: protocolToken.name,
            ticker: protocolToken.name,
            decimals: 0,
            category: protocolToken.category
          };
          await this.tokenCache.set(flow.token.unit, tokenInfo);
        } else {
          // Fetch from registry API
          tokenInfo = await this.tokenRegistry.getTokenInfo(flow.token.unit);
        }
      }

      if (tokenInfo) {
        resolvedFlows.push({
          ...flow,
          token: tokenInfo
        });
      } else {
        // Use flow's basic token info as fallback
        resolvedFlows.push(flow);
      }
    }

    return resolvedFlows;
  }

  /**
   * Generate human-readable description
   */
  private generateDescription(
    action: TransactionAction,
    flows: readonly WalletAssetFlow[],
    protocol?: Protocol | null
  ): string {
    const protocolPrefix = protocol ? `[${protocol}] ` : '';
    
    // Get primary tokens involved
    const tokensIn = flows.filter(f => f.netChange > 0n);
    const tokensOut = flows.filter(f => f.netChange < 0n);

    switch (action) {
      case TransactionAction.SWAP:
        const swapFrom = tokensOut[0]?.token.ticker || 'Unknown';
        const swapTo = tokensIn[0]?.token.ticker || 'Unknown';
        return `${protocolPrefix}Swap ${swapFrom} → ${swapTo}`;
      
      case TransactionAction.SUPPLY:
        const supplied = tokensOut[0]?.token.ticker || 'Unknown';
        return `${protocolPrefix}Supply ${supplied}`;
      
      case TransactionAction.WITHDRAW:
        const withdrawn = tokensIn[0]?.token.ticker || 'Unknown';
        return `${protocolPrefix}Withdraw ${withdrawn}`;
      
      case TransactionAction.PROVIDE_LIQUIDITY:
        return `${protocolPrefix}Add Liquidity`;
      
      case TransactionAction.REMOVE_LIQUIDITY:
        return `${protocolPrefix}Remove Liquidity`;
      
      case TransactionAction.CLAIM_REWARDS:
        return 'Claim Staking Rewards';
      
      case TransactionAction.SEND:
        const sent = tokensOut[0]?.token.ticker || 'Unknown';
        return `Send ${sent}`;
      
      case TransactionAction.RECEIVE:
        const received = tokensIn[0]?.token.ticker || 'Unknown';
        return `Receive ${received}`;
      
      default:
        return 'Transaction';
    }
  }

  /**
   * Log unknown tokens for manual review
   */
  private logUnknownTokens(): void {
    if (this.unknownTokens.size === 0) return;

    console.log('\n🔍 TOKENS WITH EMPTY ASSET NAMES (Potential Protocol Tokens):');
    console.log('='.repeat(60));
    
    for (const unit of this.unknownTokens) {
      const policyId = unit.slice(0, 56);
      console.log(`Policy ID: ${policyId}`);
      console.log(`Full Unit: ${unit}`);
      console.log('Consider adding to protocol-tokens.ts if confirmed');
      console.log('-'.repeat(40));
    }
    
    console.log('='.repeat(60));
  }
}