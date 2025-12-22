/**
 * CacheService Unit Tests
 */

import { CacheService } from '../../src/services/CacheService.js';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService(1); // 1 minute TTL
  });

  afterEach(() => {
    cache.clear();
  });

  describe('get and set', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should handle different data types', () => {
      cache.set('string', 'hello');
      cache.set('number', 42);
      cache.set('object', { foo: 'bar' });
      cache.set('array', [1, 2, 3]);

      expect(cache.get('string')).toBe('hello');
      expect(cache.get('number')).toBe(42);
      expect(cache.get('object')).toEqual({ foo: 'bar' });
      expect(cache.get('array')).toEqual([1, 2, 3]);
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      const shortCache = new CacheService(0.001); // 0.06 seconds
      shortCache.set('key1', 'value1');

      expect(shortCache.get('key1')).toBe('value1');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(shortCache.get('key1')).toBeNull();
    });

    it('should support custom TTL per entry', async () => {
      cache.set('short', 'value1', 0.001); // 0.06 seconds
      cache.set('long', 'value2', 10); // 10 minutes

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(cache.get('short')).toBeNull();
      expect(cache.get('long')).toBe('value2');
    });
  });

  describe('delete', () => {
    it('should delete existing entries', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeNull();
    });

    it('should return false for non-existent entries', () => {
      expect(cache.delete('nonexistent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.clear();

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
    });
  });

  describe('clearExpired', () => {
    it('should clear only expired entries', async () => {
      cache.set('expired', 'value1', 0.001); // 0.06 seconds
      cache.set('valid', 'value2', 10); // 10 minutes

      await new Promise((resolve) => setTimeout(resolve, 100));

      const cleared = cache.clearExpired();

      expect(cleared).toBe(1);
      expect(cache.get('expired')).toBeNull();
      expect(cache.get('valid')).toBe('value2');
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      cache.set('key1', 'value1');
      cache.set('expired', 'value2', 0.001); // Will expire soon

      await new Promise((resolve) => setTimeout(resolve, 100));

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.expired).toBe(1);
    });
  });

  describe('getOrCompute', () => {
    it('should return cached value if available', async () => {
      cache.set('key1', 'cached');

      let computeCalled = false;
      const compute = async () => {
        computeCalled = true;
        return 'computed';
      };

      const result = await cache.getOrCompute('key1', compute);

      expect(result).toBe('cached');
      expect(computeCalled).toBe(false);
    });

    it('should compute and cache value if not available', async () => {
      let computeCalled = false;
      const compute = async () => {
        computeCalled = true;
        return 'computed';
      };

      const result = await cache.getOrCompute('key1', compute);

      expect(result).toBe('computed');
      expect(computeCalled).toBe(true);
      expect(cache.get('key1')).toBe('computed');
    });

    it('should compute again after expiration', async () => {
      let computeCount = 0;
      const compute = async () => {
        computeCount++;
        return 'computed';
      };

      await cache.getOrCompute('key1', compute, 0.001); // 0.06 seconds
      expect(computeCount).toBe(1);

      await new Promise((resolve) => setTimeout(resolve, 100));

      await cache.getOrCompute('key1', compute, 0.001);
      expect(computeCount).toBe(2);
    });
  });
});
