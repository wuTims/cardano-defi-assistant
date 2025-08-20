// /**
//  * POST /api/wallet/sync
//  * 
//  * Queue a sync job for the authenticated wallet.
//  * Returns immediately with job status instead of blocking.
//  * 
//  * This endpoint:
//  * - Checks for existing pending/processing jobs
//  * - Creates a new job in the queue
//  * - Returns the job ID and status
//  * - The actual sync is processed by a background worker
//  */

// import { NextResponse } from 'next/server';
// import { withAuth } from '@/utils/auth-wrapper';
// import { logger } from '@/lib/logger';
// import { ServiceFactory } from '@/services/service-factory';
// import { serialize } from '@/lib/prisma';
// import type { IQueueService } from '@/core/interfaces/services';

// interface SyncResponse {
//   success: boolean;
//   jobId?: string;
//   status?: string;
//   message?: string;
//   error?: string;
//   cachedData?: any;
// }

// export const POST = withAuth(async (request, { walletAddress, userId }) => {
//   try {
//     if (!userId || !walletAddress) {
//       return NextResponse.json(
//         { error: 'Invalid authentication token - missing required data' },
//         { status: 401 }
//       );
//     }
    
//     logger.info(`Sync requested for wallet ${walletAddress.slice(0, 12)}...`);
    
//     // TODO: Reimplement with BullMQ
//     return NextResponse.json({
//       success: false,
//       message: 'Sync functionality temporarily disabled - will be reimplemented with BullMQ'
//     });
//   } catch (error) {
//     logger.error({ err: error }, 'Error creating sync job');
//     const errorMessage = error instanceof Error ? error.message : 'Failed to queue sync';
    
//     return NextResponse.json(
//       { 
//         success: false,
//         error: errorMessage 
//       },
//       { status: 500 }
//     );
//   }
// });
//     /* COMMENTED OUT - Will reimplement with BullMQ
//     // Get queue service
//     const queueService = ServiceFactory.getQueueService();
    
//     // Check for existing pending or processing jobs for this wallet
//     const existingJobs = await queueService.getJobsByWallet(walletAddress);
//     const activeJob = existingJobs.find(
//       job => job.status === 'pending' || job.status === 'processing'
//     );
    
//     if (activeJob) {
//       logger.info(`Sync already queued/processing for wallet ${walletAddress.slice(0, 12)}...`);
      
//       // Return existing job status
//       const response: SyncResponse = {
//         success: true,
//         jobId: activeJob.id,
//         status: activeJob.status,
//         message: `Sync job already ${activeJob.status}`
//       };
      
//       return NextResponse.json(response);
//     }
    
//     // Get last sync info from wallet repository
//     const walletRepo = ServiceFactory.getWalletRepository();
//     const wallet = await walletRepo.findByAddressAndUser(walletAddress, userId);
    
//     // Determine sync type and starting block
//     const lastSyncedBlock = wallet?.syncedBlockHeight || 0;
//     const syncType = lastSyncedBlock > 0 ? 'incremental_sync' : 'full_sync';
    
//     logger.info(`Creating ${syncType} sync job from block ${lastSyncedBlock} for wallet ${walletAddress.slice(0, 12)}...`);
    
//     // Create sync job data
//     const jobData = {
//       walletAddress,
//       userId,
//       syncType,
//       fromBlock: lastSyncedBlock
//     };
    
//     // Add job to queue with normal priority
//     const job = await queueService.add('wallet_sync', jobData, {
//       priority: 5,
//       maxRetries: 3,
//       metadata: {
//         requestedAt: new Date().toISOString(),
//         userAgent: request.headers.get('user-agent')
//       }
//     });
    
//     logger.info(`Sync job ${job.id} created for wallet ${walletAddress.slice(0, 12)}...`);
    
//     // Get cached wallet data to return immediately
//     const walletCache = ServiceFactory.getWalletCache();
//     const walletCacheKey = ServiceFactory.cacheKey.wallet(walletAddress);
//     const cachedWalletData = await walletCache.get(walletCacheKey);
    
//     // Return job info and cached data
//     const response: SyncResponse = {
//       success: true,
//       jobId: job.id,
//       status: job.status,
//       message: 'Sync job queued successfully',
//       cachedData: cachedWalletData
//     };
    
//     return NextResponse.json(response);
    
//   } catch (error) {
//     logger.error({ err: error }, 'Error creating sync job');
//     const errorMessage = error instanceof Error ? error.message : 'Failed to queue sync';
    
//     return NextResponse.json(
//       { 
//         success: false,
//         error: errorMessage 
//       },
//       { status: 500 }
//     );
//   }
// });
// */

// /**
//  * GET /api/wallet/sync
//  * 
//  * Check the status of a sync job.
//  * Requires jobId as query parameter.
//  */
// export const GET = withAuth(async (request, { walletAddress, userId }) => {
//   // try {
//   //   const searchParams = request.nextUrl.searchParams;
//   //   const jobId = searchParams.get('jobId');
    
//   //   if (!jobId) {
//   //     // Get all jobs for this wallet
//   //     const queueService = ServiceFactory.getQueueService();
//   //     const jobs = await queueService.getJobsByWallet(walletAddress);
      
//   //     return NextResponse.json({
//   //       success: true,
//   //       jobs: jobs.map(job => ({
//   //         id: job.id,
//   //         status: job.status,
//   //         createdAt: job.createdAt,
//   //         completedAt: job.completedAt,
//   //         error: job.error
//   //       }))
//   //     });
//   //   }
    
//   //   // Get specific job status
//   //   const queueService = ServiceFactory.getQueueService();
//   //   const job = await queueService.getJob(jobId);
    
//   //   if (!job) {
//   //     return NextResponse.json(
//   //       { error: 'Job not found' },
//   //       { status: 404 }
//   //     );
//   //   }
    
//   //   // Verify job belongs to this user
//   //   const jobData = job.data as WalletSyncJobData;
//   //   if (jobData.walletAddress !== walletAddress || jobData.userId !== userId) {
//   //     return NextResponse.json(
//   //       { error: 'Unauthorized' },
//   //       { status: 403 }
//   //     );
//   //   }
    
//   //   return NextResponse.json({
//   //     success: true,
//   //     job: {
//   //       id: job.id,
//   //       status: job.status,
//   //       progress: job.metadata?.progress || null,
//   //       createdAt: job.createdAt,
//   //       startedAt: job.startedAt,
//   //       completedAt: job.completedAt,
//   //       error: job.error,
//   //       retryCount: job.retryCount
//   //     }
//   //   });
    
//   // } catch (error) {
//   //   logger.error({ err: error }, 'Error checking sync status');
//   //   return NextResponse.json(
//   //     { error: 'Failed to check sync status' },
//   //     { status: 500 }
//   //   );
//   // }
// });