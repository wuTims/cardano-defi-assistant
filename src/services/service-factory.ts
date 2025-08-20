/**
 * Service Factory
 * 
 * Provides singleton instances of services and repositories.
 * Uses feature flags to switch between implementations.
 * Configures different cache instances for different data types.
 * 
 * Design Principles:
 * - YAGNI: Only creates what's needed, when it's needed
 * - SOLID: Depends on interfaces, single responsibility per method
 * - DRY: Singleton pattern prevents duplicate instances
 * - Easy Swapping: Feature flags and interfaces enable runtime switching
 */

import { InMemoryCache } from './cache/in-memory-cache';
import { PrismaTransactionRepository } from '@/infrastructure/repositories/prisma/prisma-transaction-repository';
import { PrismaQueueRepository } from '@/infrastructure/repositories/prisma/prisma-queue-repository';
import { PrismaSyncJobRepository } from '@/infrastructure/repositories/prisma/prisma-sync-job-repository';
import { PrismaWalletRepository } from '@/infrastructure/repositories/prisma/prisma-wallet-repository';
import { PrismaAuthChallengeRepository } from '@/infrastructure/repositories/prisma/prisma-auth-challenge-repository';
import { PrismaTokenRepository } from '@/infrastructure/repositories/prisma/prisma-token-repository';
import { PrismaQueueService } from './queue/prisma-queue-service';
import { prisma } from '@/lib/prisma';
import type { ICacheService, IQueueService } from '@/core/interfaces/services';
import type { 
  ITransactionRepository,
  IWalletRepository,
  IAuthChallengeRepository,
  ISyncJobRepository,
  ITokenRepository,
  IQueueRepository
} from '@/core/interfaces/repositories';
import { logger } from '@/lib/logger';

/**
 * Cache configuration for different data types
 */
const CACHE_CONFIGS = {
  wallet: {
    defaultTTL: 300,      // 5 minutes
    maxSize: 100,         // 100 wallet records
    checkPeriod: 60000    // Check every minute
  },
  transactions: {
    defaultTTL: 300,      // 5 minutes  
    maxSize: 500,         // 500 transaction pages
    checkPeriod: 60000
  },
  tokens: {
    defaultTTL: 900,      // 15 minutes
    maxSize: 1000,        // 1000 token metadata records
    checkPeriod: 60000
  },
  prices: {
    defaultTTL: 60,       // 1 minute (prices change frequently)
    maxSize: 100,         // 100 price records
    checkPeriod: 30000    // Check every 30 seconds
  }
} as const;

/**
 * Service Factory for managing singleton service instances
 */
export class ServiceFactory {
  private static instances: {
    queue?: IQueueService;
    queueRepository?: IQueueRepository;      // Interface type
    syncJobRepository?: ISyncJobRepository;   // Domain-specific
    transactionRepository?: ITransactionRepository;
    tokenRepository?: ITokenRepository;
    walletRepository?: IWalletRepository;
    authChallengeRepository?: IAuthChallengeRepository;
    caches: Map<string, ICacheService>;
  } = {
    caches: new Map()
  };

  /**
   * Get a cache service instance for a specific data type
   */
  static getCacheService(type: keyof typeof CACHE_CONFIGS): ICacheService {
    if (!this.instances.caches.has(type)) {
      const config = CACHE_CONFIGS[type];
      logger.info(`Initializing ${type} cache - TTL: ${config.defaultTTL}s, MaxSize: ${config.maxSize}`);
      this.instances.caches.set(type, new InMemoryCache(config));
    }
    return this.instances.caches.get(type)!;
  }

  /**
   * Get the wallet cache instance
   */
  static getWalletCache(): ICacheService {
    return this.getCacheService('wallet');
  }

  /**
   * Get the transactions cache instance
   */
  static getTransactionsCache(): ICacheService {
    return this.getCacheService('transactions');
  }

  /**
   * Get the tokens cache instance
   */
  static getTokensCache(): ICacheService {
    return this.getCacheService('tokens');
  }

  /**
   * Get the prices cache instance
   */
  static getPricesCache(): ICacheService {
    return this.getCacheService('prices');
  }

