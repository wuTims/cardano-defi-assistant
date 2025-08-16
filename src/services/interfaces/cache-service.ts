/**
 * Cache Service Interface
 * 
 * Defines the contract for cache implementations.
 * This allows us to swap between in-memory, Redis, or other cache backends.
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

export interface ICacheService {
  /**
   * Get a value from cache
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in cache with optional TTL
   */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /**
   * Delete a value from cache
   */
  delete(key: string): Promise<void>;

  /**
   * Delete multiple keys matching a pattern
   */
  delPattern(pattern: string): Promise<number>;

  /**
   * Check if a key exists
   */
  has(key: string): Promise<boolean>;

  /**
   * Clear all cache entries
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<{
    size: number;
    hits: number;
    misses: number;
    evictions: number;
  }>;

  /**
   * Set multiple values at once
   */
  mset(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<void>;

  /**
   * Get multiple values at once
   */
  mget<T>(keys: string[]): Promise<Array<T | null>>;
}

export interface CacheConfig {
  defaultTTL?: number;  // Default TTL in seconds
  maxSize?: number;     // Maximum number of entries
  checkPeriod?: number; // How often to check for expired entries (ms)
}