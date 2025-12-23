/**
 * DataQualityAudit Unit Tests (Epic 6)
 *
 * Tests the two-phase data quality audit system
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DataQualityAudit } from '../../src/audits/DataQualityAudit.js';
import type { AuditContext, ProgressReporter } from '../../src/types/audit.js';
import type { Config } from '../../src/config/schema.js';
import type { Contact } from '../../src/types/hubspot.js';
import type { HubSpotService } from '../../src/services/HubSpotService.js';
import type { ClaudeService } from '../../src/services/ClaudeService.js';

// Mock progress reporter
const mockProgress: ProgressReporter = {
  start: jest.fn(),
  update: jest.fn(),
  succeed: jest.fn(),
  fail: jest.fn(),
  info: jest.fn(),
};

// Mock config
const mockConfig: Config = {
  hubspot: {
    access_token: 'test-token',
    environment: 'production',
  },
  anthropic: {
    api_key: 'test-api-key',
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
    name: 'Test Company',
    industry: 'Technology',
    business_model: 'B2B',
  },
  icp: {
    company_sizes: [],
    industries: [],
    job_titles: [],
  },
  rules: {
    required_contact_fields: ['email', 'firstname', 'lastname'],
    required_company_fields: ['name', 'domain'],
    stale_contact_days: 365,
    min_engagement_months: 12,
    industry_mappings: {},
  },
  data_quality: {
    enable_ambiguous_analysis: true,
    max_ai_cost_per_audit: 2.0,
    min_ambiguous_cases_for_ai: 10,
    max_ambiguous_cases_per_run: 100,
    analyze_name_typos: true,
    analyze_semantic_anomalies: true,
    analyze_cross_record_patterns: false,
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

// Mock contact data
const createMockContact = (overrides: Partial<Contact> = {}): Contact => ({
  id: 'test-contact-1',
  properties: {
    email: 'test@example.com',
    firstname: 'John',
    lastname: 'Doe',
    ...overrides.properties,
  },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  archived: false,
  ...overrides,
});

describe('DataQualityAudit', () => {
  let audit: DataQualityAudit;
  let mockHubSpot: jest.Mocked<HubSpotService>;
  let mockClaude: jest.Mocked<ClaudeService>;
  let context: AuditContext;

  beforeEach(() => {
    audit = new DataQualityAudit();

    // Create mocked HubSpot service
    mockHubSpot = {
      getContacts: jest.fn(),
      getRateLimiterStatus: jest.fn(),
      getCacheStats: jest.fn(),
      destroy: jest.fn(),
    } as any;

    // Create mocked Claude service
    mockClaude = {
      analyzeWithReasoning: jest.fn(),
      analyzeWithExploration: jest.fn(),
      getUsageStats: jest.fn(),
      estimateCost: jest.fn(),
    } as any;

    // Create context
    context = {
      hubspot: mockHubSpot,
      claude: mockClaude,
      config: mockConfig,
      progress: mockProgress,
    };
  });

  describe('initialization', () => {
    it('should have correct name and description', () => {
      expect(audit.name).toBe('data-quality');
      expect(audit.description).toContain('two-phase');
    });
  });

  describe('rule-based checks', () => {
    it('should detect missing required fields', async () => {
      const contacts = [
        createMockContact({
          properties: {
            email: 'test@example.com',
            // Missing firstname and lastname
          },
        }),
      ];

      mockHubSpot.getContacts.mockImplementation(async function* () {
        yield contacts;
      });

      mockClaude.getUsageStats.mockReturnValue({
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        totalToolCalls: 0,
        totalRequests: 0,
        estimatedCostUsd: 0,
        byOperation: {},
        byMode: {
          simple: {
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            thinkingTokens: 0,
            toolCalls: 0,
            costUsd: 0,
            errors: 0,
          },
          reasoning: {
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            thinkingTokens: 0,
            toolCalls: 0,
            costUsd: 0,
            errors: 0,
          },
          exploratory: {
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            thinkingTokens: 0,
            toolCalls: 0,
            costUsd: 0,
            errors: 0,
          },
          iterative: {
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            thinkingTokens: 0,
            toolCalls: 0,
            costUsd: 0,
            errors: 0,
          },
        },
      });

      const result = await audit.run(context);

      expect(result.issues.length).toBeGreaterThan(0);
      const missingFieldIssues = result.issues.filter(
        (i) => i.type === 'missing_required_field'
      );
      expect(missingFieldIssues.length).toBe(2); // firstname and lastname
      expect(missingFieldIssues[0].detection_method).toBe('rule');
      expect(missingFieldIssues[0].confidence).toBe('high');
    });

    it('should detect invalid email format', async () => {
      const contacts = [
        createMockContact({
          properties: {
            email: 'invalid-email',
            firstname: 'John',
            lastname: 'Doe',
          },
        }),
      ];

      mockHubSpot.getContacts.mockImplementation(async function* () {
        yield contacts;
      });

      mockClaude.getUsageStats.mockReturnValue({
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        totalToolCalls: 0,
        totalRequests: 0,
        estimatedCostUsd: 0,
        byOperation: {},
        byMode: {
          simple: {
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            thinkingTokens: 0,
            toolCalls: 0,
            costUsd: 0,
            errors: 0,
          },
          reasoning: {
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            thinkingTokens: 0,
            toolCalls: 0,
            costUsd: 0,
            errors: 0,
          },
          exploratory: {
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            thinkingTokens: 0,
            toolCalls: 0,
            costUsd: 0,
            errors: 0,
          },
          iterative: {
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            thinkingTokens: 0,
            toolCalls: 0,
            costUsd: 0,
            errors: 0,
          },
        },
      });

      const result = await audit.run(context);

      const emailIssues = result.issues.filter((i) => i.type === 'invalid_email_format');
      expect(emailIssues.length).toBe(1);
      expect(emailIssues[0].severity).toBe('high');
      expect(emailIssues[0].detection_method).toBe('rule');
      expect(emailIssues[0].confidence).toBe('high');
    });

    it('should detect invalid phone format', async () => {
      const contacts = [
        createMockContact({
          properties: {
            email: 'test@example.com',
            firstname: 'John',
            lastname: 'Doe',
            phone: '123', // Too short
          },
        }),
      ];

      mockHubSpot.getContacts.mockImplementation(async function* () {
        yield contacts;
      });

      mockClaude.getUsageStats.mockReturnValue({
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        totalToolCalls: 0,
        totalRequests: 0,
        estimatedCostUsd: 0,
        byOperation: {},
        byMode: {
          simple: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
          reasoning: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
          exploratory: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
          iterative: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
        },
      });

      const result = await audit.run(context);

      const phoneIssues = result.issues.filter((i) => i.type === 'invalid_phone_format');
      expect(phoneIssues.length).toBe(1);
      expect(phoneIssues[0].severity).toBe('medium');
      expect(phoneIssues[0].detection_method).toBe('rule');
    });

    it('should detect obvious typos (whitespace issues)', async () => {
      const contacts = [
        createMockContact({
          properties: {
            email: 'test@example.com',
            firstname: '  John  ', // Leading/trailing spaces
            lastname: 'Doe  Smith', // Multiple spaces
          },
        }),
      ];

      mockHubSpot.getContacts.mockImplementation(async function* () {
        yield contacts;
      });

      mockClaude.getUsageStats.mockReturnValue({
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        totalToolCalls: 0,
        totalRequests: 0,
        estimatedCostUsd: 0,
        byOperation: {},
        byMode: {
          simple: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
          reasoning: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
          exploratory: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
          iterative: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
        },
      });

      const result = await audit.run(context);

      const typoIssues = result.issues.filter((i) => i.type === 'obvious_typo');
      expect(typoIssues.length).toBeGreaterThan(0);
      expect(typoIssues.every((i) => i.suggestedValue !== undefined)).toBe(true);
    });
  });

  describe('detection method tracking', () => {
    it('should properly track detection methods in summary', async () => {
      const contacts = [
        createMockContact({
          properties: {
            // Missing email - rule-based issue
            firstname: 'John',
            lastname: 'Doe',
          },
        }),
      ];

      mockHubSpot.getContacts.mockImplementation(async function* () {
        yield contacts;
      });

      mockClaude.getUsageStats.mockReturnValue({
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        totalToolCalls: 0,
        totalRequests: 0,
        estimatedCostUsd: 0,
        byOperation: {},
        byMode: {
          simple: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
          reasoning: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
          exploratory: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
          iterative: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
        },
      });

      const result = await audit.run(context);

      expect(result.summary.by_detection_method).toBeDefined();
      expect(result.summary.by_detection_method.rule_based).toBeGreaterThan(0);
      expect(result.summary.by_detection_method.ai_reasoning).toBe(0);
      expect(result.summary.by_detection_method.ai_exploratory).toBe(0);
    });
  });

  describe('AI insights generation', () => {
    it('should generate insights with patterns and recommendations', async () => {
      const contacts = [
        createMockContact({
          properties: {
            email: 'invalid-email',
            firstname: 'John',
            lastname: 'Doe',
          },
        }),
        createMockContact({
          id: 'test-contact-2',
          properties: {
            email: 'another-invalid',
            firstname: 'Jane',
            lastname: 'Smith',
          },
        }),
      ];

      mockHubSpot.getContacts.mockImplementation(async function* () {
        yield contacts;
      });

      mockClaude.getUsageStats.mockReturnValue({
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        totalToolCalls: 0,
        totalRequests: 0,
        estimatedCostUsd: 0,
        byOperation: {},
        byMode: {
          simple: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
          reasoning: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
          exploratory: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
          iterative: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
        },
      });

      const result = await audit.run(context);

      expect(result.ai_insights).toBeDefined();
      expect(result.ai_insights.summary).toBeDefined();
      expect(Array.isArray(result.ai_insights.patterns_detected)).toBe(true);
      expect(Array.isArray(result.ai_insights.recommendations)).toBe(true);
      expect(result.ai_insights.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('cost tracking', () => {
    it('should track AI cost in summary', async () => {
      const contacts = [
        createMockContact({
          properties: {
            email: 'test@example.com',
            firstname: 'John',
            lastname: 'Doe',
          },
        }),
      ];

      mockHubSpot.getContacts.mockImplementation(async function* () {
        yield contacts;
      });

      mockClaude.getUsageStats.mockReturnValue({
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        totalToolCalls: 0,
        totalRequests: 0,
        estimatedCostUsd: 0,
        byOperation: {},
        byMode: {
          simple: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
          reasoning: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
          exploratory: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
          iterative: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
        },
      });

      const result = await audit.run(context);

      expect(result.summary.ai_cost_usd).toBeDefined();
      expect(typeof result.summary.ai_cost_usd).toBe('number');
      expect(result.summary.ai_cost_usd).toBeGreaterThanOrEqual(0);
    });
  });

  describe('result structure', () => {
    it('should return properly structured audit result', async () => {
      const contacts = [createMockContact()];

      mockHubSpot.getContacts.mockImplementation(async function* () {
        yield contacts;
      });

      mockClaude.getUsageStats.mockReturnValue({
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        totalToolCalls: 0,
        totalRequests: 0,
        estimatedCostUsd: 0,
        byOperation: {},
        byMode: {
          simple: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
          reasoning: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
          exploratory: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
          iterative: { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, toolCalls: 0, costUsd: 0, errors: 0 },
        },
      });

      const result = await audit.run(context);

      expect(result.module).toBe('data-quality');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.summary).toBeDefined();
      expect(result.summary.total_records).toBe(1);
      expect(result.issues).toBeInstanceOf(Array);
      expect(result.ai_insights).toBeDefined();
    });
  });
});
