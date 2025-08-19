// Phase 3: BullMQ Queue Service
// Replaces SupabaseQueueService with proper message queue
// Adds retry logic, dead letter queues, and real-time updates

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import type { IQueueService, QueueJob, QueueOptions, WalletSyncJobData } from '@/services/interfaces/queue-service';

// Redis connection for BullMQ
const connection = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

export class BullMQQueueService implements IQueueService {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private events: Map<string, QueueEvents> = new Map();
  
  constructor() {
    // Initialize default queues
    this.initQueue('wallet_sync');
    this.initQueue('transaction_sync');
    this.initQueue('price_update');
  }
  
  /**
   * Initialize a queue with its worker and event listener
   */
  private initQueue(queueName: string): void {
    // Create queue
    const queue = new Queue(queueName, {
      connection,
      defaultJobOptions: {
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100 // Keep last 100 completed jobs
        },
        removeOnFail: {
          age: 24 * 3600, // Keep failed jobs for 24 hours
          count: 500 // Keep last 500 failed jobs
        },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000 // Start with 2 second delay
        }
      }
    });
    
    this.queues.set(queueName, queue);
    
    // Create event listener for real-time updates
    const queueEvents = new QueueEvents(queueName, { connection });
    this.events.set(queueName, queueEvents);
    
    // Set up event handlers
    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      console.log(`Job ${jobId} completed with result:`, returnvalue);
      // Emit WebSocket event for real-time UI updates
      this.emitJobUpdate(jobId, 'completed', returnvalue);
    });
    
    queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`Job ${jobId} failed:`, failedReason);
      // Emit WebSocket event for real-time UI updates
      this.emitJobUpdate(jobId, 'failed', { error: failedReason });
    });
    
    queueEvents.on('progress', ({ jobId, data }) => {
      console.log(`Job ${jobId} progress:`, data);
      // Emit WebSocket event for real-time progress updates
      this.emitJobUpdate(jobId, 'progress', data);
    });
  }
  
  /**
   * Add a job to the queue
   */
  async add<T>(type: string, data: T, options?: QueueOptions): Promise<QueueJob<T>> {
    const queue = this.queues.get(type);
    if (!queue) {
      throw new Error(`Queue ${type} not initialized`);
    }
    
    // Add job to BullMQ
    const job = await queue.add(type, data, {
      priority: options?.priority || 0,
      delay: options?.delay,
      attempts: options?.maxRetries || 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      ...(options?.metadata && { data: { ...data, metadata: options.metadata } })
    });
    
    // Map to QueueJob interface
    return this.mapToQueueJob<T>(job);
  }
  
  /**
   * Get the next job from the queue (for manual processing)
   */
  async getNext(type?: string): Promise<QueueJob | null> {
    const queueName = type || 'wallet_sync';
    const queue = this.queues.get(queueName);
    if (!queue) return null;
    
    // Get next job from queue
    const jobs = await queue.getWaiting(0, 0);
    if (jobs.length === 0) return null;
    
    const job = jobs[0];
    
    // Move to active state
    await job.moveToActive();
    
    return this.mapToQueueJob(job);
  }
  
  /**
   * Mark a job as completed
   */
  async complete(jobId: string, result?: any): Promise<void> {
    // Find job across all queues
    const job = await this.findJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    
    // Complete the job
    await job.moveToCompleted(result, true);
  }
  
  /**
   * Mark a job as failed
   */
  async fail(jobId: string, error: string): Promise<void> {
    const job = await this.findJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    
    // Fail the job
    await job.moveToFailed(new Error(error), true);
  }
  
  /**
   * Get job by ID
   */
  async getJob<T>(jobId: string): Promise<QueueJob<T> | null> {
    const job = await this.findJob(jobId);
    if (!job) return null;
    
    return this.mapToQueueJob<T>(job);
  }
  
  /**
   * Get all jobs for a specific wallet
   */
  async getJobsByWallet(walletAddress: string): Promise<QueueJob[]> {
    const allJobs: QueueJob[] = [];
    
    // Search across all queues
    for (const [queueName, queue] of this.queues) {
      const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed']);
      
      const walletJobs = jobs
        .filter(job => {
          const data = job.data as WalletSyncJobData;
          return data.walletAddress === walletAddress;
        })
        .map(job => this.mapToQueueJob(job));
      
      allJobs.push(...walletJobs);
    }
    
    // Sort by creation time
    return allJobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  /**
   * Cancel a job
   */
  async cancel(jobId: string): Promise<void> {
    const job = await this.findJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    
    // Remove the job
    await job.remove();
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
    let stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };
    
    for (const queue of this.queues.values()) {
      const counts = await queue.getJobCounts();
      stats.pending += counts.waiting + counts.delayed;
      stats.processing += counts.active;
      stats.completed += counts.completed;
      stats.failed += counts.failed;
    }
    
    return stats;
  }
  
  /**
   * Clean up old jobs
   */
  async cleanup(olderThan: Date): Promise<number> {
    let cleaned = 0;
    
    for (const queue of this.queues.values()) {
      // Clean completed jobs
      const completedJobs = await queue.clean(
        1000, // Grace period
        10000, // Limit
        'completed'
      );
      
      // Clean failed jobs
      const failedJobs = await queue.clean(
        1000,
        10000,
        'failed'
      );
      
      cleaned += completedJobs.length + failedJobs.length;
    }
    
    return cleaned;
  }
  
  /**
   * Create a worker to process jobs
   */
  createWorker(queueName: string, processor: (job: Job) => Promise<any>): Worker {
    const worker = new Worker(queueName, processor, {
      connection,
      concurrency: 5, // Process 5 jobs concurrently
      limiter: {
        max: 10,
        duration: 1000 // Max 10 jobs per second
      }
    });
    
    this.workers.set(queueName, worker);
    
    // Error handling
    worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err);
    });
    
    worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed`);
    });
    
    return worker;
  }
  
  /**
   * Find a job across all queues
   */
  private async findJob(jobId: string): Promise<Job | null> {
    for (const queue of this.queues.values()) {
      const job = await queue.getJob(jobId);
      if (job) return job;
    }
    return null;
  }
  
  /**
   * Map BullMQ job to QueueJob interface
   */
  private mapToQueueJob<T = any>(job: Job): QueueJob<T> {
    const state = job.failedReason ? 'failed' 
      : job.finishedOn ? 'completed'
      : job.processedOn ? 'processing'
      : 'pending';
    
    return {
      id: job.id!,
      type: job.name,
      data: job.data as T,
      status: state as any,
      priority: job.opts.priority || 0,
      createdAt: new Date(job.timestamp),
      startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
      error: job.failedReason,
      retryCount: job.attemptsMade,
      maxRetries: job.opts.attempts || 3,
      metadata: job.data.metadata
    };
  }
  
  /**
   * Emit job update via WebSocket (to be implemented)
   */
  private emitJobUpdate(jobId: string, event: string, data: any): void {
    // This would emit to connected WebSocket clients
    // Implementation depends on your WebSocket setup
    console.log(`WebSocket emit: job.${event}`, { jobId, data });
  }
  
  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    // Close all workers
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    
    // Close all queues
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    
    // Close all event listeners
    for (const events of this.events.values()) {
      await events.close();
    }
    
    // Close Redis connection
    await connection.quit();
  }
}