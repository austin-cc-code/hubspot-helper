/**
 * HubSpotService Unit Tests
 *
 * Tests HubSpot service configuration, factory methods, and utility functions
 */

import { HubSpotService } from '../../src/services/HubSpotService.js';
import { RateLimiter } from '../../src/services/RateLimiter.js';
import { CacheService } from '../../src/services/CacheService.js';
import type { Config } from '../../src/config/schema.js';

describe('HubSpotService', () => {
  let service: HubSpotService;
  let rateLimiter: RateLimiter;
  let cache: CacheService;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      maxTokens: 100,
      refillIntervalMs: 10000,
      maxConcurrent: 10,
    });
    cache = new CacheService(30);

    service = new HubSpotService({
      accessToken: 'test-token',
      rateLimiter,
      cache,
      maxRetries: 3,
    });
  });

  afterEach(() => {
    service.destroy();
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(service).toBeInstanceOf(HubSpotService);
      expect(service.getRateLimiterStatus().maxTokens).toBe(100);
    });

    it('should use default rate limiter if not provided', () => {
      const defaultService = new HubSpotService({
        accessToken: 'test-token',
      });

      expect(defaultService.getRateLimiterStatus().maxTokens).toBe(100);
      expect(defaultService.getRateLimiterStatus().maxConcurrent).toBe(10);

      defaultService.destroy();
    });

    it('should use default cache if not provided', () => {
      const defaultService = new HubSpotService({
        accessToken: 'test-token',
      });

      expect(defaultService.getCacheStats().size).toBe(0);

      defaultService.destroy();
    });

    it('should use default maxRetries if not provided', () => {
      const defaultService = new HubSpotService({
        accessToken: 'test-token',
      });

      expect(defaultService).toBeInstanceOf(HubSpotService);

      defaultService.destroy();
    });
  });

  describe('fromConfig', () => {
    it('should create service from config object', () => {
      const config: Config = {
        hubspot: {
          access_token: 'config-token',
        },
        anthropic: {
          api_key: 'test-key',
        },
        company: {
          name: 'Test Company',
          industry: 'Technology',
          business_model: 'B2B',
        },
        icp: {
          company_sizes: ['1-50'],
          industries: ['Tech'],
          job_titles: ['CEO'],
        },
        rules: {
          required_contact_fields: ['email'],
          required_company_fields: ['name'],
          stale_contact_days: 365,
          min_engagement_months: 12,
          industry_mappings: {},
        },
        settings: {
          batch_size: 100,
          rate_limit: {
            requests_per_10_seconds: 50,
            burst_limit: 5,
            retry_after_429: true,
          },
          cache_ttl_minutes: 15,
          output_directory: './audit-reports',
        },
        security: {
          mask_pii_in_logs: true,
          credential_storage: 'env',
        },
      };

      const configService = HubSpotService.fromConfig(config);
      expect(configService.getRateLimiterStatus().maxTokens).toBe(50);
      expect(configService.getRateLimiterStatus().maxConcurrent).toBe(5);

      configService.destroy();
    });

    it('should fall back to environment variable', () => {
      process.env.HUBSPOT_ACCESS_TOKEN = 'env-token';

      const config: Config = {
        hubspot: {},
        anthropic: {
          api_key: 'test-key',
        },
        company: {
          name: 'Test Company',
          industry: 'Technology',
          business_model: 'B2B',
        },
        icp: {
          company_sizes: ['1-50'],
          industries: ['Tech'],
          job_titles: ['CEO'],
        },
        rules: {
          required_contact_fields: ['email'],
          required_company_fields: ['name'],
          stale_contact_days: 365,
          min_engagement_months: 12,
          industry_mappings: {},
        },
        settings: {
          batch_size: 100,
          rate_limit: {
            requests_per_10_seconds: 100,
            burst_limit: 10,
            retry_after_429: true,
          },
          cache_ttl_minutes: 30,
          output_directory: './audit-reports',
        },
        security: {
          mask_pii_in_logs: true,
          credential_storage: 'env',
        },
      };

      const envService = HubSpotService.fromConfig(config);
      expect(envService).toBeInstanceOf(HubSpotService);

      envService.destroy();
      delete process.env.HUBSPOT_ACCESS_TOKEN;
    });

    it('should throw error if no access token', () => {
      const config: Config = {
        hubspot: {},
        anthropic: {
          api_key: 'test-key',
        },
        company: {
          name: 'Test Company',
          industry: 'Technology',
          business_model: 'B2B',
        },
        icp: {
          company_sizes: ['1-50'],
          industries: ['Tech'],
          job_titles: ['CEO'],
        },
        rules: {
          required_contact_fields: ['email'],
          required_company_fields: ['name'],
          stale_contact_days: 365,
          min_engagement_months: 12,
          industry_mappings: {},
        },
        settings: {
          batch_size: 100,
          rate_limit: {
            requests_per_10_seconds: 100,
            burst_limit: 10,
            retry_after_429: true,
          },
          cache_ttl_minutes: 30,
          output_directory: './audit-reports',
        },
        security: {
          mask_pii_in_logs: true,
          credential_storage: 'env',
        },
      };

      expect(() => HubSpotService.fromConfig(config)).toThrow('access token not found');
    });
  });

  describe('utility methods', () => {
    describe('getRateLimiterStatus', () => {
      it('should return rate limiter status', () => {
        const status = service.getRateLimiterStatus();

        expect(status.maxTokens).toBe(100);
        expect(status.tokens).toBe(100);
        expect(status.maxConcurrent).toBe(10);
        expect(status.activeRequests).toBe(0);
        expect(status.queueSize).toBe(0);
      });
    });

    describe('getCacheStats', () => {
      it('should return cache statistics', () => {
        const stats = service.getCacheStats();

        expect(stats.size).toBeGreaterThanOrEqual(0);
        expect(stats).toHaveProperty('expired');
      });
    });

    describe('clearCache', () => {
      it('should clear the cache', () => {
        // Set something in cache first
        cache.set('test', 'value');
        expect(cache.get('test')).toBe('value');

        service.clearCache();

        expect(service.getCacheStats().size).toBe(0);
        expect(cache.get('test')).toBeNull();
      });
    });

    describe('destroy', () => {
      it('should cleanup resources', () => {
        const testService = new HubSpotService({
          accessToken: 'test',
        });

        // Should not throw
        testService.destroy();

        // After destroy, status methods should still work
        expect(() => testService.getRateLimiterStatus()).not.toThrow();
        expect(() => testService.getCacheStats()).not.toThrow();
      });

      it('should clear cache on destroy', () => {
        const testCache = new CacheService(30);
        testCache.set('test', 'value');

        const testService = new HubSpotService({
          accessToken: 'test',
          cache: testCache,
        });

        expect(testCache.get('test')).toBe('value');

        testService.destroy();

        expect(testCache.get('test')).toBeNull();
      });
    });
  });

  describe('rate limiter integration', () => {
    it('should use provided rate limiter', () => {
      const customRateLimiter = new RateLimiter({
        maxTokens: 50,
        refillIntervalMs: 5000,
        maxConcurrent: 5,
      });

      const customService = new HubSpotService({
        accessToken: 'test',
        rateLimiter: customRateLimiter,
      });

      const status = customService.getRateLimiterStatus();
      expect(status.maxTokens).toBe(50);
      expect(status.maxConcurrent).toBe(5);

      customService.destroy();
      customRateLimiter.destroy();
    });
  });

  describe('cache integration', () => {
    it('should use provided cache', () => {
      const customCache = new CacheService(60); // 60 minute TTL
      customCache.set('test-key', 'test-value');

      const customService = new HubSpotService({
        accessToken: 'test',
        cache: customCache,
      });

      const stats = customService.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);

      customService.destroy();
    });
  });
});
