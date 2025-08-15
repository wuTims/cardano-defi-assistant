/**
 * Service Factory
 * 
 * Provides singleton instances of cache and queue services.
 * Uses lazy initialization to avoid startup errors.
 * Configures different cache instances for different data types.
 */

import { InMemoryCache } from './cache/in-memory-cache';
import { SupabaseQueueService } from './queue/supabase-queue-service';
import type { ICacheService } from './interfaces/cache-service';
import type { IQueueService } from './interfaces/queue-service';
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
    caches: Map<string, ICacheService>;
  } = {
    caches: new Map()
  };

  /**
   * Get the singleton queue service instance
   */
  static getQueueService(): IQueueService {
    if (!this.instances.queue) {
      logger.info('Initializing SupabaseQueueService singleton');
      this.instances.queue = new SupabaseQueueService();
    }
    return this.instances.queue;
  }

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
   * Clear all service instances (useful for testing)
   */
  static clearInstances(): void {
    this.instances.queue = undefined;
    this.instances.caches.clear();
    logger.info('Cleared all service instances');
  }

  /**
   * Get statistics for all services
   */
  static async getStats(): Promise<{
    queue: any;
    caches: Record<string, any>;
  }> {
    const queueStats = this.instances.queue 
      ? await this.instances.queue.getStats()
      : null;

    const cacheStats: Record<string, any> = {};
    for (const [name, cache] of this.instances.caches.entries()) {
      cacheStats[name] = await cache.getStats();
    }

    return {
      queue: queueStats,
      caches: cacheStats
    };
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