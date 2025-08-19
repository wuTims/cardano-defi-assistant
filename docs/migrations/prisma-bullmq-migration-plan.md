# Prisma + BullMQ Migration Plan
**Version**: 3.0.0  
**Date**: 2025-08-18  
**Status**: Ready for Implementation  
**Estimated Duration**: 10 days  

## Executive Summary

Three-phase iterative migration from Supabase RPC to modern stack:
- **Phase 1**: Prisma ORM (fix data layer while on Vercel)
- **Phase 2**: Railway backend + Performance (solve timeouts and speed)
- **Phase 3**: Redis + BullMQ (add reliability and real-time features)

**Current Issues**:
- 30 seconds to sync 80 transactions (serial processing with delays)
- `bulk_insert_transactions` RPC returning undefined
- Missing `calculate_wallet_balance` function
- 10-second Vercel Hobby timeout causing failures

**Target Results**:
- 80 transactions in 3 seconds (10x improvement)
- No timeout issues with Railway backend
- Full type safety with Prisma
- Persistent Redis cache
- Real-time updates via BullMQ/WebSockets

## Architecture Overview

### Current Architecture (Problematic)
```
Vercel App → Supabase RPC (undefined) → Serial Processing (30s)
           → InMemoryCache (volatile) → Database Polling
           → 10s timeout failures
```

### Target Architecture (After Phase 3)
```
Vercel Frontend → Railway Backend → BullMQ + Redis
     (UI only)      (Workers)        (Queue + Cache)
                 → Parallel Fetch → 3s processing
                 → WebSockets    → Real-time updates
```

## Migration Strategy

### Phase Timeline

| Phase | Duration | Risk | Rollback | Key Achievement |
|-------|----------|------|----------|-----------------|
| **Phase 1: Prisma** | 2-3 days | LOW | 5 min | Fix data layer |
| **Phase 2: Railway** | 3-4 days | MEDIUM | 10 min | No timeouts + 10x speed |
| **Phase 3: BullMQ** | 2-3 days | LOW | 5 min | Queue reliability |

### Critical Design Decisions

1. **Keep Stable Interfaces**: `IQueueService` and `ICacheService` remain unchanged
2. **Performance with Railway**: Combine backend move with optimization
3. **Iterative Safety**: Each phase valuable independently
4. **Feature Flags**: Easy rollback via environment variables

---

## Phase 1: Prisma Migration

### Goal
Fix data layer issues while staying on Vercel.

### What Changes
- Replace Supabase RPC with Prisma ORM
- Fix `bulk_insert_transactions` undefined issue
- Implement `calculate_wallet_balance`
- Full TypeScript type safety

### What Stays Same
- Still on Vercel (timeouts expected)
- Still using SupabaseQueueService
- Still using InMemoryCache
- Performance issues remain (fixed in Phase 2)

### Implementation

1. **Install Prisma**
   ```bash
   npm install prisma @prisma/client
   npx prisma db pull
   npx prisma generate
   ```

2. **Database Schema**
   - See: [`prisma-schema.prisma`](../code-snippets/prisma-bullmq-migration/prisma-schema.prisma)
   - Ultra-minimal: Store history, calculate present

3. **Repository Implementation**
   - See: [`phase1-prisma-repository.ts`](../code-snippets/prisma-bullmq-migration/phase1-prisma-repository.ts)
   - Replaces broken RPC functions

### Testing Checklist
- [ ] Bulk insert returns defined results
- [ ] Balance calculation works
- [ ] Expect timeouts on large syncs (normal)

### Environment Variables
```bash
USE_PRISMA=true
PLATFORM=vercel
```

---

## Phase 2: Railway Backend + Performance

### Goal
Move backend to Railway and achieve 10x performance improvement.

### What Changes
- Deploy workers to Railway (no timeout limits!)
- Remove 50ms artificial delays
- Implement parallel transaction fetching
- Add Blockfrost rate limiting
- 80 transactions: 30s → 3s

### Architecture
```
Vercel Frontend                Railway Backend
/api/sync ─────POST────→ /api/jobs
         ←─Job ID (1s)──        ↓
                         Process in background
                         (can take 30+ seconds)
```

### Implementation

1. **Railway Setup**
   - Config: [`railway.toml`](../code-snippets/prisma-bullmq-migration/railway.toml)
   - Express API: [`phase2-railway-api.ts`](../code-snippets/prisma-bullmq-migration/phase2-railway-api.ts)

2. **Performance Optimization**
   ```typescript
   // OLD: Serial with delays (30 seconds)
   for (const tx of transactions) {
     await fetch(tx);
     await sleep(50); // REMOVED!
   }
   
   // NEW: Parallel with rate limiting (3 seconds)
   const batches = chunk(transactions, 10);
   for (const batch of batches) {
     await Promise.allSettled(batch.map(fetch));
   }
   ```
   - Worker: [`phase2-optimized-sync-worker.ts`](../code-snippets/prisma-bullmq-migration/phase2-optimized-sync-worker.ts)
   - Rate Limiter: [`blockfrost-rate-limiter.ts`](../code-snippets/prisma-bullmq-migration/blockfrost-rate-limiter.ts)

3. **Frontend Integration**
   - Vercel Route: [`phase2-vercel-api-route.ts`](../code-snippets/prisma-bullmq-migration/phase2-vercel-api-route.ts)
   - Returns job ID immediately
   - No timeout issues!

