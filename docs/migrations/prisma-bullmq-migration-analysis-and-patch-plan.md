# Prisma + BullMQ Migration — Analysis and Patch Plan
Version: 1.0.0
Date: 2025-08-19
Status: Proposal

## Executive Summary
- The three-phase plan (Prisma → Railway → BullMQ/Redis) aligns with industry-standard designs used by portfolio apps such as Zerion, Zapper, and CoinTracker.
- Key surgical changes recommended now:
  - Adopt hybrid authorization: RLS via Supabase for direct user flows; Prisma with strict app-layer scoping (`userId`) for workers/heavy ops.
  - Tighten `Transaction` uniqueness to per-wallet perspective and add query indexes for analytics.
  - Introduce a small `portfolio_holdings_snapshots` model for fast holdings graphs.
  - Add a feature flag to flip the queue backend (Supabase → Prisma → BullMQ).
  - Implement a shared token-bucket rate limiter for Blockfrost (10 rps sustained, 500 burst).
- With these, 1,000-wallet scale is comfortably supported on a single Postgres + Redis + a few workers.

## Current State (What’s in repo)
- Prisma schema present with core models (`User`, `Wallet`, `Transaction`, `Action`, `AssetFlow`, `Token`, `AuthChallenge`, `SyncJob`).
- Prisma repositories for Transactions and Sync Jobs.
- Queue is currently Supabase-backed; workers and API routes use Supabase tables/RPC.
- Vercel timeout constraints identified; Railway planned for long-running workers.

## Security: RLS + Prisma (Hybrid)
- Keep: Supabase client with RLS for user-facing, simple CRUD.
- Use: Prisma with service role for workers/heavy ops, but enforce authorization in application code:
  - Centralize DB access in repositories; every method requires `userId` and scopes queries by it.
  - Tests ensure unauthorized access returns empty/null.
  - Never accept `userId` from client; derive from verified JWT on server.
- Why not RLS with Prisma directly? Requires session GUCs and careful transaction/pool management, adding complexity without proportional benefit at this scale.

## Schema: Per-Wallet Transactions, Indexes, Snapshots
- Per-wallet uniqueness: Many on-chain txs touch multiple addresses; for correct wallet-perspective flows and balances, store per-wallet transaction records.
  - Change: `@@unique([userId, walletAddress, txHash])`.
- Query indexes: Common analytics filters should be indexed:
  - Add: `@@index([userId, txAction])`, `@@index([userId, txProtocol])`.
  - Queue scan: Add `@@index([status, priority, scheduledAt])` to `SyncJob`.
- Holdings snapshots: Add a small model for holdings graphs and fast dashboard loads:
  - `PortfolioHoldingsSnapshot(userId, walletAddress, asOf, tokenUnit, quantity, value)`.
  - Written post-sync; latest snapshot used for the dashboard; historical snapshots for charts.

## Rate Limiting: Blockfrost (Free Plan)
- Limits: 10 rps sustained; 500 burst; refill at 10/sec.
- Implement a shared token-bucket limiter:
  - Capacity=500, refill=10/sec; default concurrency 6–10.
  - Remove ad-hoc sleeps; rely on limiter.
  - Cache token metadata and other static data to reduce calls.
  - Make tunable via env: `BLOCKFROST_RPS=10`, `BLOCKFROST_BURST=500`, `SYNC_CONCURRENCY=8`.

## Queue Transition and Real-Time
- Queue cutover:
  - Keep Supabase queue initially; add `USE_PRISMA_QUEUE` to flip to a Prisma-backed `IQueueService` once Railway is ready.
  - Later (Phase 3), replace with BullMQ (`USE_BULLMQ=true`).
- Real-time:
  - Railway hosts WebSockets.
  - Publish job progress and completion; on completion, update snapshots, invalidate caches, broadcast `wallet_updated`.

## Industry Examples and Justification
- Zerion/Zapper/DeBank:
  - Event-first storage; derived state computed asynchronously; Redis for hot state; WS for UX.
  - Aggregates (holdings, valuation) cached and refreshed on new events.
- CoinTracker/Koinly:
  - Transaction normalization + cost-basis lots (FIFO/LIFO) computed in background; reporting against materialized aggregates.
- Rotki (open-source):
  - Local-first but same core idea: deterministic event storage and derived computations.
- Our plan mirrors these patterns at the right level of simplicity for 1k wallets.

---

## Proposed Patches (Diff Previews)

These are patch previews to guide implementation. They are not yet applied.

