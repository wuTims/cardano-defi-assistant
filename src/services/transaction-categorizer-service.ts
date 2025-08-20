/**
 * TransactionCategorizerService Implementation
 * 
 * Purpose: Apply detection rules to categorize transactions
 * Implements: ITransactionCategorizer
 * 
 * Strategy:
 * - Rule-based categorization with priority ordering
 * - Comprehensive logging for debugging
 * - Protocol detection through metadata and asset patterns
 * - Extensible via dependency injection of rules
 */

import type { WalletAssetFlow, RawTransaction } from '@/core/types/transaction';
import { TransactionAction, Protocol, TokenCategory } from '@/core/types/transaction';
import type { ITransactionCategorizer } from '@/core/interfaces/services';
import { ProtocolTokenRegistry, detectPotentialQToken } from '@/config/protocol-tokens';
import { logger } from '@/lib/logger';
import { ICategorizationRule } from './internal/categorization-interfaces';

// Create child logger for transaction categorization with detailed debugging
const categorizationLogger = logger.child({ module: 'transaction-categorizer' });

// Default console logger (using built-in Console type)
class ConsoleLogger {
  debug(message: string, data?: any): void {
    console.log(`[DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
  info(message: string, data?: any): void {
    console.log(`[INFO] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
  warn(message: string, data?: any): void {
    console.warn(`[WARN] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
  error(message: string, data?: any): void {
    console.error(`[ERROR] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
}

/**
 * Abstract base class for categorization rules
 */
abstract class BaseCategorizationRule implements ICategorizationRule {
  protected logger: Console | ConsoleLogger;
  
  constructor(
    public readonly priority: number,
    logger?: Console | ConsoleLogger
  ) {
    this.logger = logger || new ConsoleLogger();
  }
  
  abstract matches(tx: RawTransaction, flows: readonly WalletAssetFlow[]): boolean;
  abstract getAction(tx: RawTransaction, flows: readonly WalletAssetFlow[]): TransactionAction;
  abstract getProtocol(): Protocol;
  
  /**
   * Helper to log rule evaluation
   */
  protected logEvaluation(ruleName: string, matched: boolean, details?: any): void {
    this.logger.debug(`Rule ${ruleName} evaluation`, {
      matched,
      priority: this.priority,
      ...details
    });
  }
}

/**
 * Liqwid Protocol Rule - CORRECTED LOGIC
 * 
 * qTokens are interest-bearing tokens representing supplied assets:
 * - Supply: Asset → qAsset (e.g., ADA → qADA)
 * - Withdraw: qAsset → Asset (e.g., qADA → ADA)
 * - Borrow: qAsset locked as collateral + receive borrowed asset
 * - Repay: Return borrowed asset + unlock collateral
 * 
 * IMPORTANT: qTokens have EMPTY asset names and must be identified by policy ID!
 */
class LiqwidLendingRule extends BaseCategorizationRule {
  private registry = ProtocolTokenRegistry.getInstance();
  
  constructor(logger?: Console | ConsoleLogger) {
    super(1, logger); // Highest priority
  }

  matches(tx: RawTransaction, flows: readonly WalletAssetFlow[]): boolean {
    // Check using the protocol token registry
    const hasLiqwidTokens = flows.some(f => 
      this.registry.isLiqwidToken(f.token.unit)
    );
    
    // Also check for potential undiscovered qTokens
    const potentialQTokens = flows.filter(f => {
      if (!this.registry.getProtocolToken(f.token.unit)) {
        return detectPotentialQToken(f.token.unit, {
          hasADAMovement: flows.some(flow => flow.token.unit === 'lovelace'),
          hasWithdrawals: !!(tx.withdrawals?.length),
          scriptAddresses: [
            ...new Set([
              ...tx.inputs.map(i => i.address),
              ...tx.outputs.map(o => o.address)
            ])
          ].filter(addr => addr.startsWith('addr1w') || addr.startsWith('addr1z'))
        });
      }
      return false;
    });
    
    if (potentialQTokens.length > 0) {
      this.logger.warn('Potential undiscovered qTokens detected', {
        tokens: potentialQTokens.map(f => f.token.unit.slice(0, 20) + '...'),
        txHash: tx.hash
      });
    }
    
    const matched = hasLiqwidTokens || potentialQTokens.length > 0;
    
    this.logEvaluation('LiqwidLendingRule', matched, {
      hasLiqwidTokens,
      potentialQTokens: potentialQTokens.length,
      knownTokens: flows.filter(f => this.registry.isLiqwidToken(f.token.unit))
        .map(f => this.registry.getProtocolToken(f.token.unit)?.name)
    });
    
    return matched;
  }

  getAction(tx: RawTransaction, flows: readonly WalletAssetFlow[]): TransactionAction {
    // Identify qToken flows using the registry
    const qTokenFlows = flows.filter(f => 
      this.registry.isQToken(f.token.unit)
    );
    
    // Identify underlying asset flows (non-Liqwid tokens)
    // For simplicity, just exclude qTokens since those are definitive
    const assetFlows = flows.filter(f => 
      !this.registry.isQToken(f.token.unit)
    );
    
    // Analyze qToken movements - these are definitive for Liqwid actions
    const hasQTokenIn = qTokenFlows.some(f => f.netChange > 0n);
    const hasQTokenOut = qTokenFlows.some(f => f.netChange < 0n);
    const hasAssetIn = assetFlows.some(f => f.netChange > 0n);
    const hasAssetOut = assetFlows.some(f => f.netChange < 0n);
    
    // Get qToken names for logging
    const qTokenNames = qTokenFlows.map(f => {
      const token = this.registry.getProtocolToken(f.token.unit);
      return token?.name || 'Unknown qToken';
    });
    
    this.logger.debug('Liqwid action analysis', {
      qTokenIn: hasQTokenIn,
      qTokenOut: hasQTokenOut,
      qTokens: qTokenFlows.map(f => ({ 
        name: this.registry.getProtocolToken(f.token.unit)?.name || 'Unknown',
        net: f.netChange.toString() 
      }))
    });
    
    // Simple categorization based on qToken flows
    // Supply: Receive qToken (e.g., +qADA means you supplied ADA)
    if (hasQTokenIn && !hasQTokenOut) {
      this.logger.info('Categorized as SUPPLY', { 
        receivedQTokens: qTokenNames,
        explanation: 'User supplied assets and received qTokens as receipt'
      });
      return TransactionAction.SUPPLY;
    }
    
    // Withdraw: Send qToken (e.g., -qADA means you withdrew ADA)
    if (hasQTokenOut && !hasQTokenIn) {
      this.logger.info('Categorized as WITHDRAW', {
        sentQTokens: qTokenNames,
        explanation: 'User burned qTokens to withdraw supplied assets'
      });
      return TransactionAction.WITHDRAW; 
    }
    
    // Mixed qToken movements might indicate complex actions
    if (hasQTokenIn && hasQTokenOut) {
      this.logger.info('Categorized as complex Liqwid action', {
        qTokenMovements: qTokenFlows.map(f => ({
          name: this.registry.getProtocolToken(f.token.unit)?.name,
          direction: f.netChange > 0n ? 'IN' : 'OUT'
        }))
      });
      // Could be rebalancing, collateral adjustment, etc.
      return TransactionAction.COLLATERALIZE;
    }
    
    this.logger.warn('Liqwid transaction pattern not recognized', {
      flowCount: flows.length,
      tokens: flows.map(f => f.token.ticker)
    });
    
    return TransactionAction.UNKNOWN;
  }

  getProtocol(): Protocol {
    return Protocol.LIQWID;
  }
}

/**
 * DEX Base Rule - Common DEX patterns
 */
abstract class BaseDEXRule extends BaseCategorizationRule {
  protected categorizeGenericDEXAction(flows: readonly WalletAssetFlow[]): TransactionAction {
    const lpTokenFlows = flows.filter(f => 
      f.token.category === TokenCategory.LP_TOKEN ||
      f.token.ticker?.includes('LP') ||
      f.token.ticker?.includes('LPT')
    );
    
    // Liquidity provision: User provides assets, receives LP tokens
    if (lpTokenFlows.some(f => f.netChange > 0n)) {
      this.logger.info('DEX action: PROVIDE_LIQUIDITY', {
        lpTokensReceived: lpTokenFlows.filter(f => f.netChange > 0n).map(f => f.token.ticker)
      });
      return TransactionAction.PROVIDE_LIQUIDITY;
    }
    
    // Liquidity removal: User burns LP tokens, receives underlying assets
    if (lpTokenFlows.some(f => f.netChange < 0n)) {
      this.logger.info('DEX action: REMOVE_LIQUIDITY', {
        lpTokensBurned: lpTokenFlows.filter(f => f.netChange < 0n).map(f => f.token.ticker)
      });
      return TransactionAction.REMOVE_LIQUIDITY;
    }
    
    // Swap detection: Multiple different tokens with opposite flows
    const nonADAFlows = flows.filter(f => f.token.unit !== 'lovelace');
    const tokensIn = nonADAFlows.filter(f => f.netChange > 0n);
    const tokensOut = nonADAFlows.filter(f => f.netChange < 0n);
    
    if (tokensIn.length >= 1 || tokensOut.length >= 1) {
      this.logger.info('DEX action: SWAP', {
        received: tokensIn.map(f => f.token.ticker),
        sent: tokensOut.map(f => f.token.ticker)
      });
      return TransactionAction.SWAP;
    }
    
    return TransactionAction.UNKNOWN;
  }
}

/**
 * Minswap DEX Rule
 */
class MinswapDEXRule extends BaseDEXRule {
  constructor(logger?: Console | ConsoleLogger) {
    super(2, logger);
  }

  matches(tx: RawTransaction, flows: readonly WalletAssetFlow[]): boolean {
    // Check metadata for Minswap indicators
    const metadataStr = JSON.stringify(tx.metadata || {}).toLowerCase();
    const hasMinswapMetadata = metadataStr.includes('minswap');
    
    // Check for Minswap LP tokens
    const hasMinswapLP = flows.some(f => 
      (f.token.ticker?.includes('MIN') || f.token.ticker?.includes('LP')) && 
      f.token.category === TokenCategory.LP_TOKEN
    );
    
    const matched = hasMinswapMetadata || hasMinswapLP;
    
    this.logEvaluation('MinswapDEXRule', matched, {
      hasMinswapMetadata,
      hasMinswapLP,
      metadataKeys: tx.metadata ? Object.keys(tx.metadata) : []
    });
    
    return matched;
  }

  getAction(tx: RawTransaction, flows: readonly WalletAssetFlow[]): TransactionAction {
    return this.categorizeGenericDEXAction(flows);
  }

  getProtocol(): Protocol {
    return Protocol.MINSWAP;
  }
}

/**
 * Stake Rewards Rule
 * Detects stake reward withdrawals and delegation changes
 */
class StakeRewardsRule extends BaseCategorizationRule {
  constructor(logger?: Console | ConsoleLogger) {
    super(10, logger);
  }

  matches(tx: RawTransaction, flows: readonly WalletAssetFlow[]): boolean {
    const hasWithdrawals = !!(tx.withdrawals && tx.withdrawals.length > 0);
    const hasCertificates = !!(tx.certificates && tx.certificates.length > 0);
    
    // Pure ADA inflow could be rewards
    const isADAOnly = flows.length === 1 && flows[0].token.unit === 'lovelace';
    const isPureInflow = flows.every(f => f.netChange > 0n);
    
    const matched = hasWithdrawals || hasCertificates || (isADAOnly && isPureInflow);
    
    this.logEvaluation('StakeRewardsRule', matched, {
      hasWithdrawals,
      hasCertificates,
      isADAOnly,
      isPureInflow,
      withdrawalCount: tx.withdrawals?.length || 0,
      certificateTypes: tx.certificates?.map(c => c.type) || []
    });
    
    return matched;
  }

  getAction(tx: RawTransaction, flows: readonly WalletAssetFlow[]): TransactionAction {
    // Withdrawal transactions are definitively stake rewards
    if (tx.withdrawals && tx.withdrawals.length > 0) {
      this.logger.info('Categorized as CLAIM_REWARDS (withdrawals present)', {
        withdrawalCount: tx.withdrawals.length,
        amounts: tx.withdrawals.map(w => w.amount)
      });
      return TransactionAction.CLAIM_REWARDS;
    }
    
    // Certificate transactions
    if (tx.certificates && tx.certificates.length > 0) {
      const certTypes = tx.certificates.map(cert => cert.type);
      
      if (certTypes.includes('stake_delegation')) {
        this.logger.info('Categorized as STAKE (delegation certificate)', {
          poolId: tx.certificates.find(c => c.type === 'stake_delegation')?.pool_id
        });
        return TransactionAction.STAKE;
      }
      
      if (certTypes.includes('stake_deregistration')) {
        this.logger.info('Categorized as UNSTAKE (deregistration certificate)');
        return TransactionAction.UNSTAKE;
      }
    }
    
    return TransactionAction.UNKNOWN;
  }

  getProtocol(): Protocol {
    return Protocol.UNKNOWN;
  }
}

/**
 * Simple Transfer Rule (Catch-all)
 */
class SimpleTransferRule extends BaseCategorizationRule {
  constructor(logger?: Console | ConsoleLogger) {
    super(100, logger); // Lowest priority
  }

  matches(tx: RawTransaction, flows: readonly WalletAssetFlow[]): boolean {
    return true; // Always matches as fallback
  }

  getAction(tx: RawTransaction, flows: readonly WalletAssetFlow[]): TransactionAction {
    const hasInflow = flows.some(f => f.netChange > 0n);
    const hasOutflow = flows.some(f => f.netChange < 0n);
    
    this.logEvaluation('SimpleTransferRule', true, {
      hasInflow,
      hasOutflow,
      flowCount: flows.length
    });
    
    if (hasInflow && !hasOutflow) {
      this.logger.info('Categorized as RECEIVE', {
        receivedTokens: flows.filter(f => f.netChange > 0n).map(f => f.token.ticker)
      });
      return TransactionAction.RECEIVE;
    }
    
    if (!hasInflow && hasOutflow) {
      this.logger.info('Categorized as SEND', {
        sentTokens: flows.filter(f => f.netChange < 0n).map(f => f.token.ticker)
      });
      return TransactionAction.SEND;
    }
    
    // Complex flow pattern - likely a swap
    if (hasInflow && hasOutflow && flows.length >= 2) {
      const inflowTokens = flows.filter(f => f.netChange > 0n);
      const outflowTokens = flows.filter(f => f.netChange < 0n);
      
      // If we have meaningful inflows and outflows, it's likely a swap
      // Ignore tiny fees (< 10 ADA)
      const meaningfulInflow = inflowTokens.some(f => 
        f.token.unit !== 'lovelace' || f.netChange > 10000000n
      );
      const meaningfulOutflow = outflowTokens.some(f => 
        f.token.unit !== 'lovelace' || Math.abs(Number(f.netChange)) > 10000000
      );
      
      if (meaningfulInflow || meaningfulOutflow) {
        this.logger.info('Categorized as SWAP (mixed flows)', {
          receivedTokens: inflowTokens.map(f => f.token.ticker),
          sentTokens: outflowTokens.map(f => f.token.ticker)
        });
        return TransactionAction.SWAP;
      }
    }
    
    this.logger.warn('Transaction pattern not recognized, marking as UNKNOWN', {
      flowCount: flows.length,
      tokens: flows.map(f => ({ ticker: f.token.ticker, net: f.netChange.toString() }))
    });
    
    return TransactionAction.UNKNOWN;
  }

  getProtocol(): Protocol {
    return Protocol.UNKNOWN;
  }
}

/**
 * Main TransactionCategorizerService
 */
export class TransactionCategorizerService implements ITransactionCategorizer {
  private rules: ICategorizationRule[];
  private logger: Console | ConsoleLogger;

  constructor(
    rules?: ICategorizationRule[],
    logger?: Console | ConsoleLogger
  ) {
    this.logger = logger || new ConsoleLogger();
    
    // Dependency injection with default rules
    this.rules = rules || [
      new LiqwidLendingRule(this.logger),
      new MinswapDEXRule(this.logger),
      new StakeRewardsRule(this.logger),
      new SimpleTransferRule(this.logger)
    ];
    
    // Sort by priority (lower number = higher priority)
    this.rules.sort((a, b) => a.priority - b.priority);
    
    this.logger.info('TransactionCategorizerService initialized', {
      ruleCount: this.rules.length,
      rules: this.rules.map(r => ({ 
        name: r.constructor.name, 
        priority: r.priority 
      }))
    });
  }

  /**
   * Categorize transaction based on rule matching
   */
  public categorize(
    tx: RawTransaction,
    flows: readonly WalletAssetFlow[]
  ): TransactionAction {
    // Create transaction-specific logger with full context
    const txLogger = categorizationLogger.child({
      txHash: tx.hash,
      blockHeight: tx.block_height,
      blockTime: tx.block_time
    });

    // Enhanced categorization debugging split into multiple calls
    
    // Log transaction characteristics
    txLogger.debug({
      blockHeight: tx.block_height,
      blockTime: tx.block_time,
      fees: tx.fees,
      slot: tx.slot
    }, 'Transaction characteristics');
    
    // Log asset flow summary (avoid large arrays)
    txLogger.debug({
      totalFlows: flows.length,
      incomingFlows: flows.filter(f => f.netChange > 0).length,
      outgoingFlows: flows.filter(f => f.netChange < 0).length,
      uniqueAssets: new Set(flows.map(f => f.token.unit)).size,
      netADAFlow: flows.find(f => f.token.unit === 'lovelace')?.netChange.toString() || '0'
    }, 'Asset flow summary');
    
    // Log first few asset flows for analysis
    if (flows.length > 0) {
      txLogger.debug({
        sampleFlows: flows.slice(0, 3).map(f => ({
          unit: f.token.unit.slice(0, 20) + (f.token.unit.length > 20 ? '...' : ''),
          ticker: f.token.ticker,
          netChange: f.netChange.toString(),
          isNative: f.token.unit !== 'lovelace'
        }))
      }, 'Sample asset flows');
    }
    
    // Log transaction features
    txLogger.debug({
      hasMetadata: !!tx.metadata,
      metadataKeyCount: tx.metadata ? Object.keys(tx.metadata).length : 0,
      hasWithdrawals: !!(tx.withdrawals?.length),
      withdrawalCount: tx.withdrawals?.length || 0,
      hasCertificates: !!(tx.certificates?.length),
      certificateCount: tx.certificates?.length || 0
    }, 'Transaction features for categorization');

    // Apply rules in priority order - first match wins
    for (const rule of this.rules) {
      const ruleLogger = txLogger.child({ 
        rule: rule.constructor.name, 
        priority: rule.priority 
      });
      
      ruleLogger.trace('Testing rule against transaction');
      
      const matched = rule.matches(tx, flows);
      
      if (matched) {
        const action = rule.getAction(tx, flows);
        const protocol = rule.getProtocol();
        
        // Comprehensive logging when rule matches
        ruleLogger.info({
          matchResult: {
            matched: true,
            action,
            protocol,
            rule: rule.constructor.name,
            priority: rule.priority
          },
          // Log why this rule matched (for debugging)
          matchReason: {
            ruleType: rule.constructor.name,
            actionDetermined: action,
            protocolDetected: protocol
          }
        }, 'Rule matched - transaction categorized');
        
        if (action !== TransactionAction.UNKNOWN) {
          return action;
        } else {
          ruleLogger.warn({
            issue: 'RULE_MATCHED_BUT_UNKNOWN_ACTION',
            rule: rule.constructor.name
          }, 'Rule matched but returned UNKNOWN action');
        }
      } else {
        ruleLogger.trace({
          matchResult: {
            matched: false,
            rule: rule.constructor.name,
            priority: rule.priority
          }
        }, 'Rule did not match transaction');
      }
    }
    
    // No rules matched - this is a categorization gap
    txLogger.warn({
      categorizationGap: {
        issue: 'NO_RULES_MATCHED',
        txHash: tx.hash,
        assetFlowSummary: {
          flowCount: flows.length,
          hasADA: flows.some(f => f.token.unit === 'lovelace'),
          hasNativeAssets: flows.some(f => f.token.unit !== 'lovelace'),
          uniqueAssets: new Set(flows.map(f => f.token.unit)).size
        },
        transactionFeatures: {
          hasMetadata: !!tx.metadata,
          hasWithdrawals: !!(tx.withdrawals?.length),
          hasCertificates: !!(tx.certificates?.length)
        },
        allRulesTested: this.rules.map(r => r.constructor.name)
      }
    }, 'CATEGORIZATION GAP: No rules matched transaction');
    
    return TransactionAction.UNKNOWN;
  }

  /**
   * Detect protocol from transaction data
   */
  public detectProtocol(tx: RawTransaction, flows: readonly WalletAssetFlow[] = []): Protocol | null {
    this.logger.debug('Detecting protocol for transaction', {
      txHash: tx.hash,
      flowCount: flows.length,
      metadata: tx.metadata ? Object.keys(tx.metadata) : []
    });
    
    for (const rule of this.rules) {
      if (rule.matches(tx, flows)) {
        const protocol = rule.getProtocol();
        if (protocol !== Protocol.UNKNOWN) {
          this.logger.info('Protocol detected', {
            txHash: tx.hash,
            protocol,
            detectedBy: rule.constructor.name
          });
          return protocol;
        }
      }
    }
    
    this.logger.debug('No protocol detected', { txHash: tx.hash });
    return null;
  }
}