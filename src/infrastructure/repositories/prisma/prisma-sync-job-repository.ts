/**
 * Prisma Sync Job Repository
 * 
 * Domain-focused repository for wallet synchronization jobs.
 * Implements ISyncJobRepository interface for sync-specific operations.
 * 
 * Follows DDD: This is domain-specific, focused on sync job lifecycle.
 * Infrastructure: Uses Prisma for persistence, but abstracts database details.
 */

import type { PrismaClient, SyncJob } from '@prisma/client';
import type { ISyncJobRepository } from '@/core/interfaces/repositories';
import type { CreateJobData, JobFilters, JobStatus } from '@/core/types/database';
import { logger } from '@/lib/logger';
import { toJsonValue } from '@/lib/prisma';

export class PrismaSyncJobRepository implements ISyncJobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new sync job
   */
  async create(data: CreateJobData): Promise<SyncJob> {
    try {
      return await this.prisma.syncJob.create({
        data: {
          walletAddress: data.walletAddress,
          userId: data.userId || null,
          jobType: data.jobType,
          status: 'pending',
          priority: data.priority || 5,
          retryCount: 0,
          metadata: toJsonValue(data.metadata),
        }
      });
    } catch (error) {
      logger.error({ error, data }, 'Failed to create sync job');
      throw error;
    }
  }

  /**
   * Find sync job by ID
   */
  async findById(id: string): Promise<SyncJob | null> {
    try {
      return await this.prisma.syncJob.findUnique({
        where: { id }
      });
    } catch (error) {
      logger.error({ error, id }, 'Failed to find sync job by ID');
      throw error;
    }
  }

  /**
   * Find all sync jobs for a specific wallet
   */
  async findByWallet(
    walletAddress: string,
    filters?: JobFilters
  ): Promise<SyncJob[]> {
    try {
      return await this.prisma.syncJob.findMany({
        where: {
          walletAddress,
          ...(filters?.status && { status: filters.status }),
          ...(filters?.userId && { userId: filters.userId }),
          ...(filters?.jobType && { jobType: filters.jobType }),
        },
        take: filters?.limit || 100,
        skip: filters?.offset || 0,
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      logger.error({ error, walletAddress, filters }, 'Failed to find sync jobs by wallet');
      throw error;
    }
  }

  /**
   * Find pending sync jobs (ready to be processed)
   */
  async findPending(limit?: number): Promise<SyncJob[]> {
    try {
      return await this.prisma.syncJob.findMany({
        where: { status: 'pending' },
        take: limit || 50,
        orderBy: [
          { priority: 'desc' },  // Higher priority first
          { createdAt: 'asc' }   // Older jobs first (FIFO)
        ]
      });
    } catch (error) {
      logger.error({ error, limit }, 'Failed to find pending sync jobs');
      throw error;
    }
  }

  /**
   * Find currently active sync jobs (processing)
   */
  async findActive(): Promise<SyncJob[]> {
    try {
      return await this.prisma.syncJob.findMany({
        where: { status: 'processing' },
        orderBy: { startedAt: 'asc' }
      });
    } catch (error) {
      logger.error({ error }, 'Failed to find active sync jobs');
      throw error;
    }
  }

  /**
   * Update sync job status and related data
   */
  async updateStatus(
    id: string,
    status: JobStatus,
    data?: {
      startedAt?: Date;
      completedAt?: Date;
      error?: string;
      result?: any;
      metadata?: any;
    }
  ): Promise<SyncJob> {
    try {
      return await this.prisma.syncJob.update({
        where: { id },
        data: {
          status,
          startedAt: data?.startedAt,
          completedAt: data?.completedAt,
          errorMessage: data?.error,
          metadata: toJsonValue(data?.metadata),
        }
      });
    } catch (error) {
      logger.error({ error, id, status, data }, 'Failed to update sync job status');
      throw error;
    }
  }

  /**
   * Update job progress (for long-running syncs)
   */
  async updateProgress(
    id: string,
    progress: number,
    message?: string
  ): Promise<void> {
    try {
      await this.prisma.syncJob.update({
        where: { id },
        data: {
          metadata: toJsonValue({
            progress: Math.min(100, Math.max(0, progress)),
            progressMessage: message,
            lastUpdated: new Date().toISOString(),
          })
        }
      });
    } catch (error) {
      logger.error({ error, id, progress, message }, 'Failed to update sync job progress');
      throw error;
    }
  }

  /**
   * Retry a failed sync job
   */
  async retry(id: string): Promise<SyncJob> {
    try {
      return await this.prisma.syncJob.update({
        where: { id },
        data: {
          status: 'pending',
          errorMessage: null,
          retryCount: { increment: 1 }
        }
      });
    } catch (error) {
      logger.error({ error, id }, 'Failed to retry sync job');
      throw error;
    }
  }

  /**
   * Cancel a sync job
   */
  async cancel(id: string): Promise<boolean> {
    try {
      const job = await this.prisma.syncJob.update({
        where: { id },
        data: {
          status: 'cancelled',
          completedAt: new Date(),
          errorMessage: 'Job cancelled by user'
        }
      });
      return job.status === 'cancelled';
    } catch (error) {
      logger.error({ error, id }, 'Failed to cancel sync job');
      return false;
    }
  }

  /**
   * Delete old completed/failed sync jobs
   */
  async deleteOld(olderThan: Date): Promise<number> {
    try {
      const result = await this.prisma.syncJob.deleteMany({
        where: {
          createdAt: { lt: olderThan },
          status: { in: ['completed', 'failed', 'cancelled'] }
        }
      });
      
      logger.info({ deletedCount: result.count, olderThan }, 'Deleted old sync jobs');
      return result.count;
    } catch (error) {
      logger.error({ error, olderThan }, 'Failed to delete old sync jobs');
      throw error;
    }
  }
}