### 1) Prisma schema (per-wallet uniqueness, indexes, snapshots)
Diff against `prisma/schema.prisma`:

```diff
@@
 model Transaction {
   id              String   @id @default(uuid()) @db.Uuid
   userId          String   @map("user_id") @db.Uuid
   walletAddress   String   @map("wallet_address")
   txHash          String   @map("tx_hash")
   blockHeight     Int      @map("block_height")
   txTimestamp     DateTime @map("tx_timestamp")
   txAction        String   @map("tx_action")
   txProtocol      String?  @map("tx_protocol")
   description     String?
   netAdaChange    BigInt   @map("net_ada_change")
   fees            BigInt
   actionId        String?  @map("action_id") @db.Uuid
   sequenceNumber  Int?     @map("sequence_number")
   metadata        Json?
   createdAt       DateTime @default(now()) @map("created_at")
@@
-  @@unique([userId, txHash])
+  @@unique([userId, walletAddress, txHash])
   @@index([walletAddress, blockHeight])
   @@index([userId, txTimestamp])
   @@index([txHash])
   @@index([actionId, sequenceNumber])
+  @@index([userId, txAction])
+  @@index([userId, txProtocol])
   @@map("transactions")
   @@schema("public")
 }
@@
 model SyncJob {
@@
   @@index([status, scheduledAt])
   @@index([walletAddress])
   @@index([userId])
+  @@index([status, priority, scheduledAt])
   @@map("sync_jobs")
   @@schema("public")
 }
+
+// Portfolio holdings snapshots for fast graphs
+model PortfolioHoldingsSnapshot {
+  id            String   @id @default(uuid()) @db.Uuid
+  userId        String   @map("user_id") @db.Uuid
+  walletAddress String   @map("wallet_address")
+  asOf          DateTime @map("as_of")
+  tokenUnit     String   @map("token_unit")
+  quantity      Decimal  @map("quantity")
+  value         Decimal? @map("value")
+  createdAt     DateTime @default(now()) @map("created_at")
+
+  @@index([userId, walletAddress, asOf])
+  @@index([userId, tokenUnit, asOf])
+  @@map("portfolio_holdings_snapshots")
+  @@schema("public")
+}
```

### 2) Feature flag to switch queue backend
Diff against `src/services/service-factory.ts`:

```diff
@@
 import { InMemoryCache } from './cache/in-memory-cache';
 import { SupabaseQueueService } from './queue/supabase-queue-service';
+import { PrismaQueueService } from './queue/prisma-queue-service';
@@
   static getQueueService(): IQueueService {
     if (!this.instances.queue) {
-      logger.info('Initializing SupabaseQueueService singleton');
-      this.instances.queue = new SupabaseQueueService();
+      const usePrismaQueue = process.env.USE_PRISMA_QUEUE === 'true';
+      if (usePrismaQueue) {
+        logger.info('Initializing PrismaQueueService singleton');
+        this.instances.queue = new PrismaQueueService();
+      } else {
+        logger.info('Initializing SupabaseQueueService singleton');
+        this.instances.queue = new SupabaseQueueService();
+      }
     }
     return this.instances.queue;
   }
```

### 3) New Prisma-backed queue service (temporary until BullMQ)
New file `src/services/queue/prisma-queue-service.ts` implementing `IQueueService` via `PrismaQueueRepository`:

