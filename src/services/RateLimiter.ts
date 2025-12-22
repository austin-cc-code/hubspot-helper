/**
 * Rate Limiter using Token Bucket Algorithm
 *
 * HubSpot API limit: 100 requests per 10 seconds (rolling window)
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('rate-limiter');

export interface RateLimiterConfig {
  maxTokens: number; // Max tokens in bucket (100 for HubSpot)
  refillIntervalMs: number; // Time to refill bucket (10000ms for HubSpot)
  maxConcurrent: number; // Max concurrent requests (burst limit)
}

interface QueuedRequest {
  resolve: () => void;
  reject: (error: Error) => void;
  timestamp: number;
}

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private queue: QueuedRequest[] = [];
  private activeRequests = 0;
  private refillTimer: NodeJS.Timeout | null = null;

  constructor(private config: RateLimiterConfig) {
    this.tokens = config.maxTokens;
    this.lastRefill = Date.now();
    this.startRefillTimer();
  }

  /**
   * Wait for a token to become available
   */
  async acquire(): Promise<void> {
    // Check if we have tokens and haven't hit concurrent limit
    if (this.tokens > 0 && this.activeRequests < this.config.maxConcurrent) {
      this.tokens--;
      this.activeRequests++;
      logger.debug(
        { tokens: this.tokens, active: this.activeRequests },
        'Token acquired'
      );
      return Promise.resolve();
    }

    // Queue the request
    logger.debug(
      { queueSize: this.queue.length, tokens: this.tokens, active: this.activeRequests },
      'Queuing request'
    );

    return new Promise((resolve, reject) => {
      this.queue.push({
        resolve,
        reject,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Release a token (call after request completes)
   */
  release(): void {
    this.activeRequests--;
    logger.debug(
      { tokens: this.tokens, active: this.activeRequests },
      'Token released'
    );

    // Process queue if possible
    this.processQueue();
  }

  /**
   * Get current rate limit status
   */
  getStatus(): {
    tokens: number;
    maxTokens: number;
    queueSize: number;
    activeRequests: number;
    maxConcurrent: number;
  } {
    return {
      tokens: this.tokens,
      maxTokens: this.config.maxTokens,
      queueSize: this.queue.length,
      activeRequests: this.activeRequests,
      maxConcurrent: this.config.maxConcurrent,
    };
  }

  /**
   * Start automatic token refill timer
   */
  private startRefillTimer(): void {
    this.refillTimer = setInterval(() => {
      this.refillTokens();
    }, this.config.refillIntervalMs);
  }

  /**
   * Refill tokens to maximum
   */
  private refillTokens(): void {
    const now = Date.now();
    const timeSinceRefill = now - this.lastRefill;

    if (timeSinceRefill >= this.config.refillIntervalMs) {
      const oldTokens = this.tokens;
      this.tokens = this.config.maxTokens;
      this.lastRefill = now;

      logger.debug(
        { oldTokens, newTokens: this.tokens, queueSize: this.queue.length },
        'Tokens refilled'
      );

      // Process queued requests
      this.processQueue();
    }
  }

  /**
   * Process queued requests if tokens are available
   */
  private processQueue(): void {
    while (
      this.queue.length > 0 &&
      this.tokens > 0 &&
      this.activeRequests < this.config.maxConcurrent
    ) {
      const request = this.queue.shift();
      if (request) {
        this.tokens--;
        this.activeRequests++;
        request.resolve();

        logger.debug(
          {
            tokens: this.tokens,
            active: this.activeRequests,
            remaining: this.queue.length,
          },
          'Processed queued request'
        );
      }
    }
  }

  /**
   * Clean up timer
   */
  destroy(): void {
    if (this.refillTimer) {
      clearInterval(this.refillTimer);
      this.refillTimer = null;
    }

    // Reject all queued requests
    while (this.queue.length > 0) {
      const request = this.queue.shift();
      if (request) {
        request.reject(new Error('Rate limiter destroyed'));
      }
    }
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

/**
 * Create rate limiter with HubSpot defaults
 */
export function createHubSpotRateLimiter(
  overrides?: Partial<RateLimiterConfig>
): RateLimiter {
  return new RateLimiter({
    maxTokens: 100, // HubSpot: 100 requests per 10 seconds
    refillIntervalMs: 10000, // 10 seconds
    maxConcurrent: 10, // Reasonable burst limit
    ...overrides,
  });
}
