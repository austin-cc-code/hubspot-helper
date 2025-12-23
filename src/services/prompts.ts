/**
 * Prompt Templates for Claude Analysis
 *
 * Builds context-aware prompts for different analysis types
 */

import type { Config } from '../config/schema.js';
import type { Contact, Company, Deal } from '../types/hubspot.js';

/**
 * Build system prompt with company context and ICP
 */
export function buildSystemPrompt(config: Config): string {
  const { company, icp, rules } = config;

  return `You are an AI data analyst helping ${company.name} clean and optimize their HubSpot CRM data.

## Company Context
- **Industry**: ${company.industry}
- **Business Model**: ${company.business_model}
- **Ideal Customer Profile**:
  ${icp.company_sizes && icp.company_sizes.length > 0 ? `- Company Sizes: ${icp.company_sizes.join(', ')}` : ''}
  ${icp.industries && icp.industries.length > 0 ? `- Industries: ${icp.industries.join(', ')}` : ''}
  ${icp.job_titles && icp.job_titles.length > 0 ? `- Job Titles: ${icp.job_titles.join(', ')}` : ''}

## Data Quality Standards
- **Required Contact Fields**: ${rules.required_contact_fields.join(', ')}
- **Required Company Fields**: ${rules.required_company_fields.join(', ')}
- **Stale Contact Threshold**: ${rules.stale_contact_days} days without activity
- **Minimum Engagement Period**: ${rules.min_engagement_months} months

## Your Role
Analyze the provided HubSpot data and identify actionable issues. Focus on:
1. **Data Quality**: Missing required fields, formatting issues, typos, anomalies
2. **Business Relevance**: Alignment with ICP, contact/company fit
3. **Actionability**: Clear, specific recommendations with high confidence

Use the provided tools to report your findings in structured format.`;
}

/**
 * Build data quality analysis prompt
 */
export function buildDataQualityPrompt(
  contacts: Contact[],
  _config: Config
): string {
  const contactCount = contacts.length;

  return `Analyze these ${contactCount} contacts for data quality issues.

## Task
1. Review each contact's data against our quality standards
2. Identify issues: missing required fields, formatting problems, typos, anomalies
3. Prioritize by severity (high/medium/low) and business impact
4. Provide specific, actionable recommendations

## Contacts to Analyze
${JSON.stringify(contacts, null, 2)}

## Analysis Guidelines
- **High Severity**: Missing critical fields (email, name), invalid formats, duplicate entries
- **Medium Severity**: Missing optional fields that impact sales (phone, company, title), minor formatting issues
- **Low Severity**: Outdated information, minor typos, inconsistent casing

Look for patterns across records. If multiple contacts have the same issue, note it in the patterns field.

Use the **report_data_quality_issues** tool to report your findings.`;
}

/**
 * Build duplicate detection prompt
 */
export function buildDuplicateDetectionPrompt(
  contacts: Contact[],
  _config: Config
): string {
  const contactCount = contacts.length;

  return `Analyze these ${contactCount} contacts to identify potential duplicates.

## Task
1. Compare contacts across multiple dimensions:
   - Email addresses (exact match = definite duplicate)
   - Names (fuzzy match, accounting for typos and formatting)
   - Phone numbers (normalize formats before comparing)
   - Company + Job Title combinations
2. Group potential duplicates into sets
3. Recommend which contact should be the primary (most complete, most recent)
4. Suggest merge strategy for each duplicate set

## Contacts to Analyze
${JSON.stringify(contacts, null, 2)}

## Duplicate Detection Rules
- **High Confidence**: Same email address OR same normalized phone + similar name
- **Medium Confidence**: Same name + same company OR very similar name (edit distance ≤ 2)
- **Low Confidence**: Similar name OR same phone with different names

## Merge Strategy Guidelines
- Keep the contact with the most complete data (fewer null fields)
- Prefer contacts with recent activity (lastmodifieddate)
- If one contact is associated with more deals/companies, keep that one
- Recommend merging additional fields from secondary contacts before deletion

⚠️ **IMPORTANT**: Merges are **irreversible** in HubSpot. Be conservative with confidence levels.

Use the **report_duplicates** tool to report your findings.`;
}

/**
 * Build property usage analysis prompt
 */
export function buildPropertyAnalysisPrompt(
  contacts: Contact[],
  allProperties: string[],
  config: Config
): string {
  const contactCount = contacts.length;

  return `Analyze property usage across ${contactCount} contacts.

## Task
1. For each property, calculate:
   - Usage rate (% of contacts with non-null value)
   - Data quality (consistency, format correctness)
2. Identify:
   - Unused or rarely used properties (candidates for deprecation)
   - Properties with inconsistent data (need cleanup)
   - Properties that could be consolidated (duplicates or similar purposes)
   - Missing properties that would be valuable (based on ICP and business model)

## Available Properties
${allProperties.join(', ')}

## Contact Data Sample
${JSON.stringify(contacts.slice(0, 10), null, 2)}
(Showing first 10 of ${contactCount} contacts)

## Analysis Guidelines
- **Keep**: Usage rate > 50% AND good data quality
- **Consolidate**: Multiple properties serving similar purpose (e.g., "phone", "phone_number", "mobile")
- **Deprecate**: Usage rate < 10% AND not in required_fields
- **Rename**: Inconsistent naming or unclear purpose

Consider our business model (${config.company.business_model}) and ICP when recommending new properties.

Use the **report_property_analysis** tool to report your findings.`;
}

/**
 * Build general analysis prompt (exploratory mode)
 */
export function buildExploratoryPrompt(
  data: Contact[] | Company[] | Deal[],
  dataType: 'contacts' | 'companies' | 'deals',
  _config: Config
): string {
  const recordCount = data.length;

  return `Perform comprehensive analysis of ${recordCount} ${dataType} records.

## Task
Explore this HubSpot data and provide strategic insights:
1. **Data Quality**: Overall health, common issues, improvement opportunities
2. **Business Insights**: Patterns relevant to our business model and ICP
3. **Optimization Opportunities**: Quick wins and longer-term improvements
4. **Risk Areas**: Data that could cause problems if not addressed

## Data to Analyze
${JSON.stringify(data, null, 2)}

## Analysis Approach
- Start with high-level patterns and statistics
- Drill into specific issues as needed
- Consider business context (not just technical correctness)
- Prioritize by impact and ease of implementation

Use the **report_analysis_summary** tool to report your findings.`;
}

/**
 * Build follow-up prompt for iterative analysis
 */
export function buildFollowUpPrompt(
  previousAnalysis: any,
  question: string
): string {
  return `Based on your previous analysis:

${JSON.stringify(previousAnalysis, null, 2)}

## Follow-up Question
${question}

Please provide additional insights or refinements using the appropriate tool.`;
}

/**
 * Build prompt for specific issue investigation
 */
export function buildInvestigationPrompt(
  issueType: string,
  affectedRecords: any[],
  config: Config
): string {
  return `Investigate this specific data quality issue in depth.

## Issue Type
${issueType}

## Affected Records
${JSON.stringify(affectedRecords, null, 2)}

## Investigation Tasks
1. Determine root cause of the issue
2. Assess impact on business operations
3. Recommend specific fix approach
4. Identify any similar issues to watch for

Consider our business context:
- Industry: ${config.company.industry}
- Business Model: ${config.company.business_model}

Use the appropriate reporting tool based on the issue type.`;
}