### Blockfrost Rate Limiting
- 10 requests/second sustained
- 500 request burst capacity
- Token bucket algorithm

### Testing Checklist
- [ ] No timeout errors
- [ ] 80 transactions in < 5 seconds
- [ ] Job creation returns immediately
- [ ] Parallel processing works

### Environment Variables
```bash
USE_PRISMA=true
PLATFORM=railway
RAILWAY_API_URL=https://your-app.railway.app
ENABLE_PARALLEL_FETCH=true
```

---

## Phase 3: Redis + BullMQ Enhancement

### Goal
Replace database polling with proper message queue and persistent caching.

### What Changes
- Replace SupabaseQueueService with BullMQ
- Add Redis for persistent caching
- Implement retry logic with exponential backoff
- Add WebSocket support for real-time updates
- Dead letter queue for failed jobs

### Implementation

1. **BullMQ Queue Service**
   - See: [`phase3-bullmq-queue-service.ts`](../code-snippets/prisma-bullmq-migration/phase3-bullmq-queue-service.ts)
   - Retry logic built-in
   - Progress tracking
   - Real-time events

2. **Redis Cache Service**
   - See: [`phase3-redis-cache-service.ts`](../code-snippets/prisma-bullmq-migration/phase3-redis-cache-service.ts)
   - Survives deployments
   - Shared across workers
   - Pipeline operations

### Benefits Over Database Polling
- No polling overhead
- Built-in retry logic
- Job progress events
- 99.9% reliability
- WebSocket updates

### Testing Checklist
- [ ] Queue job processing works
- [ ] Retry logic triggers on failure
- [ ] Cache persists across restarts
- [ ] WebSocket updates received

### Environment Variables
```bash
USE_PRISMA=true
USE_BULLMQ=true
PLATFORM=railway
REDIS_URL=redis://default:password@host:6379
```

---

## Performance Metrics

| Metric | Current | Phase 1 | Phase 2 | Phase 3 |
|--------|---------|---------|---------|---------|
| 80 tx sync | 30s ❌ | 30s ❌ | **3s ✅** | **3s ✅** |
| Timeout issues | Yes | Yes | **No** | **No** |
| Cache persistence | No | No | No | **Yes** |
| Queue reliability | 95% | 95% | 95% | **99.9%** |
| Real-time updates | No | No | No | **Yes** |

## Cost Analysis

| Component | Monthly Cost | Notes |
|-----------|-------------|-------|
| Vercel Hobby | $0 | Frontend only |
| Railway | $5-10 | Workers + API |
| Redis | $0-5 | Included with Railway |
| Supabase | $0 | Free tier sufficient |
| **Total** | **$5-15** | vs $20+ for Vercel Pro |

## Rollback Procedures

Each phase can be rolled back independently:

```bash
# Phase 1: Revert to RPC functions (5 minutes)
USE_PRISMA=false

# Phase 2: Switch back to Vercel (10 minutes)
PLATFORM=vercel

# Phase 3: Use Supabase queue (5 minutes)
USE_BULLMQ=false
```

## Code Organization

All implementation code in [`docs/code-snippets/prisma-bullmq-migration/`](../code-snippets/prisma-bullmq-migration/):

```
prisma-bullmq-migration/
├── prisma-schema.prisma              # Database schema
├── phase1-prisma-repository.ts       # Prisma implementation
├── phase2-optimized-sync-worker.ts   # Parallel processing
├── phase2-railway-api.ts             # Backend API
├── phase2-vercel-api-route.ts        # Frontend routes
├── phase3-bullmq-queue-service.ts    # Queue service
├── phase3-redis-cache-service.ts     # Cache service
├── blockfrost-rate-limiter.ts        # Rate limiting
└── railway.toml                      # Deployment config
```

## Implementation Checklist

### Pre-Migration
- [ ] Backup database
- [ ] Set up Railway account
- [ ] Create feature branch
- [ ] Review with team

### Phase 1: Prisma (Days 1-3)
- [ ] Install Prisma dependencies
- [ ] Generate schema from database
- [ ] Create PrismaTransactionRepository
- [ ] Replace RPC calls in codebase
- [ ] Test data operations
- [ ] Deploy to staging

### Phase 2: Railway (Days 4-7)
- [ ] Create Railway project
- [ ] Deploy backend API
- [ ] Implement parallel fetching
- [ ] Add rate limiting
- [ ] Update Vercel routes
- [ ] Test performance (< 5s for 80 tx)
- [ ] Verify no timeouts

### Phase 3: BullMQ (Days 8-10)
- [ ] Add Redis to Railway
- [ ] Implement BullMQQueueService
- [ ] Replace cache service
- [ ] Add WebSocket support
- [ ] Test retry logic
- [ ] Monitor queue metrics
- [ ] Production deployment

## Success Criteria

1. **Phase 1**: No more undefined RPC results
2. **Phase 2**: 10x performance improvement, no timeouts
3. **Phase 3**: 99.9% queue reliability, real-time updates

## Risk Mitigation

- **Incremental Value**: Each phase improves the system
- **Feature Flags**: Roll back via environment variables
- **Interface Stability**: No breaking changes
- **Testing Gates**: Must pass before next phase

## Next Steps

1. **Immediate**: Review this plan
2. **Day 1**: Begin Phase 1 (Prisma)
3. **Day 4**: Begin Phase 2 (Railway)
4. **Day 8**: Begin Phase 3 (BullMQ)
5. **Day 10**: Production deployment

---

*All implementation details are in the linked code snippet files.*