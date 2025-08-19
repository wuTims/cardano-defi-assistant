// Phase 3: Redis Cache Service
// Replaces InMemoryCache with persistent Redis cache
// Data survives deployments and is shared across workers

import Redis from 'ioredis';
import type { ICacheService, CacheEntry } from '@/services/interfaces/cache-service';

export class RedisCacheService implements ICacheService {
  private redis: Redis;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };
  
  constructor(
    private readonly prefix: string = 'cache',
    private readonly defaultTTL: number = 300 // 5 minutes default
  ) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      keyPrefix: `${this.prefix}:`,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });
    
    // Error handling
    this.redis.on('error', (err) => {
      console.error('Redis cache error:', err);
    });
    
    this.redis.on('connect', () => {
      console.log('Redis cache connected');
    });
  }
  
  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      
      if (!data) {
        this.stats.misses++;
        return null;
      }
      
      const entry: CacheEntry<T> = JSON.parse(data);
      
      // Check if expired (redundant with Redis TTL but good for stats)
      if (Date.now() > entry.expiresAt) {
        this.stats.misses++;
        await this.redis.del(key);
        return null;
      }
      
      this.stats.hits++;
      return entry.value;
      
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      this.stats.misses++;
      return null;
    }
  }
  
  /**
   * Set a value in cache with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const ttl = ttlSeconds || this.defaultTTL;
      const now = Date.now();
      
      const entry: CacheEntry<T> = {
        value,
        expiresAt: now + (ttl * 1000),
        createdAt: now
      };
      
      // Set with expiration
      await this.redis.setex(key, ttl, JSON.stringify(entry));
      
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  }
  
  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }
  }
  
  /**
   * Delete multiple keys matching a pattern
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      // Convert simple pattern to Redis pattern
      const redisPattern = `${this.prefix}:${pattern}`;
      
      // Use SCAN to find matching keys (safer than KEYS)
      const stream = this.redis.scanStream({
        match: redisPattern,
        count: 100
      });
      
      const keys: string[] = [];
      stream.on('data', (resultKeys) => {
        keys.push(...resultKeys);
      });
      
      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      
      if (keys.length === 0) return 0;
      
      // Delete keys in pipeline for efficiency
      const pipeline = this.redis.pipeline();
      for (const key of keys) {
        // Remove prefix from key
        const cleanKey = key.replace(`${this.prefix}:`, '');
        pipeline.del(cleanKey);
      }
      await pipeline.exec();
      
      return keys.length;
      
    } catch (error) {
      console.error(`Cache delPattern error for pattern ${pattern}:`, error);
      return 0;
    }
  }
  
  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      console.error(`Cache has error for key ${key}:`, error);
      return false;
    }
  }
  
  /**
   * Clear all cache entries (use with caution!)
   */
  async clear(): Promise<void> {
    try {
      // Use SCAN to find all keys with our prefix
      const stream = this.redis.scanStream({
        match: `${this.prefix}:*`,
        count: 100
      });
      
      const keys: string[] = [];
      stream.on('data', (resultKeys) => {
        keys.push(...resultKeys);
      });
      
      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      
      if (keys.length > 0) {
        // Delete all keys
        const pipeline = this.redis.pipeline();
        for (const key of keys) {
          const cleanKey = key.replace(`${this.prefix}:`, '');
          pipeline.del(cleanKey);
        }
        await pipeline.exec();
      }
      
      console.log(`Cache cleared: ${keys.length} keys deleted`);
      
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }
  
  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    size: number;
    hits: number;
    misses: number;
    evictions: number;
  }> {
    // Get key count
    const stream = this.redis.scanStream({
      match: `${this.prefix}:*`,
      count: 1000
    });
    
    let size = 0;
    stream.on('data', (keys) => {
      size += keys.length;
    });
    
    await new Promise((resolve) => {
      stream.on('end', resolve);
    });
    
    return {
      size,
      ...this.stats
    };
  }
  
  /**
   * Set multiple values at once (pipeline)
   */
  async mset(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      const now = Date.now();
      
      for (const { key, value, ttl } of entries) {
        const ttlSeconds = ttl || this.defaultTTL;
        const entry: CacheEntry<any> = {
          value,
          expiresAt: now + (ttlSeconds * 1000),
          createdAt: now
        };
        
        pipeline.setex(key, ttlSeconds, JSON.stringify(entry));
      }
      
      await pipeline.exec();
      
    } catch (error) {
      console.error('Cache mset error:', error);
    }
  }
  
  /**
   * Get multiple values at once (pipeline)
   */
  async mget<T>(keys: string[]): Promise<Array<T | null>> {
    try {
      const pipeline = this.redis.pipeline();
      
      for (const key of keys) {
        pipeline.get(key);
      }
      
      const results = await pipeline.exec();
      if (!results) return keys.map(() => null);
      
      return results.map(([err, data]) => {
        if (err || !data) {
          this.stats.misses++;
          return null;
        }
        
        try {
          const entry: CacheEntry<T> = JSON.parse(data as string);
          
          if (Date.now() > entry.expiresAt) {
            this.stats.misses++;
            return null;
          }
          
          this.stats.hits++;
          return entry.value;
        } catch {
          this.stats.misses++;
          return null;
        }
      });
      
    } catch (error) {
      console.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }
  
  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    await this.redis.quit();
  }
}

// Factory function to create cache instances with different TTLs
export function createRedisCacheService(config: {
  prefix: string;
  defaultTTL: number;
}): RedisCacheService {
  return new RedisCacheService(config.prefix, config.defaultTTL);
}

// Pre-configured cache instances
export const cacheInstances = {
  // Wallet data cache - 5 minute TTL
  wallet: createRedisCacheService({ 
    prefix: 'wallet',
    defaultTTL: 300
  }),
  
  // Transaction cache - 5 minute TTL (immutable but for performance)
  transactions: createRedisCacheService({ 
    prefix: 'tx',
    defaultTTL: 300
  }),
  
  // Token metadata cache - 15 minute TTL
  tokens: createRedisCacheService({ 
    prefix: 'token',
    defaultTTL: 900
  }),
  
  // Price cache - 1 minute TTL (prices change frequently)
  prices: createRedisCacheService({ 
    prefix: 'price',
    defaultTTL: 60
  })
};