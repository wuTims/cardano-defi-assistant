/**
 * Prisma Queue Repository
 * 
 * TEMPORARY: This implementation will be replaced by BullMQ in Phase 3.
 * Currently implements queue logic in database to fix broken RPC functions.
 * 
 * Replaces Supabase RPC queue functions with direct Prisma operations.
 * Handles sync job queue management with atomic operations.
 * 
 * Design: Accepts PrismaClient via constructor for better testability and swappability
 */

import type { PrismaClient } from '@prisma/client';
import type { IQueueRepository } from '@/repositories/interfaces/queue-repository';
import type { SyncJob, Prisma } from '@prisma/client';
import { logger as rootLogger } from '@/lib/logger';

const logger = rootLogger.child({ repository: 'PrismaQueueRepository' });

export class PrismaQueueRepository implements IQueueRepository {
  constructor(private readonly prisma: PrismaClient) {}
  /**
   * Get next available job and mark it as processing
   * Replaces: get_next_sync_job RPC
   * Uses atomic update to prevent race conditions
   * 
   * Note: BullMQ will handle this automatically in Phase 3
   */
  async getNextJob(jobType?: string): Promise<SyncJob | null> {
    const queueLogger = logger.child({ method: 'getNextJob', jobType });
    
    try {
      // Atomic update: find and update in one operation
      // This prevents race conditions between workers
      const job = await this.prisma.syncJob.findFirst({
        where: {
          status: 'pending',
          ...(jobType && { jobType }),
          scheduledAt: { lte: new Date() }
        },
        orderBy: [
          { priority: 'desc' },
          { scheduledAt: 'asc' }
        ]
      });

      if (!job) {
        return null;
      }

      // Attempt to claim the job atomically
      const claimed = await this.prisma.syncJob.updateMany({
        where: {
          id: job.id,
          status: 'pending' // Double-check it's still pending
        },
        data: {
          status: 'processing',
          startedAt: new Date()
        }
      });

      if (claimed.count === 0) {
        // Another worker got it first
        queueLogger.debug({ jobId: job.id }, 'Job already claimed by another worker');
        return null;
      }

      // Return the updated job
      const updatedJob = await this.prisma.syncJob.findUnique({
        where: { id: job.id }
      });

      queueLogger.info({ jobId: job.id, walletAddress: job.walletAddress }, 'Job claimed');
      return updatedJob;
    } catch (error) {
      queueLogger.error({ error }, 'Failed to get next job');
      throw error;
    }
  }

