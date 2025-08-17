/**
 * Queue Service Interface
 * 
 * Defines the contract for queue implementations.
 * This allows us to swap between Supabase, Redis, or other queue backends.
 */

export interface QueueJob<T = any> {
  id: string;
  type: string;
  data: T;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount: number;
  maxRetries: number;
  metadata?: Record<string, any>;
}

export interface WalletSyncJobData {
  walletAddress: string;
  userId: string;
  syncType: 'wallet_sync' | 'transaction_sync' | 'full_sync' | 'incremental_sync';
  fromBlock?: number;
  toBlock?: number;
}

export interface QueueOptions {
  priority?: number;
  delay?: number;
  maxRetries?: number;
  metadata?: Record<string, any>;
}

export interface IQueueService {
  /**
   * Add a job to the queue
   */
  add<T>(type: string, data: T, options?: QueueOptions): Promise<QueueJob<T>>;

  /**
   * Get the next job from the queue
   */
  getNext(type?: string): Promise<QueueJob | null>;

  /**
   * Mark a job as completed
   */
  complete(jobId: string, result?: any): Promise<void>;

  /**
   * Mark a job as failed
   */
  fail(jobId: string, error: string): Promise<void>;

  /**
   * Get job status
   */
  getJob<T>(jobId: string): Promise<QueueJob<T> | null>;

  /**
   * Get all jobs for a specific wallet/user
   */
  getJobsByWallet(walletAddress: string): Promise<QueueJob[]>;

  /**
   * Cancel a job
   */
  cancel(jobId: string): Promise<void>;

  /**
   * Get queue statistics
   */
  getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }>;

  /**
   * Clean up old completed/failed jobs
   */
  cleanup(olderThan: Date): Promise<number>;
}