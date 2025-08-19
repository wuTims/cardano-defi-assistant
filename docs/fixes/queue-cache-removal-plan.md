Current State Analysis

  ServiceFactory is currently managing:
  1. Repositories (Transaction, Queue, Wallet) - database access
  2. Caches (4 different types) - in-memory caching
  3. Queue Service (Supabase-based) - job queuing
  4. Utilities (cache keys, stats)

  Future Architecture (Railway + Redis + BullMQ)

  Option 1: Dependency Injection Container (No Factory)

  // Use a DI container like tsyringe or inversify
  container.register<ITransactionRepository>(
    'TransactionRepository',
    { useClass: PrismaTransactionRepository }
  );

  // In API routes
  @inject('TransactionRepository')
  private transactionRepo: ITransactionRepository

  Option 2: Simple Module Exports (No Factory)

  // repositories/index.ts
  export const transactionRepository = new PrismaTransactionRepository(prisma);
  export const walletRepository = new PrismaWalletRepository(prisma);

  // In API routes
  import { transactionRepository } from '@/repositories';

  Option 3: Lean Factory (Current, but simplified)

  // Just repositories, nothing else
  class RepositoryFactory {
    static getTransactionRepository(): ITransactionRepository
    static getWalletRepository(): IWalletRepository
  }

  // BullMQ queues are created directly where needed
  const syncQueue = new Queue('sync', { connection: redis });

  // Redis cache is used directly
  const cache = new RedisCache(redis);

  My Recommendation: Option 2 (Simple Module Exports)

  Why?

  For Repositories:
  - They're true singletons (one Prisma instance)
  - No configuration needed
  - No runtime switching needed

  For BullMQ:
  - Queues are lightweight, create as needed
  - Each queue has its own name/config
  - No benefit from factory pattern

  For Redis Cache:
  - Single Redis client
  - Use directly or wrap in simple cache class
  - No need for multiple cache "types"

  Proposed Architecture:

  // /src/repositories/index.ts
  import { prisma } from '@/lib/prisma';

  // Simple singleton exports
  export const transactionRepository = new PrismaTransactionRepository(prisma);
  export const walletRepository = new PrismaWalletRepository(prisma);
  export const queueRepository = new PrismaQueueRepository(prisma); // temporary

  // /src/lib/redis.ts
  import Redis from 'ioredis';
  export const redis = new Redis(process.env.REDIS_URL);

  // /src/lib/cache.ts
  import { redis } from './redis';
  class RedisCache {
    constructor(private redis: Redis, private ttl: number = 300) {}
    async get<T>(key: string): Promise<T | null> { ... }
    async set<T>(key: string, value: T): Promise<void> { ... }
  }
  export const cache = new RedisCache(redis);

  // /src/queues/sync-queue.ts
  import { Queue } from 'bullmq';
  import { redis } from '@/lib/redis';

  export const syncQueue = new Queue('wallet-sync', {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    }
  });

  // API route usage
  import { transactionRepository } from '@/repositories';
  import { cache } from '@/lib/cache';
  import { syncQueue } from '@/queues/sync-queue';
  import { serialize } from '@/lib/prisma';

  const transactions = await transactionRepository.findByUser(userId);
  await cache.set(cacheKey, transactions);
  await syncQueue.add('sync-wallet', { walletAddress });
  return Response.json(serialize(transactions));

  Benefits of This Approach:

  1. SOLID Compliance:
    - SRP: Each module has one job
    - OCP: Easy to add new repositories/queues
    - DIP: Depend on interfaces, not implementations
    - ISP: Small, focused interfaces
    - LSP: Can swap implementations
  2. DRY:
    - No duplicate factory code
    - Single source for each service
    - Reusable imports
  3. YAGNI:
    - No complex factory when simple exports work
    - No abstraction layers we don't need
    - Direct usage of BullMQ/Redis
  4. Testability:
    - Easy to mock imports
    - Clear dependencies
    - No hidden singletons