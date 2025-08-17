/**
 * Supabase Queue Service Implementation
 * 
 * Uses Supabase as a queue backend for job processing.
 * This provides persistence and visibility without additional infrastructure.
 */

import { createClient, SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import type { 
  IQueueService, 
  QueueJob, 
  QueueOptions,
  WalletSyncJobData 
} from '@/services/interfaces/queue-service';
import type { DatabaseSyncJob } from '@/types/database';

export class SupabaseQueueService implements IQueueService {
  private supabase: SupabaseClient;
  private pollInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  /**
   * Add a job to the queue
   */
  async add<T>(type: string, data: T, options: QueueOptions = {}): Promise<QueueJob<T>> {
    try {
      const jobData = data as any;
      const { data: job, error } = await this.supabase
        .from('sync_jobs')
        .insert({
          wallet_address: jobData.walletAddress || '',
          user_id: jobData.userId || null,
          job_type: type,
          status: 'pending',
          priority: options.priority || 0,
          max_retries: options.maxRetries || 3,
          retry_count: 0,
          metadata: {
            ...options.metadata,
            data
          }
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to add job to queue: ${error.message}`);
      }

      return this.mapToQueueJob<T>(job as DatabaseSyncJob);
    } catch (error) {
      logger.error({ err: error }, 'Error adding job to queue');
      throw error;
    }
  }

  /**
   * Get the next job from the queue
   */
  async getNext(type?: string): Promise<QueueJob | null> {
    try {
      // Use the database function to get and lock the next job
      const result = await this.supabase
        .rpc('get_next_sync_job');
      
      const { data, error } = result as { data: DatabaseSyncJob | null; error: PostgrestError | null };

      if (error) {
        logger.error({ err: error }, 'Error getting next job');
        return null;
      }

      if (!data || !data.id) {
        return null;
      }

      return this.mapToQueueJob<WalletSyncJobData>(data);
    } catch (error) {
      logger.error({ err: error }, 'Error getting next job from queue');
      return null;
    }
  }

  /**
   * Mark a job as completed
   */
  async complete(jobId: string, result?: any): Promise<void> {
    try {
      const { error } = await this.supabase
        .rpc('complete_sync_job', {
          p_job_id: jobId,
          p_success: true,
          p_error_message: null,
          p_last_block: result?.lastBlock || null
        });

      if (error) {
        throw new Error(`Failed to complete job: ${error.message}`);
      }

      logger.info(`Job ${jobId} completed successfully`);
    } catch (error) {
      logger.error({ err: error }, 'Error completing job');
      throw error;
    }
  }

  /**
   * Mark a job as failed
   */
  async fail(jobId: string, error: string): Promise<void> {
    try {
      const { error: dbError } = await this.supabase
        .rpc('complete_sync_job', {
          p_job_id: jobId,
          p_success: false,
          p_error_message: error,
          p_last_block: null
        });

      if (dbError) {
        throw new Error(`Failed to mark job as failed: ${dbError.message}`);
      }

      logger.error(`Job ${jobId} failed: ${error}`);
    } catch (err) {
      logger.error({ err }, 'Error marking job as failed');
      throw err;
    }
  }

  /**
   * Get job status
   */
  async getJob<T>(jobId: string): Promise<QueueJob<T> | null> {
    try {
      const { data, error } = await this.supabase
        .from('sync_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapToQueueJob<T>(data as DatabaseSyncJob);
    } catch (error) {
      logger.error({ err: error }, 'Error getting job');
      return null;
    }
  }

  /**
   * Get all jobs for a specific wallet
   */
  async getJobsByWallet(walletAddress: string): Promise<QueueJob[]> {
    try {
      const { data, error } = await this.supabase
        .from('sync_jobs')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        throw new Error(`Failed to get jobs for wallet: ${error.message}`);
      }

      return (data || []).map((job: DatabaseSyncJob) => this.mapToQueueJob<WalletSyncJobData>(job));
    } catch (error) {
      logger.error({ err: error }, 'Error getting jobs by wallet');
      return [];
    }
  }

  /**
   * Cancel a job
   */
  async cancel(jobId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('sync_jobs')
        .update({ 
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId)
        .in('status', ['pending', 'processing']);

      if (error) {
        throw new Error(`Failed to cancel job: ${error.message}`);
      }

      logger.info(`Job ${jobId} cancelled`);
    } catch (error) {
      logger.error({ err: error }, 'Error cancelling job');
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('sync_jobs')
        .select('status')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error) {
        throw new Error(`Failed to get queue stats: ${error.message}`);
      }

      const stats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0
      };

      (data || []).forEach(job => {
        switch (job.status) {
          case 'pending':
            stats.pending++;
            break;
          case 'processing':
            stats.processing++;
            break;
          case 'completed':
            stats.completed++;
            break;
          case 'failed':
            stats.failed++;
            break;
        }
      });

      return stats;
    } catch (error) {
      logger.error({ err: error }, 'Error getting queue stats');
      return { pending: 0, processing: 0, completed: 0, failed: 0 };
    }
  }

  /**
   * Clean up old completed/failed jobs
   */
  async cleanup(olderThan: Date): Promise<number> {
    try {
      const { error } = await this.supabase
        .rpc('cleanup_old_sync_jobs');

      if (error) {
        throw new Error(`Failed to cleanup old jobs: ${error.message}`);
      }

      logger.info('Old sync jobs cleaned up');
      return 0; // Count not returned by function, could be enhanced
    } catch (error) {
      logger.error({ err: error }, 'Error cleaning up old jobs');
      return 0;
    }
  }

  /**
   * Start processing jobs (for background worker)
   */
  startProcessing(processor: (job: QueueJob) => Promise<void>, intervalMs = 5000): void {
    if (this.pollInterval) {
      return; // Already processing
    }

    this.pollInterval = setInterval(async () => {
      if (this.isProcessing) {
        return; // Skip if already processing a job
      }

      this.isProcessing = true;
      
      try {
        const job = await this.getNext();
        if (job) {
          logger.info(`Processing job ${job.id}`);
          try {
            await processor(job);
            await this.complete(job.id);
          } catch (error) {
            await this.fail(job.id, error instanceof Error ? error.message : 'Unknown error');
          }
        }
      } finally {
        this.isProcessing = false;
      }
    }, intervalMs);

    logger.info(`Queue processing started with ${intervalMs}ms interval`);
  }

  /**
   * Stop processing jobs
   */
  stopProcessing(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      logger.info('Queue processing stopped');
    }
  }

  /**
   * Map database row to QueueJob interface
   */
  private mapToQueueJob<T = any>(dbJob: DatabaseSyncJob): QueueJob<T> {
    const data = dbJob.metadata?.data || {
      walletAddress: dbJob.wallet_address,
      userId: dbJob.user_id,
      syncType: dbJob.job_type
    } as T;

    return {
      id: dbJob.id,
      type: dbJob.job_type,
      data,
      status: dbJob.status as any,
      priority: dbJob.priority,
      createdAt: new Date(dbJob.created_at),
      startedAt: dbJob.started_at ? new Date(dbJob.started_at) : undefined,
      completedAt: dbJob.completed_at ? new Date(dbJob.completed_at) : undefined,
      error: dbJob.error_message,
      retryCount: dbJob.retry_count,
      maxRetries: dbJob.max_retries,
      metadata: dbJob.metadata
    };
  }
}

// Export singleton instance (lazy-loaded)
let _queueService: SupabaseQueueService | null = null;

export function getQueueService(): SupabaseQueueService {
  if (!_queueService) {
    _queueService = new SupabaseQueueService();
  }
  return _queueService;
}

// For backward compatibility
export const queueService = {
  get(): SupabaseQueueService {
    return getQueueService();
  }
};