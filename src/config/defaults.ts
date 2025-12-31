/**
 * Default configuration values
 */

import type { Config } from './schema.js';

export const defaultConfig: Omit<Config, 'company'> = {
  hubspot: {
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
  duplicate_detection: {
    enable_exact_matching: true,
    exact_email_match: true,
    exact_phone_and_company_match: true,
    exact_name_and_company_match: true,
    enable_fuzzy_matching: true,
    fuzzy_match_threshold: 0.85,
    max_fuzzy_pairs_for_ai: 100,
    enable_merge_investigation: true,
    max_investigations_per_run: 20,
    min_confidence_for_investigation: 0.5,
    max_ai_cost_per_audit: 5.0,
    normalize_phone_numbers: true,
    default_country_code: 'US',
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
