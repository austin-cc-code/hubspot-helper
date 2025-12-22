/**
 * Simple in-memory cache with TTL support
 *
 * Use for caching:
 * - Property definitions (rarely change)
 * - Portal info (static)
 * - Search results (short TTL)
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('cache');

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class CacheService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultTTL: number;

  constructor(defaultTTLMinutes: number = 30) {
    this.defaultTTL = defaultTTLMinutes * 60 * 1000; // Convert to milliseconds
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      logger.debug({ key }, 'Cache miss');
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      logger.debug({ key }, 'Cache expired');
      this.cache.delete(key);
      return null;
    }

    logger.debug({ key }, 'Cache hit');
    return entry.data;
  }

  /**
   * Set value in cache with optional TTL
   */
  set<T>(key: string, data: T, ttlMinutes?: number): void {
    const ttl = ttlMinutes ? ttlMinutes * 60 * 1000 : this.defaultTTL;
    const expiresAt = Date.now() + ttl;

    this.cache.set(key, { data, expiresAt });

    logger.debug({ key, ttlMinutes: ttlMinutes || this.defaultTTL / 60000 }, 'Cache set');
  }

  /**
   * Delete value from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug({ key }, 'Cache deleted');
    }
    return deleted;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.debug({ size }, 'Cache cleared');
  }

  /**
   * Clear expired entries
   */
  clearExpired(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleared++;
      }
    }

    if (cleared > 0) {
      logger.debug({ cleared }, 'Cleared expired cache entries');
    }

    return cleared;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    expired: number;
  } {
    const now = Date.now();
    let expired = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expired++;
      }
    }

    return {
      size: this.cache.size,
      expired,
    };
  }

  /**
   * Get or compute value (with caching)
   */
  async getOrCompute<T>(
    key: string,
    compute: () => Promise<T>,
    ttlMinutes?: number
  ): Promise<T> {
    // Try cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Compute and cache
    const result = await compute();
    this.set(key, result, ttlMinutes);

    return result;
  }
}
