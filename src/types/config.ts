/**
 * Configuration types for HubSpot CLI Audit Tool
 */

export interface HubSpotConfig {
  access_token?: string;
  portal_id?: string;
  environment?: 'production' | 'sandbox';
}

export interface AnthropicConfig {
  api_key?: string;
  model?: 'claude-sonnet-4-20250514' | 'claude-3-haiku-20240307';
}

export interface CompanyContext {
  name: string;
  industry: string;
  business_model: 'B2B' | 'B2C' | 'B2B2C';
}

export interface IdealCustomerProfile {
  company_sizes: string[];
  industries: string[];
  job_titles: string[];
}

export interface DataQualityRules {
  required_contact_fields: string[];
  required_company_fields: string[];
  stale_contact_days: number;
  min_engagement_months: number;
  industry_mappings: Record<string, string>;
}

export interface RateLimitSettings {
  requests_per_10_seconds: number;
  burst_limit: number;
  retry_after_429: boolean;
}

export interface AuditSettings {
  batch_size: number;
  rate_limit: RateLimitSettings;
  cache_ttl_minutes: number;
  output_directory: string;
}

export interface SecuritySettings {
  mask_pii_in_logs: boolean;
  credential_storage: 'env' | 'keychain' | 'config';
}

export interface Config {
  hubspot: HubSpotConfig;
  anthropic: AnthropicConfig;
  company: CompanyContext;
  icp: IdealCustomerProfile;
  rules: DataQualityRules;
  settings: AuditSettings;
  security: SecuritySettings;
}
