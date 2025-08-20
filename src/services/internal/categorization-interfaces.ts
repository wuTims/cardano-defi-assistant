/**
 * Internal Categorization Interfaces
 * 
 * Application layer coordination interfaces for transaction categorization.
 * These are internal implementation details, not domain contracts.
 */

import type { 
  RawTransaction, 
  TransactionAction, 
  Protocol, 
  WalletAssetFlow 
} from '@/core/types/transaction';

/**
 * Categorization Rule Interface
 * For rule-based transaction categorization system
 * Internal application layer coordination
 */
export interface ICategorizationRule {
  readonly priority: number;
  matches(tx: RawTransaction, flows: readonly WalletAssetFlow[]): boolean;
  getAction(tx: RawTransaction, flows: readonly WalletAssetFlow[]): TransactionAction;
  getProtocol(): Protocol;
}