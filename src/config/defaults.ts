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
