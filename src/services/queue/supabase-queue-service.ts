/**
 * Supabase Queue Service Implementation
 * 
 * Uses Supabase as a queue backend for job processing.
 * This provides persistence and visibility without additional infrastructure.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import type { 
  IQueueService, 
  QueueJob, 
  QueueOptions,
  WalletSyncJobData 
} from '@/services/interfaces/queue-service';

interface DatabaseSyncJob {
  id: string;
  wallet_address: string;
  user_id: string;
  status: string;
  priority: number;
  job_type: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  metadata: any;
  last_block_synced?: number;
}

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

      return this.mapToQueueJob<T>(job);
    } catch (error) {
      logger.error('Error adding job to queue', error);
      throw error;
    }
  }

  /**
   * Get the next job from the queue
   */
  async getNext(type?: string): Promise<QueueJob | null> {
    try {
      // Use the database function to get and lock the next job
      const { data, error } = await this.supabase
        .rpc('get_next_sync_job');

      if (error) {
        logger.error('Error getting next job', error);
        return null;
      }

      if (!data || !data.id) {
        return null;
      }

      return this.mapToQueueJob(data);
    } catch (error) {
      logger.error('Error getting next job from queue', error);
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
      logger.error('Error completing job', error);
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
      logger.error('Error marking job as failed', err);
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

      return this.mapToQueueJob<T>(data);
    } catch (error) {
      logger.error('Error getting job', error);
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

      return (data || []).map(job => this.mapToQueueJob(job));
    } catch (error) {
      logger.error('Error getting jobs by wallet', error);
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
      logger.error('Error cancelling job', error);
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
      logger.error('Error getting queue stats', error);
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
      logger.error('Error cleaning up old jobs', error);
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
  private mapToQueueJob<T = any>(row: DatabaseSyncJob): QueueJob<T> {
    const data = row.metadata?.data || {
      walletAddress: row.wallet_address,
      userId: row.user_id,
      syncType: row.job_type
    } as T;

    return {
      id: row.id,
      type: row.job_type,
      data,
      status: row.status as any,
      priority: row.priority,
      createdAt: new Date(row.created_at),
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      error: row.error_message,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      metadata: row.metadata
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