/**
 * Wallet Sync Service
 * 
 * Handles Cardano wallet data synchronization using Blockfrost API
 * Integrates with Supabase for data persistence
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '@/lib/config';
import { DatabaseError, ExternalAPIError, ValidationError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type {
  WalletData,
  WalletBalance,
  CardanoUTXO,
  SyncResult,
  SyncOptions,
  BlockfrostResponse
} from '@/types/wallet';

// Blockfrost API response types
type BlockfrostAmount = {
  unit: string;
  quantity: string;
  fingerprint?: string;
};

type BlockfrostAddressInfo = {
  address: string;
  amount: BlockfrostAmount[];
  stake_address?: string;
  type: string;
  script: boolean;
};

type BlockfrostUTXO = {
  tx_hash: string;
  tx_index: number;
  output_index?: number;
  amount: BlockfrostAmount[];
  block: string;
  data_hash?: string;
};

export class WalletSyncService {
  private static instance: WalletSyncService;
  private logger = logger;
  private supabase: SupabaseClient;
  private blockfrostBaseUrl: string;
  private blockfrostKey: string;
  private syncQueue: Set<string> = new Set();

  private constructor() {
    // Prevent client-side instantiation (but allow Jest tests)
    if (typeof window !== 'undefined' && typeof global === 'undefined') {
      throw new Error('WalletSyncService can only be instantiated on the server');
    }

    const dbConfig = config.get('database');
    const apiConfig = config.get('api');
    
    this.supabase = createClient(
      dbConfig.supabaseUrl,
      dbConfig.supabaseServiceKey
    );
    
    // Use configured Blockfrost URL - no hardcoded fallbacks
    if (!apiConfig.blockfrostUrl) {
      throw new ValidationError('BLOCKFROST_URL is required for wallet sync service');
    }
    this.blockfrostBaseUrl = apiConfig.blockfrostUrl;
    this.blockfrostKey = apiConfig.blockfrostKey;
  }

  public static getInstance(): WalletSyncService {
    if (!WalletSyncService.instance) {
      WalletSyncService.instance = new WalletSyncService();
    }
    return WalletSyncService.instance;
  }

  /**
   * Synchronize wallet data from blockchain to database
   */
  public syncWallet = async (
    walletAddress: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> => {
    try {
      if (!walletAddress) {
        throw new ValidationError('Wallet address is required');
      }

      // Prevent duplicate syncs
      if (this.syncQueue.has(walletAddress)) {
        return {
          success: false,
          walletAddress,
          syncedAt: new Date(),
          blockHeight: 0,
          transactionCount: 0,
          error: 'Sync already in progress'
        };
      }

      this.syncQueue.add(walletAddress);
      this.logger.info(`Starting wallet sync for: ${walletAddress}`);

      const maxRetries = options.maxRetries || config.get('wallet').maxRetries;
      let attempt = 0;
      let lastError: Error | null = null;

      while (attempt < maxRetries) {
        try {
          const result = await this.performSync(walletAddress, options);
          this.syncQueue.delete(walletAddress);
          return result;
        } catch (error) {
          lastError = error as Error;
          attempt++;
          
          if (attempt < maxRetries) {
            const delay = config.get('wallet').retryDelay * attempt;
            this.logger.warn(`Sync attempt ${attempt} failed, retrying in ${delay}ms`);
            await this.sleep(delay);
          }
        }
      }

      this.syncQueue.delete(walletAddress);
      throw lastError || new Error('Max retries exceeded');

    } catch (error) {
      this.syncQueue.delete(walletAddress);
      this.logger.error(`Wallet sync failed for ${walletAddress}`, error);
      
      return {
        success: false,
        walletAddress,
        syncedAt: new Date(),
        blockHeight: 0,
        transactionCount: 0,
        error: error instanceof Error ? error.message : 'Sync failed'
      };
    }
  };

  /**
   * Perform the actual sync operation
   */
  private performSync = async (
    walletAddress: string,
    options: SyncOptions
  ): Promise<SyncResult> => {
    // Get current blockchain data
    const [balance, utxos, blockHeight] = await Promise.all([
      this.fetchWalletBalance(walletAddress),
      this.fetchWalletUTXOs(walletAddress),
      this.getCurrentBlockHeight()
    ]);

    if (!balance.success || !utxos.success || !blockHeight.success) {
      throw new ExternalAPIError('Failed to fetch blockchain data');
    }

    const walletData: WalletData = {
      address: walletAddress,
      balance: balance.data!,
      utxos: utxos.data!,
      lastSyncedAt: new Date(),
      syncedBlockHeight: blockHeight.data!
    };

    // Save to database
    const dbResult = await this.saveWalletData(walletData);
    if (!dbResult.success) {
      throw new DatabaseError('Failed to save wallet data');
    }

    this.logger.info(`Wallet sync completed for: ${walletAddress}`);

    return {
      success: true,
      walletAddress,
      syncedAt: walletData.lastSyncedAt,
      blockHeight: blockHeight.data!,
      transactionCount: utxos.data!.length,
    };
  };

  /**
   * Fetch wallet balance from Blockfrost API
   */
  private fetchWalletBalance = async (address: string): Promise<BlockfrostResponse<WalletBalance>> => {
    try {
      const response = await fetch(`${this.blockfrostBaseUrl}/addresses/${address}`, {
        headers: {
          'project_id': this.blockfrostKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Blockfrost API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Transform Blockfrost response to our format
      const addressData = data as BlockfrostAddressInfo;
      const balance: WalletBalance = {
        lovelace: addressData.amount.find(a => a.unit === 'lovelace')?.quantity || '0',
        assets: addressData.amount
          .filter(a => a.unit !== 'lovelace')
          .map(asset => ({
            unit: asset.unit,
            quantity: asset.quantity,
            policyId: asset.unit.slice(0, 56),
            assetName: asset.unit.slice(56),
            fingerprint: asset.fingerprint || ''
          }))
      };

      return { success: true, data: balance };
    } catch (error) {
      this.logger.error(`Failed to fetch balance for ${address}`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  /**
   * Fetch wallet UTXOs from Blockfrost API
   */
  private fetchWalletUTXOs = async (address: string): Promise<BlockfrostResponse<CardanoUTXO[]>> => {
    try {
      const response = await fetch(`${this.blockfrostBaseUrl}/addresses/${address}/utxos`, {
        headers: {
          'project_id': this.blockfrostKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Blockfrost API error: ${response.status}`);
      }

      const data = await response.json();
      
      const utxosData = data as BlockfrostUTXO[];
      const utxos: CardanoUTXO[] = utxosData.map(utxo => ({
        txHash: utxo.tx_hash,
        outputIndex: utxo.tx_index || utxo.output_index || 0,
        amount: utxo.amount.map(a => ({
          unit: a.unit,
          quantity: a.quantity
        })),
        block: utxo.block,
        dataHash: utxo.data_hash
      }));

      return { success: true, data: utxos };
    } catch (error) {
      this.logger.error(`Failed to fetch UTXOs for ${address}`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  /**
   * Get current blockchain height
   */
  private getCurrentBlockHeight = async (): Promise<BlockfrostResponse<number>> => {
    try {
      const response = await fetch(`${this.blockfrostBaseUrl}/blocks/latest`, {
        headers: {
          'project_id': this.blockfrostKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Blockfrost API error: ${response.status}`);
      }

      const data = await response.json();
      return { success: true, data: data.height };
    } catch (error) {
      this.logger.error('Failed to fetch current block height', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  /**
   * Save wallet data to Supabase database
   */
  private saveWalletData = async (walletData: WalletData): Promise<{ success: boolean; error?: string }> => {
    try {
      // Insert or update wallet record
      const { error: walletError } = await this.supabase
        .from('wallets')
        .upsert({
          address: walletData.address,
          balance_lovelace: walletData.balance.lovelace,
          last_synced_at: walletData.lastSyncedAt.toISOString(),
          synced_block_height: walletData.syncedBlockHeight,
        }, {
          onConflict: 'address'
        });

      if (walletError) {
        throw new DatabaseError(`Failed to save wallet: ${walletError.message}`);
      }

      // Save assets if any
      if (walletData.balance.assets.length > 0) {
        const { error: assetsError } = await this.supabase
          .from('wallet_assets')
          .delete()
          .eq('wallet_address', walletData.address);

        if (assetsError) {
          this.logger.warn(`Failed to clear old assets: ${assetsError.message}`);
        }

        const assetRecords = walletData.balance.assets.map(asset => ({
          wallet_address: walletData.address,
          unit: asset.unit,
          quantity: asset.quantity,
          policy_id: asset.policyId,
          asset_name: asset.assetName,
          fingerprint: asset.fingerprint
        }));

        const { error: insertError } = await this.supabase
          .from('wallet_assets')
          .insert(assetRecords);

        if (insertError) {
          throw new DatabaseError(`Failed to save assets: ${insertError.message}`);
        }
      }

      // Save UTXOs
      if (walletData.utxos.length > 0) {
        const { error: utxosError } = await this.supabase
          .from('wallet_utxos')
          .delete()
          .eq('wallet_address', walletData.address);

        if (utxosError) {
          this.logger.warn(`Failed to clear old UTXOs: ${utxosError.message}`);
        }

        const utxoRecords = walletData.utxos.map(utxo => ({
          wallet_address: walletData.address,
          tx_hash: utxo.txHash,
          output_index: utxo.outputIndex,
          amount: JSON.stringify(utxo.amount),
          block_hash: utxo.block,
          data_hash: utxo.dataHash
        }));

        const { error: insertUtxoError } = await this.supabase
          .from('wallet_utxos')
          .insert(utxoRecords);

        if (insertUtxoError) {
          throw new DatabaseError(`Failed to save UTXOs: ${insertUtxoError.message}`);
        }
      }

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to save wallet data', error);
      return { success: false, error: error instanceof Error ? error.message : 'Database error' };
    }
  };

  /**
   * Get wallet data from database
   */
  public getWalletData = async (walletAddress: string): Promise<WalletData | null> => {
    try {
      const { data: wallet, error } = await this.supabase
        .from('wallets')
        .select(`
          *,
          wallet_assets(*),
          wallet_utxos(*)
        `)
        .eq('address', walletAddress)
        .single();

      if (error) {
        this.logger.error(`Failed to fetch wallet data: ${error.message}`);
        return null;
      }

      if (!wallet) {
        return null;
      }

      return {
        address: wallet.address,
        balance: {
          lovelace: wallet.balance_lovelace,
          assets: wallet.wallet_assets?.map((asset: any) => ({
            unit: asset.unit,
            quantity: asset.quantity,
            policyId: asset.policy_id,
            assetName: asset.asset_name,
            fingerprint: asset.fingerprint
          })) || []
        },
        utxos: wallet.wallet_utxos?.map((utxo: any) => ({
          txHash: utxo.tx_hash,
          outputIndex: utxo.output_index,
          amount: JSON.parse(utxo.amount),
          block: utxo.block_hash,
          dataHash: utxo.data_hash
        })) || [],
        lastSyncedAt: new Date(wallet.last_synced_at),
        syncedBlockHeight: wallet.synced_block_height
      };
    } catch (error) {
      this.logger.error(`Failed to get wallet data for ${walletAddress}`, error);
      return null;
    }
  };

  /**
   * Check if wallet needs sync based on last sync time
   */
  public shouldSync = async (walletAddress: string): Promise<boolean> => {
    const walletData = await this.getWalletData(walletAddress);
    if (!walletData) {
      return true; // Never synced
    }

    const timeSinceSync = Date.now() - walletData.lastSyncedAt.getTime();
    const syncInterval = config.get('wallet').syncInterval * 1000;
    
    return timeSinceSync > syncInterval;
  };

  /**
   * Get sync queue status
   */
  public getSyncStatus = (): { queueSize: number; activeAddresses: string[] } => {
    return {
      queueSize: this.syncQueue.size,
      activeAddresses: Array.from(this.syncQueue)
    };
  };

  /**
   * Helper method for delays
   */
  private sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };
}

// Export singleton instance
export const walletSyncService = WalletSyncService.getInstance();