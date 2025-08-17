/**
 * Worker Control API
 * 
 * Manages the background sync worker
 */

import { NextResponse } from 'next/server';
import { SyncWorker } from '@/workers/sync-worker';
import { logger } from '@/lib/logger';

// Store worker instance (in production, use a proper process manager)
let worker: SyncWorker | null = null;

/**
 * GET /api/worker
 * Check worker status
 */
export async function GET() {
  return NextResponse.json({
    status: worker ? 'running' : 'stopped',
    message: 'Worker status retrieved'
  });
}

/**
 * POST /api/worker
 * Start the worker
 */
export async function POST() {
  try {
    if (worker) {
      return NextResponse.json({
        status: 'already_running',
        message: 'Worker is already running'
      });
    }
    
    // Create and start worker
    worker = new SyncWorker();
    
    // Start in background (non-blocking)
    worker.start().catch(error => {
      logger.error({ err: error }, 'Worker crashed');
      worker = null;
    });
    
    return NextResponse.json({
      status: 'started',
      message: 'Worker started successfully'
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start worker');
    return NextResponse.json(
      { 
        status: 'error',
        error: 'Failed to start worker' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/worker
 * Stop the worker
 */
export async function DELETE() {
  if (!worker) {
    return NextResponse.json({
      status: 'not_running',
      message: 'Worker is not running'
    });
  }
  
  worker.stop();
  worker = null;
  
  return NextResponse.json({
    status: 'stopped',
    message: 'Worker stopped successfully'
  });
}