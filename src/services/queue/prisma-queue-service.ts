/**
 * Prisma Queue Service
 * 
 * Implements IQueueService interface using Prisma for persistence.
 * This is a temporary implementation until BullMQ is integrated.
 * 
 * Wraps PrismaQueueRepository to provide domain-specific queue operations
 * following the IQueueService interface contract.
 * 
 * SOLID Principles:
 * - Single Responsibility: Queue management only
 * - Interface Segregation: Implements standard queue interface
 * - Dependency Inversion: Depends on repository abstraction
 */

import type { IQueueService } from '@/core/interfaces/services';
import type { IQueueRepository, ISyncJobRepository } from '@/core/interfaces/repositories';
import { logger as rootLogger } from '@/lib/logger';

const logger = rootLogger.child({ service: 'PrismaQueueService' });

/**
 * Queue job type for internal use
 */
interface QueueJob<T = any> {
  id: string;
  type: string;
  data: T;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  attempts: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

export class PrismaQueueService<T = any> implements IQueueService<T> {
  constructor(
    private readonly queueRepo: IQueueRepository,
    private readonly syncJobRepo: ISyncJobRepository
  ) {}

  /**
   * Add a new job to the queue
   */
  async addJob(
    type: string,
    data: T,
    options?: {
      priority?: number;
      delay?: number;
      retries?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    try {
      // Calculate scheduled time based on delay
      const scheduledAt = options?.delay 
        ? new Date(Date.now() + options.delay)
        : new Date();

      // Create job using sync job repository
      const job = await this.syncJobRepo.create({
        jobType: type,
        walletAddress: (data as any).walletAddress || '',
        userId: (data as any).userId,
        priority: options?.priority || 0,
        maxRetries: options?.retries || 3,
        metadata: {
          ...options?.metadata,
          data
        },
        scheduledAt
      });

      logger.info({ jobId: job.id, type }, 'Job added to queue');
      return job.id;
    } catch (error) {
      logger.error({ error, type }, 'Failed to add job to queue');
      throw error;
    }
  }

  /**
   * Get the next job to process from the queue
   */
  async getNextJob(type: string): Promise<QueueJob<T> | null> {
    try {
      const job = await this.queueRepo.getNextJob(type);
      
      if (!job) {
        return null;
      }

      // Transform to QueueJob format
      return {
        id: job.id,
        type: job.jobType,
        data: (job.metadata as any)?.data || {} as T,
        status: job.status as QueueJob['status'],
        result: (job.metadata as any)?.result,
        error: job.errorMessage || undefined,
        attempts: job.retryCount,
        createdAt: job.createdAt,
        startedAt: job.startedAt || undefined,
        completedAt: job.completedAt || undefined,
        metadata: job.metadata as Record<string, any>
      };
    } catch (error) {
      logger.error({ error, type }, 'Failed to get next job');
      return null;
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<QueueJob<T> | null> {
    try {
      const job = await this.syncJobRepo.findById(jobId);
      
      if (!job) {
        return null;
      }

      // Transform to QueueJob format
      return {
        id: job.id,
        type: job.jobType,
        data: (job.metadata as any)?.data || {} as T,
        status: job.status as QueueJob['status'],
        result: (job.metadata as any)?.result,
        error: job.errorMessage || undefined,
        attempts: job.retryCount,
        createdAt: job.createdAt,
        startedAt: job.startedAt || undefined,
        completedAt: job.completedAt || undefined,
        metadata: job.metadata as Record<string, any>
      };
    } catch (error) {
      logger.error({ error, jobId }, 'Failed to get job');
      return null;
    }
  }

  /**
   * Update job progress
   */
  async updateProgress(
    jobId: string,
    progress: number,
    message?: string
  ): Promise<void> {
    try {
      await this.syncJobRepo.updateProgress(jobId, progress, message);
      logger.debug({ jobId, progress }, 'Job progress updated');
    } catch (error) {
      logger.error({ error, jobId }, 'Failed to update job progress');
      throw error;
    }
  }

  /**
   * Complete a job with success result
   */
  async completeJob(jobId: string, result?: any): Promise<void> {
    try {
      await this.syncJobRepo.updateStatus(jobId, 'completed', {
        completedAt: new Date(),
        result,
        metadata: result ? { result } : undefined
      });
      logger.info({ jobId }, 'Job completed successfully');
    } catch (error) {
      logger.error({ error, jobId }, 'Failed to complete job');
      throw error;
    }
  }

  /**
   * Fail a job with error
   */
  async failJob(jobId: string, error: string): Promise<void> {
    try {
      await this.syncJobRepo.updateStatus(jobId, 'failed', {
        completedAt: new Date(),
        error
      });
      logger.error({ jobId, error }, 'Job failed');
    } catch (error) {
      logger.error({ error: error.toString(), jobId }, 'Failed to mark job as failed');
      throw error;
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<void> {
    try {
      await this.syncJobRepo.retry(jobId);
      logger.info({ jobId }, 'Job queued for retry');
    } catch (error) {
      logger.error({ error, jobId }, 'Failed to retry job');
      throw error;
    }
  }

  /**
   * Get all jobs for a specific identifier (e.g., wallet address)
   */
  async getJobsByIdentifier(
    identifier: string,
    options?: {
      status?: 'pending' | 'processing' | 'completed' | 'failed';
      limit?: number;
      offset?: number;
    }
  ): Promise<Array<{
    id: string;
    type: string;
    status: string;
    createdAt: Date;
    completedAt?: Date;
  }>> {
    try {
      const jobs = await this.syncJobRepo.findByWallet(identifier, {
        status: options?.status,
        limit: options?.limit,
        offset: options?.offset
      });

      return jobs.map(job => ({
        id: job.id,
        type: job.jobType,
        status: job.status,
        createdAt: job.createdAt,
        completedAt: job.completedAt || undefined
      }));
    } catch (error) {
      logger.error({ error, identifier }, 'Failed to get jobs by identifier');
      return [];
    }
  }

  /**
   * Remove old completed or failed jobs
   */
  async cleanupJobs(olderThan: Date): Promise<number> {
    try {
      const deleted = await this.syncJobRepo.deleteOld(olderThan);
      logger.info({ deleted, olderThan }, 'Old jobs cleaned up');
      return deleted;
    } catch (error) {
      logger.error({ error, olderThan }, 'Failed to cleanup old jobs');
      return 0;
    }
  }
}