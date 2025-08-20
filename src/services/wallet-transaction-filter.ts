/**
 * WalletTransactionFilter Service
 * 
 * Purpose: Filter transaction data for wallet relevance and calculate asset flows
 * Implements: IWalletFilter, IAssetFlowCalculator
 * 
 * Core principle: Only process data that affects the connected wallet address
 */

import {
  type WalletFilterResult,
  type WalletAssetFlow,
  type TokenInfo,
  type AssetAggregator,
  type RawTransaction,
  type TxInput,
  type TxOutput,
  type AssetAmount,
  TokenCategory
} from '@/core/types/transaction';
import type { IWalletFilter } from './internal/filtering-interfaces';
import type { IAssetFlowCalculator } from './internal/calculation-interfaces';
import { isADA } from '@/core/types/blockchain';

export class WalletTransactionFilter implements IWalletFilter, IAssetFlowCalculator {
  /**
   * Type-safe asset aggregation function
   */
  private aggregateAssets: AssetAggregator = (assets) => {
    const aggregated = new Map<string, bigint>();
    for (const asset of assets) {
      const current = aggregated.get(asset.unit) || 0n;
      aggregated.set(asset.unit, current + BigInt(asset.quantity));
    }
    return aggregated;
  };

  /**
   * Check if a transaction input belongs to the wallet
   */
  public isWalletInput(input: TxInput, address: string): boolean {
    return input.address === address;
  }

  /**
   * Check if a transaction output belongs to the wallet
   */
  public isWalletOutput(output: TxOutput, address: string): boolean {
    return output.address === address;
  }

  /**
   * Filter a raw transaction for wallet-relevant data only
   * CRITICAL: This is where wallet-centric filtering happens
   */
  public filterForWallet(
    tx: RawTransaction,
    address: string
  ): WalletFilterResult {
    const inputs = tx.inputs.filter(i => this.isWalletInput(i, address));
    const outputs = tx.outputs.filter(o => this.isWalletOutput(o, address));
    
    // Check for staking withdrawals (rewards)
    // Note: Withdrawals use stake addresses, which we could derive from payment address
    // For now, we'll check if there are withdrawals and mark as relevant
    const hasWithdrawals = !!(tx.withdrawals && tx.withdrawals.length > 0);
    
    return {
      inputs,
      outputs,
      isRelevant: inputs.length > 0 || outputs.length > 0 || hasWithdrawals
    };
  }

  /**
   * Calculate asset flows for the wallet from transaction inputs/outputs
   * Returns only net changes affecting the wallet
   */
  public calculateAssetFlows(
    inputs: readonly TxInput[],
    outputs: readonly TxOutput[],
    walletAddress: string
  ): WalletAssetFlow[] {
    // Filter for wallet-specific inputs and outputs
    const walletInputs = inputs.filter(i => i.address === walletAddress);
    const walletOutputs = outputs.filter(o => o.address === walletAddress);
    
    // Aggregate assets going out of wallet (from inputs)
    const outflows = this.aggregateAssets(
      walletInputs.flatMap(i => i.amount)
    );
    
    // Aggregate assets coming into wallet (from outputs)
    const inflows = this.aggregateAssets(
      walletOutputs.flatMap(o => o.amount)
    );
    
    // Calculate net flows
    return this.computeNetFlows(inflows, outflows);
  }

  /**
   * Calculate net ADA change from asset flows
   */
  public calculateNetADAChange(flows: readonly WalletAssetFlow[]): bigint {
    const adaFlow = flows.find(f => isADA(f.token.unit));
    return adaFlow?.netChange || 0n;
  }

  /**
   * Compute net flows from inflow and outflow maps
   * Private helper method for calculating asset differences
   */
  private computeNetFlows(
    inflows: Map<string, bigint>,
    outflows: Map<string, bigint>
  ): WalletAssetFlow[] {
    // Get all unique asset units
    const allUnits = new Set([...inflows.keys(), ...outflows.keys()]);
    const flows: WalletAssetFlow[] = [];
    
    for (const unit of allUnits) {
      const inFlow = inflows.get(unit) || 0n;
      const outFlow = outflows.get(unit) || 0n;
      const netChange = inFlow - outFlow;
      
      // Only include flows with actual changes
      if (netChange !== 0n || inFlow > 0n || outFlow > 0n) {
        flows.push({
          token: this.createBasicTokenInfo(unit),
          inFlow,
          outFlow,
          netChange
        });
      }
    }
    
    return flows;
  }

  /**
   * Create basic token info (will be enriched later by TokenRegistry)
   */
  private createBasicTokenInfo(unit: string): TokenInfo {
    if (isADA(unit)) {
      return {
        unit,
        policyId: '',
        assetName: '',
        name: 'Cardano',
        ticker: 'ADA',
        decimals: 6,
        category: TokenCategory.NATIVE
      };
    }

    // Extract policy ID and asset name from unit
    const policyId = unit.slice(0, 56);
    const assetName = unit.slice(56);

    return {
      unit,
      policyId,
      assetName,
      name: `Token ${assetName || 'Unknown'}`,
      ticker: assetName ? assetName.slice(0, 8).toUpperCase() : 'TOKEN',
      decimals: 0, // Will be enriched by TokenRegistry
      category: TokenCategory.FUNGIBLE
    };
  }

  /**
   * Validate that asset flows are balanced and make sense
   * Useful for debugging and ensuring data integrity
   */
  public validateAssetFlows(flows: readonly WalletAssetFlow[]): boolean {
    for (const flow of flows) {
      // Net change should equal amountIn - amountOut
      if (flow.netChange !== flow.inFlow - flow.outFlow) {
        console.error(`Invalid asset flow for ${flow.token.unit}: netChange mismatch`);
        return false;
      }
      
      // Amounts should be non-negative
      if (flow.inFlow < 0n || flow.outFlow < 0n) {
        console.error(`Invalid asset flow for ${flow.token.unit}: negative amounts`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get summary statistics for asset flows
   * Useful for debugging and analysis
   */
  public getFlowSummary(flows: readonly WalletAssetFlow[]): {
    totalAssets: number;
    inflowAssets: number;
    outflowAssets: number;
    netPositiveAssets: number;
    netNegativeAssets: number;
  } {
    let inflowAssets = 0;
    let outflowAssets = 0;
    let netPositiveAssets = 0;
    let netNegativeAssets = 0;

    for (const flow of flows) {
      if (flow.inFlow > 0n) inflowAssets++;
      if (flow.outFlow > 0n) outflowAssets++;
      if (flow.netChange > 0n) netPositiveAssets++;
      if (flow.netChange < 0n) netNegativeAssets++;
    }

    return {
      totalAssets: flows.length,
      inflowAssets,
      outflowAssets,
      netPositiveAssets,
      netNegativeAssets
    };
  }
}