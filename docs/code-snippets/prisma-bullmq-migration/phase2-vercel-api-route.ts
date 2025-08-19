// Phase 2: Vercel Frontend API Route
// This runs on Vercel and calls the Railway backend
// Returns immediately to avoid 10-second timeout

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateJWT } from '@/lib/auth/jwt';

// Validation schema
const SyncRequestSchema = z.object({
  walletAddress: z.string().min(1),
  syncType: z.enum(['full', 'incremental']).default('incremental')
});

/**
 * POST /api/sync
 * Trigger wallet sync by calling Railway backend
 * Returns immediately with job ID (no timeout issues!)
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const decoded = await validateJWT(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // 2. Validate request
    const body = await request.json();
    const { walletAddress, syncType } = SyncRequestSchema.parse(body);
    
    // 3. Call Railway API to create job (returns immediately)
    const railwayResponse = await fetch(`${process.env.RAILWAY_API_URL}/api/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.RAILWAY_API_KEY!,
        'Authorization': `Bearer ${token}` // Forward auth token
      },
      body: JSON.stringify({
        type: 'wallet_sync',
        data: {
          walletAddress,
          userId: decoded.userId,
          syncType
        }
      })
    });
    
    if (!railwayResponse.ok) {
      const error = await railwayResponse.json();
      throw new Error(error.error || 'Failed to create sync job');
    }
    
    const { jobId, status } = await railwayResponse.json();
    
    // 4. Return job ID immediately (< 1 second total time)
    return NextResponse.json({
      success: true,
      jobId,
      status,
      message: 'Sync job queued successfully',
      checkStatusUrl: `/api/sync/status?jobId=${jobId}`
    });
    
  } catch (error) {
    console.error('Sync API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync/status
 * Check sync job status by calling Railway backend
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const decoded = await validateJWT(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // 2. Get job ID from query params
    const jobId = request.nextUrl.searchParams.get('jobId');
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }
    
    // 3. Call Railway API to check status
    const railwayResponse = await fetch(`${process.env.RAILWAY_API_URL}/api/jobs/${jobId}`, {
      headers: {
        'X-API-Key': process.env.RAILWAY_API_KEY!,
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!railwayResponse.ok) {
      if (railwayResponse.status === 404) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      const error = await railwayResponse.json();
      throw new Error(error.error || 'Failed to get job status');
    }
    
    const jobData = await railwayResponse.json();
    
    // 4. Return job status
    return NextResponse.json(jobData);
    
  } catch (error) {
    console.error('Status API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Frontend usage example:
// const response = await fetch('/api/sync', {
//   method: 'POST',
//   headers: { 'Authorization': `Bearer ${token}` },
//   body: JSON.stringify({ walletAddress: 'addr1...' })
// });
// const { jobId } = await response.json();
// 
// // Poll for status or use WebSocket for real-time updates
// const statusResponse = await fetch(`/api/sync/status?jobId=${jobId}`);
// const { status, progress } = await statusResponse.json();