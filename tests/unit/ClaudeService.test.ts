/**
 * Unit tests for ClaudeService
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ClaudeService } from '../../src/services/ClaudeService.js';
import type {
  ClaudeConfig,
  AnalysisMode,
  AnalysisContext,
  CostEstimate,
} from '../../src/types/claude.js';
import type { Config } from '../../src/config/schema.js';

describe('ClaudeService', () => {
  let service: ClaudeService;
  let config: ClaudeConfig;

  beforeEach(() => {
    config = {
      apiKey: 'test-api-key',
      model: 'claude-sonnet-4-20250514',
      maxTokensPerRequest: 4096,
      enableExtendedThinking: true,
      enableToolUse: true,
      enableMultiTurn: true,
      maxThinkingTokens: 4000,
      maxToolCalls: 5,
      maxConversationTurns: 2,
      monthlyBudgetUsd: undefined,
      fallbackToRulesOnly: true,
      maxRetries: 3,
      timeoutMs: 60000,
    };

    service = new ClaudeService(config);
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(service).toBeDefined();
      const stats = service.getUsageStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.estimatedCostUsd).toBe(0);
    });

    it('should initialize usage stats for all modes', () => {
      const stats = service.getUsageStats();
      expect(stats.byMode.simple).toBeDefined();
      expect(stats.byMode.reasoning).toBeDefined();
      expect(stats.byMode.exploratory).toBeDefined();
      expect(stats.byMode.iterative).toBeDefined();
    });
  });

  describe('fromConfig', () => {
    it('should create service from app config', () => {
      const appConfig: Config = {
        hubspot: {
          access_token: 'test-token',
          portal_id: '12345',
          environment: 'production',
        },
        anthropic: {
          api_key: 'test-anthropic-key',
          model: 'claude-sonnet-4-20250514',
          max_tokens_per_request: 4096,
          max_thinking_tokens: 4000,
          enable_extended_thinking: true,
          enable_tool_use: true,
          enable_multi_turn: true,
          max_tool_calls: 5,
          max_conversation_turns: 2,
          monthly_budget_usd: 100,
          fallback_to_rules_only: true,
          max_retries: 3,
          timeout_ms: 60000,
        },
        company: {
          name: 'Test Corp',
          industry: 'Technology',
          business_model: 'B2B',
        },
        icp: {
          company_sizes: ['1-50', '51-200'],
          industries: ['Technology', 'SaaS'],
          job_titles: ['CEO', 'CTO'],
        },
        rules: {
          required_contact_fields: ['email', 'firstname', 'lastname'],
          required_company_fields: ['name', 'domain'],
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

      const configService = ClaudeService.fromConfig(appConfig);
      expect(configService).toBeDefined();
    });

    it('should throw error if API key is missing', () => {
      const appConfig: Config = {
        hubspot: {
          access_token: 'test-token',
          portal_id: '12345',
          environment: 'production',
        },
        anthropic: {
          model: 'claude-sonnet-4-20250514',
          max_tokens_per_request: 4096,
          max_thinking_tokens: 4000,
          enable_extended_thinking: true,
          enable_tool_use: true,
          enable_multi_turn: true,
          max_tool_calls: 5,
          max_conversation_turns: 2,
          fallback_to_rules_only: true,
          max_retries: 3,
          timeout_ms: 60000,
        },
        company: {
          name: 'Test Corp',
          industry: 'Technology',
          business_model: 'B2B',
        },
        icp: {
          company_sizes: [],
          industries: [],
          job_titles: [],
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

      // Clear env var to ensure it fails
      const originalEnv = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => ClaudeService.fromConfig(appConfig)).toThrow(
        'Anthropic API key not found'
      );

      // Restore env var
      if (originalEnv) {
        process.env.ANTHROPIC_API_KEY = originalEnv;
      }
    });
  });

  describe('selectAnalysisMode', () => {
    it('should select simple mode for obvious cases', () => {
      const context: AnalysisContext = {
        isObvious: true,
        highConfidence: true,
        requiresReasoning: false,
        mediumComplexity: false,
        requiresContext: false,
        highImpact: false,
        strategic: false,
        multiFactored: false,
      };

      const mode = service.selectAnalysisMode(context);
      expect(mode).toBe('simple');
    });

    it('should select reasoning mode for ambiguous cases', () => {
      const context: AnalysisContext = {
        isObvious: false,
        highConfidence: false,
        requiresReasoning: true,
        mediumComplexity: true,
        requiresContext: false,
        highImpact: false,
        strategic: false,
        multiFactored: false,
      };

      const mode = service.selectAnalysisMode(context);
      expect(mode).toBe('reasoning');
    });

    it('should select exploratory mode for business judgment', () => {
      const context: AnalysisContext = {
        isObvious: false,
        highConfidence: false,
        requiresReasoning: false,
        mediumComplexity: false,
        requiresContext: true,
        highImpact: true,
        strategic: false,
        multiFactored: false,
      };

      const mode = service.selectAnalysisMode(context);
      expect(mode).toBe('exploratory');
    });

    it('should select iterative mode for strategic decisions', () => {
      const context: AnalysisContext = {
        isObvious: false,
        highConfidence: false,
        requiresReasoning: false,
        mediumComplexity: false,
        requiresContext: false,
        highImpact: false,
        strategic: true,
        multiFactored: true,
      };

      const mode = service.selectAnalysisMode(context);
      expect(mode).toBe('iterative');
    });

    it('should default to simple mode for unclear context', () => {
      const context: AnalysisContext = {
        isObvious: false,
        highConfidence: false,
        requiresReasoning: false,
        mediumComplexity: false,
        requiresContext: false,
        highImpact: false,
        strategic: false,
        multiFactored: false,
      };

      const mode = service.selectAnalysisMode(context);
      expect(mode).toBe('simple');
    });
  });

  describe('estimateCost', () => {
    it('should calculate cost correctly for Sonnet 4', () => {
      const estimate = service.estimateCost(1000000, 500000, 200000, 'reasoning');

      expect(estimate.inputTokens).toBe(1000000);
      expect(estimate.outputTokens).toBe(500000);
      expect(estimate.thinkingTokens).toBe(200000);

      // Sonnet 4: $3/MTok input, $15/MTok output, $3/MTok thinking
      expect(estimate.breakdown.inputCost).toBeCloseTo(3.0);
      expect(estimate.breakdown.outputCost).toBeCloseTo(7.5);
      expect(estimate.breakdown.thinkingCost).toBeCloseTo(0.6);
      expect(estimate.totalCostUsd).toBeCloseTo(11.1);
    });

    it('should calculate cost correctly for Haiku', () => {
      const haikuService = new ClaudeService({
        ...config,
        model: 'claude-3-haiku-20240307',
      });

      const estimate = haikuService.estimateCost(1000000, 500000, 200000, 'simple');

      // Haiku: $0.25/MTok input, $1.25/MTok output, $0.25/MTok thinking
      expect(estimate.breakdown.inputCost).toBe(0.25);
      expect(estimate.breakdown.outputCost).toBe(0.625);
      expect(estimate.breakdown.thinkingCost).toBe(0.05);
      expect(estimate.totalCostUsd).toBeCloseTo(0.925);
    });

    it('should handle zero thinking tokens', () => {
      const estimate = service.estimateCost(1000000, 500000, 0, 'simple');

      expect(estimate.thinkingTokens).toBe(0);
      expect(estimate.breakdown.thinkingCost).toBe(0);
      expect(estimate.totalCostUsd).toBe(10.5); // Only input + output
    });
  });

  describe('getUsageStats', () => {
    it('should return copy of usage stats', () => {
      const stats1 = service.getUsageStats();
      const stats2 = service.getUsageStats();

      expect(stats1).not.toBe(stats2); // Different objects
      expect(stats1).toEqual(stats2); // Same values
    });

    it('should have zero stats initially', () => {
      const stats = service.getUsageStats();

      expect(stats.totalInputTokens).toBe(0);
      expect(stats.totalOutputTokens).toBe(0);
      expect(stats.totalThinkingTokens).toBe(0);
      expect(stats.totalToolCalls).toBe(0);
      expect(stats.totalRequests).toBe(0);
      expect(stats.estimatedCostUsd).toBe(0);
    });

    it('should track stats by operation and mode', () => {
      const stats = service.getUsageStats();

      expect(stats.byOperation).toEqual({});
      expect(stats.byMode.simple.requests).toBe(0);
      expect(stats.byMode.reasoning.requests).toBe(0);
      expect(stats.byMode.exploratory.requests).toBe(0);
      expect(stats.byMode.iterative.requests).toBe(0);
    });
  });

  describe('resetUsageStats', () => {
    it('should reset all stats to zero', () => {
      // Stats start at zero, but let's verify reset still works
      service.resetUsageStats();

      const stats = service.getUsageStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.estimatedCostUsd).toBe(0);
    });
  });
});
