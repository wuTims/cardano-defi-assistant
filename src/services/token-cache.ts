/**
 * LRU Token Cache Implementation
 * 
 * Purpose: High-performance in-memory caching for token metadata
 * Implements: ITokenCache
 * 
 * Following plan: LRU cache with 1000 item limit for optimal performance
 */

import type { TokenInfo } from '@/types/transaction';
import type { ITokenCache } from '@/services/interfaces';

/**
 * Least Recently Used (LRU) cache for token metadata
 * Automatically evicts oldest items when capacity is reached
 */
export class LRUTokenCache implements ITokenCache {
  private cache = new Map<string, TokenInfo>();
  private readonly maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Get token from cache
   * Moves item to end (most recently used position)
   */
  public get(unit: string): TokenInfo | null {
    const token = this.cache.get(unit);
    if (token) {
      // Move to end (most recently used)
      this.cache.delete(unit);
      this.cache.set(unit, token);
      return token;
    }
    return null;
  }

  /**
   * Set token in cache
   * Evicts oldest item if at capacity
   */
  public set(unit: string, token: TokenInfo): void {
    // If already exists, delete first to update position
    if (this.cache.has(unit)) {
      this.cache.delete(unit);
    } else if (this.cache.size >= this.maxSize) {
      // Evict least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(unit, token);
  }

  /**
   * Check if token exists in cache
   * Does NOT affect LRU order
   */
  public has(unit: string): boolean {
    return this.cache.has(unit);
  }

  /**
   * Clear all cached tokens
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   */
  public size(): number {
    return this.cache.size;
  }

  /**
   * Get cache hit statistics
   */
  public getStats(): {
    size: number;
    maxSize: number;
    utilization: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: this.cache.size / this.maxSize
    };
  }

  /**
   * Get all cached units (for debugging)
   */
  public getCachedUnits(): string[] {
    return Array.from(this.cache.keys());
  }
}