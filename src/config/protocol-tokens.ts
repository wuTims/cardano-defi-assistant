/**
 * Protocol Token Registry
 * 
 * Centralized configuration for protocol-specific tokens.
 * This file serves as the source of truth for identifying tokens
 * that belong to specific DeFi protocols on Cardano.
 * 
 * IMPORTANT: Many protocol tokens have EMPTY asset names and must
 * be identified by their policy IDs alone.
 */

import { TokenCategory } from '@/core/types/transaction';

/**
 * Token identification entry
 */
export interface ProtocolToken {
  policyId: string;
  name: string;
  protocol: string;
  category: TokenCategory;
  description?: string;
  discoveredDate?: string;
  discoveredFrom?: string; // Transaction hash or source
}

/**
 * Liqwid Protocol qTokens
 * These are interest-bearing receipt tokens with EMPTY asset names.
 * They represent supplied collateral in Liqwid markets.
 */
export const LIQWID_QTOKENS: Record<string, ProtocolToken> = {
  'a04ce7a52545e5e33c2867e148898d9e667a69602285f6a1298f9d68': {
    policyId: 'a04ce7a52545e5e33c2867e148898d9e667a69602285f6a1298f9d68',
    name: 'qADA',
    protocol: 'Liqwid',
    category: TokenCategory.Q_TOKEN,
    description: 'Interest-bearing ADA supplied to Liqwid',
    discoveredDate: '2024-08-11',
    discoveredFrom: '0ded8ac279d9bf95c65d9b099adbc07ab076e3050c2a1c2a810197c7a968be34'
  },
  // Add more qTokens as discovered:
  // 'policyId': { ... }
};

/**
 * Liqwid Protocol auxiliary tokens
 * 
 * These are secondary indicators that suggest Liqwid interaction
 * but need additional context (qToken presence, script addresses).
 */
export const LIQWID_AUX_TOKENS: Record<string, ProtocolToken> = {
  'da8c30857834c6ae7203935b89278c532b3995245295456f993e1d24': {
    policyId: 'da8c30857834c6ae7203935b89278c532b3995245295456f993e1d24',
    name: 'LQ',
    protocol: 'Liqwid',
    category: TokenCategory.GOVERNANCE,
    description: 'Liqwid governance token'
  },
  // NOTE: AXN, BOR, ST tokens would go here once we discover their policy IDs
  // These tokens MAY have ASCII names unlike qTokens
};

/**
 * Minswap DEX tokens
 */
export const MINSWAP_TOKENS: Record<string, ProtocolToken> = {
  '29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c6': {
    policyId: '29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c6',
    name: 'MIN',
    protocol: 'Minswap',
    category: TokenCategory.GOVERNANCE,
    description: 'Minswap governance token'
  },
  // LP tokens would go here
};

/**
 * Registry of all known protocol tokens by policy ID
 */
export class ProtocolTokenRegistry {
  private static instance: ProtocolTokenRegistry;
  private tokens: Map<string, ProtocolToken> = new Map();
  
  private constructor() {
    this.initialize();
  }
  
  public static getInstance(): ProtocolTokenRegistry {
    if (!ProtocolTokenRegistry.instance) {
      ProtocolTokenRegistry.instance = new ProtocolTokenRegistry();
    }
    return ProtocolTokenRegistry.instance;
  }
  
  private initialize(): void {
    // Load all known tokens
    this.addTokens(Object.values(LIQWID_QTOKENS));
    this.addTokens(Object.values(LIQWID_AUX_TOKENS));
    this.addTokens(Object.values(MINSWAP_TOKENS));
  }
  
  private addTokens(tokens: ProtocolToken[]): void {
    for (const token of tokens) {
      this.tokens.set(token.policyId, token);
    }
  }
  
  /**
   * Check if a token unit belongs to a protocol
   */
  public getProtocolToken(unit: string): ProtocolToken | null {
    const policyId = unit.slice(0, 56);
    return this.tokens.get(policyId) || null;
  }
  
  /**
   * Check if token belongs to Liqwid
   */
  public isLiqwidToken(unit: string): boolean {
    const token = this.getProtocolToken(unit);
    return token?.protocol === 'Liqwid';
  }
  
  /**
   * Check if token is a qToken
   */
  public isQToken(unit: string): boolean {
    const token = this.getProtocolToken(unit);
    return token?.category === TokenCategory.Q_TOKEN;
  }
  
  /**
   * Add newly discovered token
   * This could be called when we encounter unknown tokens in Liqwid transactions
   */
  public registerToken(token: ProtocolToken): void {
    this.tokens.set(token.policyId, token);
    
    // Log discovery for tracking
    console.log(`[ProtocolTokenRegistry] New token registered:`, {
      name: token.name,
      protocol: token.protocol,
      policyId: token.policyId.slice(0, 20) + '...',
      source: token.discoveredFrom
    });
  }
  
  /**
   * Get all tokens for a specific protocol
   */
  public getProtocolTokens(protocol: string): ProtocolToken[] {
    return Array.from(this.tokens.values())
      .filter(t => t.protocol === protocol);
  }
  
  /**
   * Export current registry for persistence
   */
  public export(): Record<string, ProtocolToken> {
    const result: Record<string, ProtocolToken> = {};
    for (const [key, value] of this.tokens) {
      result[key] = value;
    }
    return result;
  }
}

/**
 * Helper function for dynamic discovery
 * 
 * When we encounter an unknown token in a confirmed Liqwid transaction,
 * we can use this to add it to our registry.
 * 
 * @example
 * // In transaction processing:
 * if (isConfirmedLiqwidTx && !registry.getProtocolToken(unit)) {
 *   discoverProtocolToken(unit, 'qIUSD', 'Liqwid', tx.hash);
 * }
 */
export function discoverProtocolToken(
  unit: string,
  name: string,
  protocol: string,
  txHash?: string,
  category: TokenCategory = TokenCategory.FUNGIBLE
): void {
  const registry = ProtocolTokenRegistry.getInstance();
  const policyId = unit.slice(0, 56);
  
  const token: ProtocolToken = {
    policyId,
    name,
    protocol,
    category,
    discoveredDate: new Date().toISOString(),
    discoveredFrom: txHash
  };
  
  registry.registerToken(token);
  
  // TODO: Could persist to database or file for permanent storage
  // await saveDiscoveredToken(token);
}

/**
 * Heuristic detection for potential qTokens
 * 
 * If we see tokens with empty names moving alongside ADA in patterns
 * that suggest lending/borrowing, we can flag them for investigation.
 */
export function detectPotentialQToken(
  unit: string,
  transactionContext: {
    hasADAMovement: boolean;
    hasWithdrawals: boolean;
    scriptAddresses: string[];
  }
): boolean {
  const policyId = unit.slice(0, 56);
  const assetName = unit.slice(56);
  
  // Empty asset name is a strong indicator
  if (!assetName || assetName === '') {
    // Check if transaction has Liqwid-like patterns
    if (transactionContext.hasADAMovement && 
        transactionContext.scriptAddresses.length > 2) {
      
      console.log(`[Potential qToken Detected]`, {
        policyId: policyId.slice(0, 20) + '...',
        context: transactionContext
      });
      
      return true;
    }
  }
  
  return false;
}