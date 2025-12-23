/**
 * Zod schema for configuration validation
 */

import { z } from 'zod';

// HubSpot configuration schema
export const hubspotConfigSchema = z.object({
  access_token: z.string().optional(),
  portal_id: z.string().optional(),
  environment: z.enum(['production', 'sandbox']).optional().default('production'),
});

// Anthropic configuration schema
export const anthropicConfigSchema = z.object({
  api_key: z.string().optional(),
  model: z
    .enum(['claude-sonnet-4-20250514', 'claude-3-haiku-20240307'])
    .optional()
    .default('claude-sonnet-4-20250514'),

  // Token limits
  max_tokens_per_request: z.number().int().positive().default(4096),
  max_thinking_tokens: z.number().int().positive().default(4000),

  // Agentic capabilities
  enable_extended_thinking: z.boolean().default(true),
  enable_tool_use: z.boolean().default(true),
  enable_multi_turn: z.boolean().default(true),
  max_tool_calls: z.number().int().positive().default(5),
  max_conversation_turns: z.number().int().positive().default(2),

  // Budget controls
  monthly_budget_usd: z.number().positive().optional(),
  fallback_to_rules_only: z.boolean().default(true),

  // Reliability
  max_retries: z.number().int().nonnegative().default(3),
  timeout_ms: z.number().int().positive().default(60000),
});

// Company context schema
export const companyContextSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  industry: z.string().min(1, 'Industry is required'),
  business_model: z.enum(['B2B', 'B2C', 'B2B2C'], {
    errorMap: () => ({ message: 'Business model must be B2B, B2C, or B2B2C' }),
  }),
});

// Ideal customer profile schema
export const icpSchema = z.object({
  company_sizes: z.array(z.string()).default([]),
  industries: z.array(z.string()).default([]),
  job_titles: z.array(z.string()).default([]),
});

// Data quality rules schema
export const dataQualityRulesSchema = z.object({
  required_contact_fields: z.array(z.string()).default(['email', 'firstname', 'lastname']),
  required_company_fields: z.array(z.string()).default(['name', 'domain']),
  stale_contact_days: z.number().int().positive().default(365),
  min_engagement_months: z.number().int().positive().default(12),
  industry_mappings: z.record(z.string()).default({}),
});

// Data quality AI config schema (Epic 6)
export const dataQualityAiConfigSchema = z.object({
  // Control which AI features to use
  enable_ambiguous_analysis: z.boolean().default(true),
  max_ai_cost_per_audit: z.number().positive().default(2.0),

  // Thresholds for triggering AI analysis
  min_ambiguous_cases_for_ai: z.number().int().positive().default(10),
  max_ambiguous_cases_per_run: z.number().int().positive().default(100),

  // What to analyze with AI
  analyze_name_typos: z.boolean().default(true),
  analyze_semantic_anomalies: z.boolean().default(true),
  analyze_cross_record_patterns: z.boolean().default(false), // Expensive
});

// Rate limit settings schema
export const rateLimitSettingsSchema = z.object({
  requests_per_10_seconds: z.number().int().positive().default(100),
  burst_limit: z.number().int().positive().default(10),
  retry_after_429: z.boolean().default(true),
});

// Audit settings schema
export const auditSettingsSchema = z.object({
  batch_size: z.number().int().positive().max(100).default(100),
  rate_limit: rateLimitSettingsSchema.default({}),
  cache_ttl_minutes: z.number().int().positive().default(30),
  output_directory: z.string().default('./audit-reports'),
});

// Security settings schema
export const securitySettingsSchema = z.object({
  mask_pii_in_logs: z.boolean().default(true),
  credential_storage: z.enum(['env', 'keychain', 'config']).default('env'),
});

// Full config schema
export const configSchema = z.object({
  hubspot: hubspotConfigSchema.default({}),
  anthropic: anthropicConfigSchema.default({}),
  company: companyContextSchema,
  icp: icpSchema.default({}),
  rules: dataQualityRulesSchema.default({}),
  data_quality: dataQualityAiConfigSchema.default({}),
  settings: auditSettingsSchema.default({}),
  security: securitySettingsSchema.default({}),
});

// Partial config schema (for updates)
export const partialConfigSchema = configSchema.deepPartial();

// Type exports (inferred from schemas)
export type Config = z.infer<typeof configSchema>;
export type PartialConfig = z.infer<typeof partialConfigSchema>;
export type HubSpotConfig = z.infer<typeof hubspotConfigSchema>;
export type AnthropicConfig = z.infer<typeof anthropicConfigSchema>;
export type CompanyContext = z.infer<typeof companyContextSchema>;
export type IdealCustomerProfile = z.infer<typeof icpSchema>;
export type DataQualityRules = z.infer<typeof dataQualityRulesSchema>;
export type DataQualityAiConfig = z.infer<typeof dataQualityAiConfigSchema>;
export type RateLimitSettings = z.infer<typeof rateLimitSettingsSchema>;
export type AuditSettings = z.infer<typeof auditSettingsSchema>;
export type SecuritySettings = z.infer<typeof securitySettingsSchema>;
