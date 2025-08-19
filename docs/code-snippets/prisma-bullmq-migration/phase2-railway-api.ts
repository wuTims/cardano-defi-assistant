// Phase 2: Railway Backend API
// Express server running on Railway to handle job creation and status checks
// Frontend on Vercel calls this API to trigger sync jobs

import express from 'express';
import { z } from 'zod';
import { SupabaseQueueService } from '@/services/queue/supabase-queue-service';
import { OptimizedSyncWorker } from './phase2-optimized-sync-worker';
import { authenticateRequest } from '@/lib/auth/middleware';

const app = express();
app.use(express.json());

// Initialize services
const queueService = new SupabaseQueueService();
const syncWorker = new OptimizedSyncWorker(process.env.BLOCKFROST_KEY!);

// Request validation schemas
const CreateJobSchema = z.object({
  type: z.enum(['wallet_sync', 'transaction_sync', 'full_sync']),
  data: z.object({
    walletAddress: z.string(),
    userId: z.string(),
    fromBlock: z.number().optional()
  })
});

const JobStatusSchema = z.object({
  jobId: z.string().uuid()
});

/**
 * POST /api/jobs
 * Create a new sync job
 * Called by Vercel frontend, returns immediately with job ID
 */
app.post('/api/jobs', authenticateRequest, async (req, res) => {
  try {
    // Validate request
    const { type, data } = CreateJobSchema.parse(req.body);
    
    // Create job in queue (returns immediately)
    const job = await queueService.add(type, data, {
      priority: 1,
      metadata: { 
        createdBy: req.user.id,
        createdAt: new Date().toISOString()
      }
    });
    
    // Return job ID immediately (< 1 second response time)
    res.json({
      success: true,
      jobId: job.id,
      status: 'queued',
      message: 'Job queued for processing'
    });
    
  } catch (error) {
    console.error('Failed to create job:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request'
    });
  }
});

/**
 * GET /api/jobs/:jobId
 * Check job status
 * Returns current status and progress
 */
app.get('/api/jobs/:jobId', authenticateRequest, async (req, res) => {
  try {
    const { jobId } = JobStatusSchema.parse({ jobId: req.params.jobId });
    
    // Get job status from queue
    const job = await queueService.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }
    
    // Check if user owns this job
    if (job.data.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    res.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        progress: job.metadata?.progress || null,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error
      }
    });
    
  } catch (error) {
    console.error('Failed to get job status:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request'
    });
  }
});

/**
 * GET /api/jobs
 * List all jobs for the authenticated user
 */
app.get('/api/jobs', authenticateRequest, async (req, res) => {
  try {
    const walletAddress = req.query.walletAddress as string;
    
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address required'
      });
    }
    
    // Get jobs for this wallet
    const jobs = await queueService.getJobsByWallet(walletAddress);
    
    // Filter to only user's jobs
    const userJobs = jobs.filter(job => job.data.userId === req.user.id);
    
    res.json({
      success: true,
      jobs: userJobs.map(job => ({
        id: job.id,
        type: job.type,
        status: job.status,
        createdAt: job.createdAt,
        completedAt: job.completedAt
      }))
    });
    
  } catch (error) {
    console.error('Failed to list jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve jobs'
    });
  }
});

/**
 * POST /api/jobs/:jobId/cancel
 * Cancel a pending or processing job
 */
app.post('/api/jobs/:jobId/cancel', authenticateRequest, async (req, res) => {
  try {
    const { jobId } = JobStatusSchema.parse({ jobId: req.params.jobId });
    
    // Get job to verify ownership
    const job = await queueService.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }
    
    if (job.data.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    // Cancel the job
    await queueService.cancel(jobId);
    
    res.json({
      success: true,
      message: 'Job cancelled successfully'
    });
    
  } catch (error) {
    console.error('Failed to cancel job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel job'
    });
  }
});

/**
 * GET /health
 * Health check endpoint for Railway
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Railway API server running on port ${PORT}`);
});

// Start the sync worker in background
syncWorker.start().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  syncWorker.stop();
  process.exit(0);
});

export default app;