/**
 * Blockfrost Service Implementation
 * 
 * Simple wrapper around Blockfrost SDK for fetching blockchain data
 * Focused on essential data only - no unnecessary complexity
 */

import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
import { logger } from '@/lib/logger';
import type { 
  RawTransaction, 
  TxInput, 
  TxOutput,
  AssetAmount
} from '@/types/transaction';
import type {
  IBlockchainDataFetcher,
  TokenMetadata,
  UTXO
} from '@/services/interfaces/blockchain-fetcher';

/**
 * Type-safe wrapper for Blockfrost API responses
 */
type BlockfrostTransaction = {
  tx_hash: string;
  block_height: number;
  block_time: number;
};

type BlockfrostInput = {
  address: string;
  amount: AssetAmount[];
  tx_hash: string;
  output_index: number;
  collateral: boolean;
  data_hash?: string;
  inline_datum?: string;
  reference_script_hash?: string;
};

type BlockfrostOutput = {
  address: string;
  amount: AssetAmount[];
  output_index: number;
  collateral: boolean;
  data_hash?: string;
  inline_datum?: string;
  reference_script_hash?: string;
};

export class BlockfrostService implements IBlockchainDataFetcher {
  private readonly api: BlockFrostAPI;
  private readonly pageSize = 100; // Blockfrost max

  constructor(apiKey: string) {
    this.api = new BlockFrostAPI({
      projectId: apiKey,
      network: 'mainnet'
    });
  }

  /**
   * Fetch transaction hashes for an address with pagination
   * 
   * For incremental sync (fromBlock provided):
   * - Fetches newest transactions first (desc order)
   * - Stops when reaching already-synced transactions
   * 
   * For full sync (no fromBlock):
   * - Fetches oldest transactions first (asc order)
   * - Processes entire history
   */
  async *fetchAddressTransactions(
    address: string,
    fromBlock?: number
  ): AsyncIterableIterator<string[]> {
    try {
      let page = 1;
      let hasMorePages = true;
      const isIncrementalSync = fromBlock !== undefined && fromBlock > 0;
      
      // Use descending order for incremental sync to get newest first
      const order = isIncrementalSync ? 'desc' : 'asc';
      
      logger.info(`Starting ${isIncrementalSync ? 'incremental' : 'full'} sync for ${address} from block ${fromBlock || 0} (order: ${order})`);
      
      while (hasMorePages) {
        // Fetch page of transactions
        const transactions = await this.api.addressesTransactions(
          address,
          { 
            page, 
            count: this.pageSize, 
            order 
          }
        ) as BlockfrostTransaction[];
        
        // Check if we got any results
        if (!transactions || transactions.length === 0) {
          hasMorePages = false;
          break;
        }
        
        if (isIncrementalSync) {
          // For incremental sync: only get transactions newer than fromBlock
          const newTransactions = transactions.filter(tx => tx.block_height > fromBlock);
          
          // If we found any transactions at or before fromBlock, we've caught up
          if (transactions.some(tx => tx.block_height <= fromBlock)) {
            if (newTransactions.length > 0) {
              yield newTransactions.map(tx => tx.tx_hash);
            }
            logger.info(`Incremental sync complete, found ${newTransactions.length} new transactions`);
            break; // Stop - we've reached already-synced transactions
          }
          
          // All transactions in this page are new
          if (newTransactions.length > 0) {
            yield newTransactions.map(tx => tx.tx_hash);
          }
        } else {
          // For full sync: get all transactions
          yield transactions.map(tx => tx.tx_hash);
        }
        
        // Check if this was the last page
        if (transactions.length < this.pageSize) {
          hasMorePages = false;
        } else {
          page++;
        }
      }
    } catch (error) {
      logger.error(`Error fetching address transactions for ${address}: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to fetch transactions for ${address}: ${error}`);
    }
  }