```ts
import type { IQueueService, QueueJob, QueueOptions } from '@/services/interfaces/queue-service';
import type { SyncJob } from '@prisma/client';
import { PrismaQueueRepository } from '@/repositories/prisma-queue-repository';

export class PrismaQueueService implements IQueueService {
  private repo = new PrismaQueueRepository();

  async add<T>(type: string, data: T, options: QueueOptions = {}): Promise<QueueJob<T>> {
    const job = await this.repo.createJob(
      (data as any).walletAddress || '',
      (data as any).userId || null,
      type,
      options.priority ?? 0,
      { ...options.metadata, data }
    );
    return this.map(job);
  }

  async getNext(type?: string): Promise<QueueJob | null> {
    const job = await this.repo.getNextJob(type);
    return job ? this.map(job) : null;
  }

  async complete(jobId: string, result?: any): Promise<void> {
    await this.repo.completeJob(jobId, result?.lastBlock ?? undefined);
  }

  async fail(jobId: string, error: string): Promise<void> {
    await this.repo.failJob(jobId, error);
  }

  async getJob<T>(jobId: string): Promise<QueueJob<T> | null> {
    const job = await this.repo.getJob(jobId);
    return job ? this.map(job) : null;
  }

  async getJobsByWallet(walletAddress: string): Promise<QueueJob[]> {
    const jobs = await this.repo.getJobsByWallet(walletAddress, 10);
    return jobs.map(j => this.map(j));
  }

  async cancel(jobId: string): Promise<void> {
    await this.repo.cancelJob(jobId);
  }

  async getStats(): Promise<{ pending: number; processing: number; completed: number; failed: number; }> {
    return this.repo.getStats();
  }

  async cleanup(olderThan: Date): Promise<number> {
    const days = Math.max(1, Math.floor((Date.now() - olderThan.getTime()) / (24 * 60 * 60 * 1000)));
    return this.repo.cleanupOldJobs(days);
  }

  private map<T = any>(j: SyncJob): QueueJob<T> {
    const metadata = j.metadata as any;
    const data = (metadata?.data ?? {
      walletAddress: j.walletAddress,
      userId: j.userId,
      syncType: j.jobType
    }) as T;
    return {
      id: j.id,
      type: j.jobType,
      data,
      status: j.status as any,
      priority: j.priority,
      createdAt: j.createdAt,
      startedAt: j.startedAt ?? undefined,
      completedAt: j.completedAt ?? undefined,
      error: j.errorMessage ?? undefined,
      retryCount: j.retryCount,
      maxRetries: j.maxRetries,
      metadata: metadata ?? undefined
    };
  }
}
```

### 4) Rate limiter helper (token bucket)
New file `src/lib/rate-limiter.ts`:

```ts
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  constructor(private capacity: number, private refillPerSecond: number) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }
  private refill() {
    const now = Date.now();
    const delta = (now - this.lastRefill) / 1000;
    if (delta > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + delta * this.refillPerSecond);
      this.lastRefill = now;
    }
  }
  async take(n = 1): Promise<void> {
    for (;;) {
      this.refill();
      if (this.tokens >= n) {
        this.tokens -= n;
        return;
      }
      const needed = n - this.tokens;
      const waitMs = Math.ceil((needed / this.refillPerSecond) * 1000);
      await new Promise(r => setTimeout(r, Math.max(50, waitMs)));
    }
  }
}
```

---

## Additional Patch Previews (to assist implementation)

### A) Wire rate limiter into the sync worker (replace ad-hoc sleeps)
Diff against `src/workers/sync-worker.ts` (key excerpts):

```diff
@@
 import { BlockfrostService } from '@/services/blockchain/blockfrost-service';
+import { TokenBucket } from '@/lib/rate-limiter';
@@
 export class SyncWorker {
@@
   private parser: WalletTransactionParser;
   private repos: ReturnType<typeof createRepositories>;
   private supabase: any;
+  private limiter: TokenBucket;
@@
   constructor() {
@@
     this.parser = new WalletTransactionParser(
       walletFilter,
       walletFilter,
       categorizer,
       tokenRegistry,
       tokenCache
     );
+    // Shared Blockfrost limiter (burst 500, refill 10/sec)
+    const burst = Number(process.env.BLOCKFROST_BURST ?? 500);
+    const rps = Number(process.env.BLOCKFROST_RPS ?? 10);
+    this.limiter = new TokenBucket(burst, rps);
   }
@@
       for (const hash of txHashes) {
         try {
-          // Fetch full transaction details
+          // Respect Blockfrost limits
+          await this.limiter.take(1);
+          // Fetch full transaction details
           const rawTx = await this.blockfrost.fetchTransactionDetails(hash);
@@
-          // Small delay to avoid rate limits
-          await this.sleep(50);
         } catch (error) {
           logger.error(`Failed to process transaction ${hash}: ${error}`);
           batchErrors++;
         }
```

Rationale: Replace arbitrary sleeps with a deterministic limiter; match free plan limits; keep config in env.

### B) Remove RPC `calculate_wallet_balance` call (optional validation via Prisma)
Diff against `src/workers/sync-worker.ts` (replace validation block):

```diff
@@
-    // Optional: Calculate balance from our transactions for validation
-    if (totalProcessed > 0) {
-      try {
-        const { data: balanceData } = await this.supabase
-          .rpc('calculate_wallet_balance', {
-            p_wallet_address: walletAddress,
-            p_user_id: userId
-          });
-        const calculatedBalance = balanceData?.balance || '0';
-        
-        // Compare and log any discrepancy
-        if (calculatedBalance !== actualBalance) {
-          const diff = BigInt(actualBalance) - BigInt(calculatedBalance);
-          logger.warn(`Balance discrepancy! Calculated: ${calculatedBalance}, Actual: ${actualBalance}, Diff: ${diff}`);
-        }
-      } catch (error) {
-        logger.warn(`Failed to calculate balance for validation: ${error}`);
-      }
-    }
+    // Optional: Validate against local aggregate (Prisma) later if needed
```