  /**
   * Get transaction repository instance
   * 
   * Phase 1: Using PrismaTransactionRepository
   * Phase 2: Same, with more features
   * Phase 3: Same interface, potentially different backends
   * 
   * @returns ITransactionRepository implementation
   */
  static getTransactionRepository(): ITransactionRepository {
    if (!this.instances.transactionRepository) {
      logger.info('Initializing PrismaTransactionRepository singleton');
      this.instances.transactionRepository = new PrismaTransactionRepository(prisma);
    }
    return this.instances.transactionRepository;
  }

  /**
   * Get sync job repository instance (domain-specific)
   * 
   * Handles sync job lifecycle operations following DDD principles.
   * 
   * @returns ISyncJobRepository implementation
   */
  static getSyncJobRepository(): ISyncJobRepository {
    if (!this.instances.syncJobRepository) {
      logger.info('Initializing PrismaSyncJobRepository singleton');
      this.instances.syncJobRepository = new PrismaSyncJobRepository(prisma);
    }
    return this.instances.syncJobRepository;
  }

  /**
   * Get generic queue repository (infrastructure)
   * 
   * Generic job queue operations, not domain-specific.
   * Use this for generic queue management.
   * 
   * @returns IQueueRepository implementation
   */
  static getQueueRepository(): IQueueRepository {
    if (!this.instances.queueRepository) {
      logger.info('Initializing PrismaQueueRepository singleton (generic infrastructure)');
      this.instances.queueRepository = new PrismaQueueRepository(prisma);
    }
    return this.instances.queueRepository;
  }

  /**
   * Get wallet repository instance
   * 
   * @returns IWalletRepository implementation
   */
  static getWalletRepository(): IWalletRepository {
    if (!this.instances.walletRepository) {
      logger.info('Initializing PrismaWalletRepository singleton');
      this.instances.walletRepository = new PrismaWalletRepository(prisma);
    }
    return this.instances.walletRepository;
  }

  /**
   * Get auth challenge repository instance
   * 
   * @returns IAuthChallengeRepository implementation
   */
  static getAuthChallengeRepository(): IAuthChallengeRepository {
    if (!this.instances.authChallengeRepository) {
      logger.info('Initializing PrismaAuthChallengeRepository singleton');
      this.instances.authChallengeRepository = new PrismaAuthChallengeRepository(prisma);
    }
    return this.instances.authChallengeRepository;
  }

  /**
   * Get token repository instance
   * 
   * @returns ITokenRepository implementation
   */
  static getTokenRepository(): ITokenRepository {
    if (!this.instances.tokenRepository) {
      logger.info('Initializing PrismaTokenRepository singleton');
      this.instances.tokenRepository = new PrismaTokenRepository(prisma);
    }
    return this.instances.tokenRepository;
  }

  /**
   * Get queue service instance
   * 
   * Provides IQueueService implementation wrapping Prisma repositories.
   * Will be replaced with BullMQ in Phase 3.
   * 
   * @returns IQueueService implementation
   */
  static getQueueService(): IQueueService {
    if (!this.instances.queue) {
      logger.info('Initializing PrismaQueueService singleton');
      // Ensure dependencies are initialized
      const queueRepo = this.getQueueRepository();
      const syncJobRepo = this.getSyncJobRepository();
      this.instances.queue = new PrismaQueueService(queueRepo, syncJobRepo);
    }
    return this.instances.queue;
  }

  /**
   * Clear all service instances (useful for testing)
   */
  static clearInstances(): void {
    this.instances.queue = undefined;
    this.instances.queueRepository = undefined;
    this.instances.syncJobRepository = undefined;
    this.instances.transactionRepository = undefined;
    this.instances.tokenRepository = undefined;
    this.instances.walletRepository = undefined;
    this.instances.authChallengeRepository = undefined;
    this.instances.caches.clear();
    logger.info('Cleared all service instances');
  }


  /**
   * Helper to generate cache keys with consistent formatting
   */
  static cacheKey = {
    wallet: (address: string) => `wallet:${address}`,
    transactions: (address: string, page: number, filters?: string) => 
      `tx:${address}:${page}${filters ? `:${filters}` : ''}`,
    token: (unit: string) => `token:${unit}`,
    price: (unit: string) => `price:${unit}`,
    syncStatus: (address: string) => `sync:${address}`
  };
}