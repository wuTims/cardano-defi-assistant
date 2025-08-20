/**
 * Internal Calculation Interfaces
 * 
 * Application layer coordination interfaces for asset flow calculations.
 * These are internal implementation details, not domain contracts.
 */

import type { 
  WalletAssetFlow, 
  TxInput, 
  TxOutput 
} from '@/core/types/transaction';

/**
 * Asset Flow Calculator Interface
 * For calculating asset flows from transaction data
 * Internal application layer coordination
 */
export interface IAssetFlowCalculator {
  calculateAssetFlows(
    inputs: readonly TxInput[],
    outputs: readonly TxOutput[],
    walletAddress: string
  ): WalletAssetFlow[];
  
  calculateNetADAChange(flows: readonly WalletAssetFlow[]): bigint;
}