Rationale: Reduce coupling to broken RPC; rely on Blockfrost as source of truth now; add Prisma-based validation later if desired.

### C) Holdings snapshot writer service + hook after job completion
New file `src/services/portfolio/holdings-snapshot-service.ts` (preview):

```ts
import { prisma } from '@/lib/prisma';

export class HoldingsSnapshotService {
  async writeSnapshot(userId: string, walletAddress: string): Promise<void> {
    // Aggregate net changes per token for this wallet
    const flows = await prisma.assetFlow.groupBy({
      by: ['tokenUnit'],
      where: { transaction: { userId, walletAddress } },
      _sum: { netChange: true }
    });

    const asOf = new Date();
    const rows = flows.map(f => ({
      userId,
      walletAddress,
      asOf,
      tokenUnit: f.tokenUnit,
      // BigInt → Decimal conversion left to Prisma client/or mapping layer
      quantity: (f._sum.netChange ?? 0) as unknown as any,
      value: null
    }));

    if (rows.length > 0) {
      await prisma.portfolioHoldingsSnapshot.createMany({ data: rows });
    } else {
      await prisma.portfolioHoldingsSnapshot.create({
        data: { userId, walletAddress, asOf, tokenUnit: 'lovelace', quantity: 0 as any, value: null }
      });
    }
  }
}
```

Hook into worker after job success (diff against `src/workers/sync-worker.ts`):

```diff
@@
 import { ServiceFactory } from '@/services/service-factory';
+import { HoldingsSnapshotService } from '@/services/portfolio/holdings-snapshot-service';
@@
   private supabase: any;
   private limiter: TokenBucket;
+  private snapshots = new HoldingsSnapshotService();
@@
       const lastBlock = await this.processJob(job);
       await queueService.complete(job.id, { lastBlock });
+      // Write holdings snapshot for graphs
+      const { walletAddress, userId } = job.data;
+      await this.snapshots.writeSnapshot(userId, walletAddress);
       logger.info(`Completed sync job ${job.id} at block ${lastBlock}`);
```

Rationale: Post-sync snapshot makes the dashboard responsive and avoids heavy on-request aggregation; future valuation can enrich `value` using a price service.

### D) Environment variables (examples)
Diff against `.env.example` (append):

```diff
@@
 # Feature flags
+USE_PRISMA=true
+USE_PRISMA_QUEUE=false
+USE_BULLMQ=false

 # Rate limiting
+BLOCKFROST_RPS=10
+BLOCKFROST_BURST=500
+SYNC_CONCURRENCY=8
```

### E) Minimal WebSocket event publisher (placeholder)
New file `src/services/realtime/ws-events.ts` (preview):

```ts
// Placeholder publisher; replace with Redis Pub/Sub or BullMQ events in Phase 3
export function publishSyncProgress(jobId: string, walletAddress: string, progress: any) {
  // Implement WS broadcast here
  console.log('sync_progress', { jobId, walletAddress, progress });
}

export function publishWalletUpdated(walletAddress: string) {
  // Implement WS broadcast here
  console.log('wallet_updated', { walletAddress });
}
```

---

## Rollout Plan (≤1,000 wallets)
- Phase 1: Apply schema tweaks; keep Supabase queue; add rate limiter; keep UI intact; write holdings snapshots after sync.
- Phase 2: Stand up Railway worker/API; flip to Prisma queue locally via `USE_PRISMA_QUEUE=true`; validate.
- Phase 3: Add Redis + BullMQ and WS; flip `USE_BULLMQ=true` and deprecate Prisma queue; keep snapshots and caches as-is.

## Environment Variables

```env
# Feature flags
USE_PRISMA=true
USE_PRISMA_QUEUE=false
USE_BULLMQ=false

# Rate limiting
BLOCKFROST_RPS=10
BLOCKFROST_BURST=500
SYNC_CONCURRENCY=8
```

## References / Real-World Examples
- Zerion/Zapper/DeBank: event-first, derived state via workers, Redis cache, WS UX.
- CoinTracker/Koinly: transaction normalization, cost-basis lots in background, materialized aggregates.
- Rotki (open-source): local-first equivalent patterns, deterministic event processing.

