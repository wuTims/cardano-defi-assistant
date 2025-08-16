/**
 * Sync Worker
 * 
 * Processes wallet sync jobs from the queue
 * Fetches blockchain data and updates database
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { ServiceFactory } from '@/services/service-factory';
import { BlockfrostService } from '@/services/blockchain/blockfrost-service';
import { WalletTransactionParser } from '@/services/wallet-transaction-parser';
import { WalletTransactionFilter } from '@/services/wallet-transaction-filter';
import { TransactionCategorizerService } from '@/services/transaction-categorizer-service';
import { TokenRegistryService } from '@/services/token-registry-service';
import { LRUTokenCache } from '@/services/token-cache';
import { createRepositories } from '@/repositories';
import type { QueueJob, WalletSyncJobData } from '@/services/interfaces/queue-service';
import type { WalletTransaction } from '@/types/transaction';

export class SyncWorker {
  private isRunning = false;
  private blockfrost: BlockfrostService;
  private parser: WalletTransactionParser;
  private repos: ReturnType<typeof createRepositories>;
  private supabase: any;

  constructor() {
    // Initialize services
    this.blockfrost = new BlockfrostService(process.env.BLOCKFROST_KEY!);
    
    // Initialize Supabase first since repositories depend on it
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Initialize repositories with service role client
    this.repos = createRepositories(this.supabase);
    
    // Initialize parser with its dependencies
    const walletFilter = new WalletTransactionFilter();
    const categorizer = new TransactionCategorizerService();
    const tokenCache = new LRUTokenCache();
    const tokenRegistry = new TokenRegistryService(this.repos.token, tokenCache);
    
    this.parser = new WalletTransactionParser(
      walletFilter,
      walletFilter, // Also implements IAssetFlowCalculator
      categorizer,
      tokenRegistry,
      tokenCache
    );
  }

  /**
   * Start the worker - polls for jobs and processes them
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.info('Sync worker already running');
      return;
    }
    
    this.isRunning = true;
    logger.info('Sync worker started');
    
    while (this.isRunning) {
      try {
        await this.processNextJob();
        // Wait before checking for next job
        await this.sleep(5000); // 5 seconds
      } catch (error) {
        logger.error(`Error in sync worker loop: ${error}`);
        await this.sleep(10000); // Wait longer on error
      }
    }
  }

  /**
   * Stop the worker
   */
  stop(): void {
    this.isRunning = false;
    logger.info('Sync worker stopped');
  }

  /**
   * Process the next job from the queue
   */
  private async processNextJob(): Promise<void> {
    const queueService = ServiceFactory.getQueueService();
    
    // Get next job
    const job = await queueService.getNext('wallet_sync');
    if (!job) {
      return; // No jobs to process
    }
    
    logger.info(`Processing sync job ${job.id} for wallet ${job.data.walletAddress}`);
    
    try {
      const lastBlock = await this.processJob(job);
      await queueService.complete(job.id, { lastBlock });
      logger.info(`Completed sync job ${job.id} at block ${lastBlock}`);
    } catch (error) {
      logger.error(`Failed to process job ${job.id}: ${error}`);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await queueService.fail(job.id, errorMessage);
    }
  }

  /**
   * Process a single sync job
   * Returns the last block that was synced
   */
  private async processJob(job: QueueJob<WalletSyncJobData>): Promise<number> {
    const { walletAddress, userId, fromBlock } = job.data;
    
    // Get current block height
    const currentBlock = await this.blockfrost.getCurrentBlockHeight();
    
    // Track processed transactions
    let totalProcessed = 0;
    let totalErrors = 0;
    const BATCH_SIZE = 50; // Process in batches of 50
    
    // Fetch and process transactions
    for await (const txHashes of this.blockfrost.fetchAddressTransactions(walletAddress, fromBlock)) {
      // Collect transactions for batch processing
      const batchTransactions: WalletTransaction[] = [];
      let batchErrors = 0;
      
      // Process each hash in the batch
      for (const hash of txHashes) {
        try {
          // Fetch full transaction details
          const rawTx = await this.blockfrost.fetchTransactionDetails(hash);
          
          // Parse into wallet transaction
          const walletTx = await this.parser.parseTransaction(rawTx, walletAddress);
          
          if (walletTx) {
            batchTransactions.push(walletTx);
          }
          
          // Small delay to avoid rate limits
          await this.sleep(50);
        } catch (error) {
          logger.error(`Failed to process transaction ${hash}: ${error}`);
          batchErrors++;
        }
        
        // Save batch when it reaches BATCH_SIZE
        if (batchTransactions.length >= BATCH_SIZE) {
          try {
            await this.repos.transaction.saveBatch(batchTransactions, userId);
            totalProcessed += batchTransactions.length;
            totalErrors += batchErrors;
            
            // Update job progress
            await this.updateJobProgress(job.id, {
              processed: totalProcessed,
              errors: totalErrors
            });
            
            // Clear the batch
            batchTransactions.length = 0;
            batchErrors = 0;
          } catch (error) {
            logger.error(`Failed to save batch of ${batchTransactions.length} transactions: ${error}`);
            throw new Error(`Batch save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }
      
      // Save any remaining transactions in the batch
      if (batchTransactions.length > 0) {
        try {
          await this.repos.transaction.saveBatch(batchTransactions, userId);
          totalProcessed += batchTransactions.length;
          totalErrors += batchErrors;
          
          // Update job progress
          await this.updateJobProgress(job.id, {
            processed: totalProcessed,
            errors: totalErrors
          });
        } catch (error) {
          logger.error(`Failed to save final batch of ${batchTransactions.length} transactions: ${error}`);
          throw new Error(`Final batch save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
    
    // Fetch actual balance from Blockfrost (source of truth)
    let actualBalance = '0';
    try {
      actualBalance = await this.blockfrost.getAddressBalance(walletAddress);
      logger.info(`Fetched wallet balance from Blockfrost: ${actualBalance} lovelace`);
    } catch (error) {
      logger.error(`Failed to fetch wallet balance: ${error}`);
      // Continue without updating balance
    }
    
    // Optional: Calculate balance from our transactions for validation
    if (totalProcessed > 0) {
      try {
        const { data: balanceData } = await this.supabase
          .rpc('calculate_wallet_balance', {
            p_wallet_address: walletAddress,
            p_user_id: userId
          });
        const calculatedBalance = balanceData?.balance || '0';
        
        // Compare and log any discrepancy
        if (calculatedBalance !== actualBalance) {
          const diff = BigInt(actualBalance) - BigInt(calculatedBalance);
          logger.warn(`Balance discrepancy! Calculated: ${calculatedBalance}, Actual: ${actualBalance}, Diff: ${diff}`);
        }
      } catch (error) {
        logger.warn(`Failed to calculate balance for validation: ${error}`);
      }
    }
    
    // Update sync status with actual balance
    try {
      await this.updateSyncStatus(walletAddress, userId, currentBlock, actualBalance);
    } catch (error) {
      logger.error(`Failed to update sync status: ${error}`);
      throw new Error(`Failed to update sync status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Clear caches
    try {
      await this.clearCaches(walletAddress);
    } catch (error) {
      logger.warn(`Failed to clear caches (non-critical): ${error}`);
      // Don't throw - cache clearing is non-critical
    }
    
    logger.info(`Sync complete: ${totalProcessed} transactions processed, ${totalErrors} errors`);
    
    // Return the last block that was synced
    return currentBlock;
  }

  /**
   * Update job progress in metadata
   */
  private async updateJobProgress(jobId: string, progress: any): Promise<void> {
    try {
      await this.supabase
        .from('sync_jobs')
        .update({
          metadata: {
            progress
          }
        })
        .eq('id', jobId);
    } catch (error) {
      logger.warn(`Failed to update job progress: ${error}`);
    }
  }

  /**
   * Update wallet sync status
   */
  private async updateSyncStatus(
    walletAddress: string,
    userId: string,
    lastBlock: number,
    balance?: string
  ): Promise<void> {
    const updateData: any = {
      synced_block_height: lastBlock,
      last_synced_at: new Date().toISOString(),
      sync_in_progress: false
    };
    
    // Only update balance if provided
    if (balance) {
      updateData.balance_lovelace = balance;
    }
    
    const { error } = await this.supabase
      .from('wallets')
      .update(updateData)
      .eq('wallet_address', walletAddress)
      .eq('user_id', userId);
    
    if (error) {
      throw new Error(`Failed to update wallet sync status: ${error.message}`);
    }
  }

  /**
   * Clear caches for the wallet
   */
  private async clearCaches(walletAddress: string): Promise<void> {
    const walletCache = ServiceFactory.getWalletCache();
    const txCache = ServiceFactory.getTransactionsCache();
    
    // Clear wallet cache
    await walletCache.delete(ServiceFactory.cacheKey.wallet(walletAddress));
    
    // Clear transaction cache (pattern-based deletion)
    await txCache.delPattern(`tx:${walletAddress}:*`);
    
    logger.info(`Cleared caches for wallet ${walletAddress}`);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}