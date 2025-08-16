/**
 * In-Memory Cache Service Implementation
 * 
 * Simple LRU cache with TTL support.
 * Easy to replace with Redis when ready to scale.
 */

import { logger } from '@/lib/logger';
import type { 
  ICacheService, 
  CacheEntry, 
  CacheConfig 
} from '@/services/interfaces/cache-service';

export class InMemoryCache implements ICacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly config: Required<CacheConfig>;

  constructor(config: CacheConfig = {}) {
    this.config = {
      defaultTTL: config.defaultTTL || 300, // 5 minutes default
      maxSize: config.maxSize || 1000,
      checkPeriod: config.checkPeriod || 60000 // Check every minute
    };

    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    
    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.value as T;
  }

  /**
   * Set a value in cache with optional TTL
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds || this.config.defaultTTL;
    const now = Date.now();
    
    // Check size limit and evict if necessary
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      // Evict oldest entry (first in map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.stats.evictions++;
        logger.debug(`Cache eviction: ${firstKey}`);
      }
    }

    const entry: CacheEntry<T> = {
      value,
      expiresAt: now + (ttl * 1000),
      createdAt: now
    };

    this.cache.set(key, entry);
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async delPattern(pattern: string): Promise<number> {
    let deleted = 0;
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    
    return deleted;
  }

  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    logger.info('Cache cleared');
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
    return {
      size: this.cache.size,
      ...this.stats
    };
  }

  /**
   * Set multiple values at once
   */
  async mset(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl);
    }
  }

  /**
   * Get multiple values at once
   */
  async mget<T>(keys: string[]): Promise<Array<T | null>> {
    const results: Array<T | null> = [];
    
    for (const key of keys) {
      results.push(await this.get<T>(key));
    }
    
    return results;
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, this.config.checkPeriod);

    // Don't block Node.js from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop periodic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired cache entries`);
    }
  }

  /**
   * Get cache keys for debugging
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size in bytes (approximate)
   */
  getSizeInBytes(): number {
    let size = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      // Rough estimate
      size += key.length * 2; // UTF-16
      size += JSON.stringify(entry.value).length * 2;
      size += 24; // Overhead for timestamps
    }
    
    return size;
  }
}

// Cache instances for different purposes with different TTLs
export const cacheInstances = {
  // Wallet data cache - 5 minute TTL
  wallet: new InMemoryCache({ 
    defaultTTL: 300,
    maxSize: 100 
  }),
  
  // Transaction cache - 5 minute TTL
  transactions: new InMemoryCache({ 
    defaultTTL: 300,
    maxSize: 500 
  }),
  
  // Token metadata cache - 15 minute TTL
  tokens: new InMemoryCache({ 
    defaultTTL: 900,
    maxSize: 1000 
  }),
  
  // Price cache - 1 minute TTL
  prices: new InMemoryCache({ 
    defaultTTL: 60,
    maxSize: 10 
  })
};

// Default cache instance
export const cache = cacheInstances.wallet;