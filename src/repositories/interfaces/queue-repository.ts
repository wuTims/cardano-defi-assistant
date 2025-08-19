/**
 * Queue Repository Interface
 * 
 * Defines the contract for sync job queue operations.
 * Replaces Supabase RPC queue functions with repository pattern.
 */

import type { SyncJob } from '@prisma/client';

export interface JobFilters {
  status?: string;
  walletAddress?: string;
  userId?: string;
  jobType?: string;
  limit?: number;
}

export interface IQueueRepository {
  /**
   * Get next available job and mark it as processing
   * Replaces: get_next_sync_job RPC
   * Atomic operation to prevent race conditions
   */
  getNextJob(jobType?: string): Promise<SyncJob | null>;

  /**
   * Mark job as completed
   * Replaces: complete_sync_job RPC (success case)
   */
  completeJob(
    jobId: string, 
    lastBlockSynced?: number
  ): Promise<void>;

  /**
   * Mark job as failed
   * Replaces: complete_sync_job RPC (failure case)
   */
  failJob(
    jobId: string, 
    errorMessage: string
  ): Promise<void>;

  /**
   * Create a new sync job
   */
  createJob(
    walletAddress: string,
    userId: string | null,
    jobType: string,
    priority?: number,
    metadata?: Record<string, unknown>
  ): Promise<SyncJob>;

  /**
   * Get job by ID
   */
  getJob(jobId: string): Promise<SyncJob | null>;

  /**
   * Get jobs for a wallet
   */
  getJobsByWallet(walletAddress: string, limit?: number): Promise<SyncJob[]>;

  /**
   * Cancel a pending or processing job
   */
  cancelJob(jobId: string): Promise<void>;

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
   * Replaces: cleanup_old_sync_jobs RPC
   */
  cleanupOldJobs(olderThanDays?: number): Promise<number>;

  /**
   * Reset stuck processing jobs back to pending
   * For jobs that have been processing too long
   */
  resetStuckJobs(stuckForMinutes?: number): Promise<number>;
}