/**
 * RateLimiter Unit Tests
 */

import { RateLimiter, createHubSpotRateLimiter } from '../../src/services/RateLimiter.js';

describe('RateLimiter', () => {
  describe('token bucket algorithm', () => {
    it('should allow requests up to max tokens', async () => {
      const limiter = new RateLimiter({
        maxTokens: 5,
        refillIntervalMs: 10000,
        maxConcurrent: 5,
      });

      // Should allow 5 immediate requests
      const promises = Array.from({ length: 5 }, () => limiter.acquire());
      await Promise.all(promises);

      const status = limiter.getStatus();
      expect(status.tokens).toBe(0);
      expect(status.activeRequests).toBe(5);

      // Clean up
      promises.forEach(() => limiter.release());
      limiter.destroy();
    });

    it('should queue requests when tokens exhausted', async () => {
      const limiter = new RateLimiter({
        maxTokens: 2,
        refillIntervalMs: 100, // Short interval for testing
        maxConcurrent: 2,
      });

      // Acquire 2 tokens (exhausts bucket)
      await limiter.acquire();
      await limiter.acquire();

      expect(limiter.getStatus().tokens).toBe(0);
      expect(limiter.getStatus().queueSize).toBe(0);

      // Third request should queue
      const thirdPromise = limiter.acquire();

      // Check it's queued
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(limiter.getStatus().queueSize).toBe(1);

      // Release tokens
      limiter.release();
      limiter.release();

      // Wait for queued request to process
      await thirdPromise;

      expect(limiter.getStatus().queueSize).toBe(0);

      limiter.release();
      limiter.destroy();
    });

    it('should enforce max concurrent limit', () => {
      const limiter = new RateLimiter({
        maxTokens: 10,
        refillIntervalMs: 1000,
        maxConcurrent: 3,
      });

      const status = limiter.getStatus();
      expect(status.maxConcurrent).toBe(3);

      limiter.destroy();
    });

    it('should refill tokens after interval', async () => {
      const limiter = new RateLimiter({
        maxTokens: 5,
        refillIntervalMs: 100,
        maxConcurrent: 5,
      });

      // Exhaust tokens
      await limiter.acquire();
      await limiter.acquire();
      await limiter.acquire();

      expect(limiter.getStatus().tokens).toBe(2);

      // Wait for refill
      await new Promise((resolve) => setTimeout(resolve, 150));

      const status = limiter.getStatus();
      expect(status.tokens).toBe(5); // Should be fully refilled

      limiter.release();
      limiter.release();
      limiter.release();
      limiter.destroy();
    });
  });

  describe('execute helper', () => {
    it('should execute function with rate limiting', async () => {
      const limiter = new RateLimiter({
        maxTokens: 5,
        refillIntervalMs: 10000,
        maxConcurrent: 5,
      });

      let fnCalled = false;
      const mockFn = async () => {
        fnCalled = true;
        return 'result';
      };

      const result = await limiter.execute(mockFn);

      expect(result).toBe('result');
      expect(fnCalled).toBe(true);

      limiter.destroy();
    });

    it('should release token even if function throws', async () => {
      const limiter = new RateLimiter({
        maxTokens: 5,
        refillIntervalMs: 10000,
        maxConcurrent: 5,
      });

      const mockFn = async () => {
        throw new Error('Test error');
      };

      await expect(limiter.execute(mockFn)).rejects.toThrow('Test error');

      // Token should be released
      const status = limiter.getStatus();
      expect(status.activeRequests).toBe(0);

      limiter.destroy();
    });
  });

  describe('getStatus', () => {
    it('should return current rate limiter status', () => {
      const limiter = new RateLimiter({
        maxTokens: 10,
        refillIntervalMs: 10000,
        maxConcurrent: 5,
      });

      const status = limiter.getStatus();

      expect(status.tokens).toBe(10);
      expect(status.maxTokens).toBe(10);
      expect(status.queueSize).toBe(0);
      expect(status.activeRequests).toBe(0);
      expect(status.maxConcurrent).toBe(5);

      limiter.destroy();
    });
  });

  describe('destroy', () => {
    it('should clean up timers and reject queued requests', async () => {
      const limiter = new RateLimiter({
        maxTokens: 1,
        refillIntervalMs: 10000,
        maxConcurrent: 1,
      });

      // Exhaust tokens and queue requests
      await limiter.acquire();
      const queuedPromise = limiter.acquire();

      limiter.destroy();

      await expect(queuedPromise).rejects.toThrow('Rate limiter destroyed');

      limiter.release();
    });
  });

  describe('createHubSpotRateLimiter', () => {
    it('should create rate limiter with HubSpot defaults', () => {
      const limiter = createHubSpotRateLimiter();

      const status = limiter.getStatus();
      expect(status.maxTokens).toBe(100);
      expect(status.maxConcurrent).toBe(10);

      limiter.destroy();
    });

    it('should allow overriding defaults', () => {
      const limiter = createHubSpotRateLimiter({
        maxTokens: 50,
        maxConcurrent: 5,
      });

      const status = limiter.getStatus();
      expect(status.maxTokens).toBe(50);
      expect(status.maxConcurrent).toBe(5);

      limiter.destroy();
    });
  });
});
