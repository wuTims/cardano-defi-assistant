/**
 * Internal Filtering Interfaces
 * 
 * Application layer coordination interfaces for transaction filtering.
 * These are internal implementation details, not domain contracts.
 */

import type { 
  RawTransaction, 
  WalletFilterResult, 
  TxInput, 
  TxOutput 
} from '@/core/types/transaction';

/**
 * Wallet Filter Interface
 * For filtering transaction inputs/outputs by wallet address
 * Internal application layer coordination
 */
export interface IWalletFilter {
  isWalletInput(input: TxInput, address: string): boolean;
  isWalletOutput(output: TxOutput, address: string): boolean;
  filterForWallet(tx: RawTransaction, address: string): WalletFilterResult;
}