  /**
   * Mark job as completed
   * Replaces: complete_sync_job RPC (success case)
   */
  async completeJob(jobId: string, lastBlockSynced?: number): Promise<void> {
    const completeLogger = logger.child({ method: 'completeJob', jobId });
    
    try {
      await this.prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          lastBlockSynced,
          errorMessage: null
        }
      });
      
      completeLogger.info({ lastBlockSynced }, 'Job completed');
    } catch (error) {
      completeLogger.error({ error }, 'Failed to complete job');
      throw error;
    }
  }

  /**
   * Mark job as failed
   * Replaces: complete_sync_job RPC (failure case)
   * 
   * Note: BullMQ has built-in retry logic with exponential backoff
   */
  async failJob(jobId: string, errorMessage: string): Promise<void> {
    const failLogger = logger.child({ method: 'failJob', jobId });
    
    try {
      const job = await this.prisma.syncJob.findUnique({
        where: { id: jobId },
        select: { retryCount: true, maxRetries: true }
      });

      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      const shouldRetry = job.retryCount < job.maxRetries;
      
      await this.prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: shouldRetry ? 'pending' : 'failed',
          completedAt: shouldRetry ? null : new Date(),
          errorMessage,
          retryCount: { increment: 1 },
          // Exponential backoff for retries
          scheduledAt: shouldRetry 
            ? new Date(Date.now() + Math.pow(2, job.retryCount) * 60000)
            : undefined
        }
      });
      
      failLogger.warn({ 
        errorMessage, 
        retryCount: job.retryCount + 1,
        willRetry: shouldRetry 
      }, 'Job failed');
    } catch (error) {
      failLogger.error({ error }, 'Failed to mark job as failed');
      throw error;
    }
  }

  /**
   * Create a new sync job
   */
  async createJob(
    walletAddress: string,
    userId: string | null,
    jobType: string,
    priority: number = 0,
    metadata?: Record<string, unknown>
  ): Promise<SyncJob> {
    const createLogger = logger.child({ 
      method: 'createJob', 
      walletAddress, 
      jobType 
    });
    
    try {
      const job = await this.prisma.syncJob.create({
        data: {
          walletAddress,
          userId,
          jobType,
          priority,
          status: 'pending',
          metadata: metadata as Prisma.InputJsonValue
        }
      });
      
      createLogger.info({ jobId: job.id }, 'Job created');
      return job;
    } catch (error) {
      createLogger.error({ error }, 'Failed to create job');
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<SyncJob | null> {
    try {
      return await this.prisma.syncJob.findUnique({
        where: { id: jobId }
      });
    } catch (error) {
      logger.error({ error, jobId }, 'Failed to get job');
      throw error;
    }
  }

  /**
   * Get jobs for a wallet
   */
  async getJobsByWallet(walletAddress: string, limit: number = 10): Promise<SyncJob[]> {
    try {
      return await this.prisma.syncJob.findMany({
        where: { walletAddress },
        orderBy: { createdAt: 'desc' },
        take: limit
      });
    } catch (error) {
      logger.error({ error, walletAddress }, 'Failed to get jobs by wallet');
      throw error;
    }
  }

  /**
   * Cancel a pending or processing job
   */
  async cancelJob(jobId: string): Promise<void> {
    const cancelLogger = logger.child({ method: 'cancelJob', jobId });
    
    try {
      const result = await this.prisma.syncJob.updateMany({
        where: {
          id: jobId,
          status: { in: ['pending', 'processing'] }
        },
        data: {
          status: 'cancelled',
          completedAt: new Date(),
          errorMessage: 'Cancelled by user'
        }
      });

      if (result.count === 0) {
        cancelLogger.warn('Job not found or already completed');
      } else {
        cancelLogger.info('Job cancelled');
      }
    } catch (error) {
      cancelLogger.error({ error }, 'Failed to cancel job');
      throw error;
    }
  }

  /**
   * Get queue statistics
   * Note: BullMQ provides built-in metrics in Phase 3
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    try {
      const [pending, processing, completed, failed] = await Promise.all([
        this.prisma.syncJob.count({ where: { status: 'pending' } }),
        this.prisma.syncJob.count({ where: { status: 'processing' } }),
        this.prisma.syncJob.count({ where: { status: 'completed' } }),
        this.prisma.syncJob.count({ where: { status: 'failed' } })
      ]);

      return { pending, processing, completed, failed };
    } catch (error) {
      logger.error({ error }, 'Failed to get queue stats');
      throw error;
    }
  }

  /**
   * Clean up old completed/failed jobs
   * Replaces: cleanup_old_sync_jobs RPC
   */
  async cleanupOldJobs(olderThanDays: number = 7): Promise<number> {
    const cleanupLogger = logger.child({ method: 'cleanupOldJobs', olderThanDays });
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.prisma.syncJob.deleteMany({
        where: {
          status: { in: ['completed', 'failed', 'cancelled'] },
          completedAt: { lt: cutoffDate }
        }
      });

      cleanupLogger.info({ deleted: result.count }, 'Old jobs cleaned up');
      return result.count;
    } catch (error) {
      cleanupLogger.error({ error }, 'Failed to cleanup old jobs');
      throw error;
    }
  }

  /**
   * Reset stuck processing jobs back to pending
   * Note: BullMQ has stalled job detection built-in
   */
  async resetStuckJobs(stuckForMinutes: number = 30): Promise<number> {
    const resetLogger = logger.child({ method: 'resetStuckJobs', stuckForMinutes });
    
    try {
      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - stuckForMinutes);

      const result = await this.prisma.syncJob.updateMany({
        where: {
          status: 'processing',
          startedAt: { lt: cutoffTime }
        },
        data: {
          status: 'pending',
          startedAt: null,
          errorMessage: 'Reset due to timeout'
        }
      });

      if (result.count > 0) {
        resetLogger.warn({ reset: result.count }, 'Stuck jobs reset');
      }
      
      return result.count;
    } catch (error) {
      resetLogger.error({ error }, 'Failed to reset stuck jobs');
      throw error;
    }
  }
}