  /**
   * Fetch full transaction details
   */
  async fetchTransactionDetails(hash: string): Promise<RawTransaction> {
    try {
      // Fetch transaction info and UTXOs in parallel
      const [txInfo, txUtxos] = await Promise.all([
        this.api.txs(hash),
        this.api.txsUtxos(hash)
      ]);

      // Type assertion for UTXO structure
      const utxoData = txUtxos as {
        inputs: BlockfrostInput[];
        outputs: BlockfrostOutput[];
      };

      // Transform inputs (exclude collateral inputs)
      const inputs: TxInput[] = utxoData.inputs
        .filter(input => !input.collateral)
        .map(input => ({
          address: input.address,
          amount: input.amount,
          tx_hash: input.tx_hash,
          output_index: input.output_index,
          data_hash: input.data_hash,
          inline_datum: input.inline_datum,
          reference_script_hash: input.reference_script_hash
        }));

      // Transform outputs (exclude collateral outputs)
      const outputs: TxOutput[] = utxoData.outputs
        .filter(output => !output.collateral)
        .map(output => ({
          address: output.address,
          amount: output.amount,
          output_index: output.output_index,
          data_hash: output.data_hash,
          inline_datum: output.inline_datum,
          reference_script_hash: output.reference_script_hash
        }));

      // Fetch withdrawals if any
      const withdrawals = txInfo.withdrawal_count > 0 
        ? await this.api.txsWithdrawals(hash)
        : [];

      return {
        hash: txInfo.hash,
        block: txInfo.block,
        block_height: txInfo.block_height,
        block_time: txInfo.block_time,
        slot: txInfo.slot,
        index: txInfo.index,
        inputs,
        outputs,
        fees: txInfo.fees,
        withdrawals: withdrawals.map(w => ({
          address: w.address,
          amount: w.amount
        }))
      };
    } catch (error) {
      logger.error(`Error fetching transaction details for ${hash}: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to fetch transaction ${hash}: ${error}`);
    }
  }

  /**
   * Fetch current UTXOs for an address
   */
  async fetchAddressUTXOs(address: string): Promise<UTXO[]> {
    try {
      const utxos = await this.api.addressesUtxos(address);
      
      // Transform to our UTXO type
      return utxos.map((utxo: any) => ({
        tx_hash: utxo.tx_hash,
        output_index: utxo.output_index,
        address: utxo.address,
        amount: utxo.amount,
        block: utxo.block,
        data_hash: utxo.data_hash,
        inline_datum: utxo.inline_datum,
        reference_script_hash: utxo.reference_script_hash
      }));
    } catch (error) {
      logger.error(`Error fetching UTXOs for ${address}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Get current blockchain height
   */
  async getCurrentBlockHeight(): Promise<number> {
    try {
      const block = await this.api.blocksLatest();
      return block.height || 0;
    } catch (error) {
      logger.error(`Error fetching block height: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }

  /**
   * Fetch token metadata
   */
  async fetchTokenMetadata(unit: string): Promise<TokenMetadata | null> {
    // ADA has no metadata
    if (unit === 'lovelace') {
      return null;
    }
    
    try {
      const asset = await this.api.assetsById(unit);
      
      return {
        asset: asset.asset,
        policy_id: asset.policy_id,
        asset_name: asset.asset_name || '',
        fingerprint: asset.fingerprint,
        quantity: asset.quantity,
        initial_mint_tx_hash: asset.initial_mint_tx_hash,
        mint_or_burn_count: asset.mint_or_burn_count,
        metadata: {
          name: asset.metadata?.name ?? undefined,
          ticker: asset.metadata?.ticker ?? undefined,
          decimals: (asset.onchain_metadata as any)?.decimals ?? 0,
          description: asset.metadata?.description ?? undefined,
          url: asset.metadata?.url ?? undefined,
          logo: asset.metadata?.logo ?? undefined
        }
      };
    } catch (error) {
      logger.warn(`Failed to fetch metadata for token ${unit}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Fetch metadata for multiple tokens (batch operation)
   */
  async fetchTokenMetadataBatch(units: string[]): Promise<Map<string, TokenMetadata>> {
    const metadata = new Map<string, TokenMetadata>();
    
    // Process in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < units.length; i += batchSize) {
      const batch = units.slice(i, i + batchSize);
      
      // Fetch batch in parallel
      const results = await Promise.all(
        batch.map(unit => this.fetchTokenMetadata(unit))
      );
      
      // Store results
      batch.forEach((unit, index) => {
        const result = results[index];
        if (result) {
          metadata.set(unit, result);
        }
      });
      
      // Rate limit delay between batches
      if (i + batchSize < units.length) {
        await this.sleep(100);
      }
    }
    
    return metadata;
  }

  /**
   * Helper to sleep for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}