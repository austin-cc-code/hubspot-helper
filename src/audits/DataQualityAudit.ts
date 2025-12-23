/**
 * Data Quality Audit Module (Epic 6)
 *
 * Two-phase analysis approach:
 * Phase 1: Rule-based checks (fast, free, high-confidence)
 * Phase 2: Agentic AI analysis (selective, cost-effective)
 *
 * Detects:
 * - Missing required fields
 * - Invalid formats (email, phone, URL)
 * - Stale contacts
 * - Obvious typos (regex-based)
 * - Ambiguous typos (AI - reasoning mode)
 * - Semantic anomalies (AI - reasoning mode)
 * - Context-dependent issues (AI - exploratory mode)
 * - Cross-record patterns (AI - exploratory mode)
 */

import { randomUUID } from 'crypto';
import { createLogger } from '../utils/logger.js';
import type {
  AuditModule,
  AuditContext,
  AuditResult,
  AuditIssue,
  AuditSummary,
  AIInsights,
  Severity,
  ConfidenceLevel,
} from '../types/audit.js';
import type { Contact } from '../types/hubspot.js';

const logger = createLogger('data-quality-audit');

/**
 * Represents a case that needs AI analysis
 */
interface AmbiguousCase {
  contact: Contact;
  type: 'name_typo' | 'semantic_anomaly' | 'context_dependent' | 'cross_record_pattern';
  description: string;
  needsReasoning: boolean;
  needsExploration: boolean;
}

/**
 * Validation result for rule-based checks
 */
interface ValidationResult {
  valid: boolean;
  issue?: {
    type: string;
    severity: Severity;
    description: string;
    currentValue?: unknown;
    suggestedValue?: unknown;
  };
}

export class DataQualityAudit implements AuditModule {
  name = 'data-quality';
  description = 'Detect data quality issues in contacts using two-phase analysis';

  async run(context: AuditContext): Promise<AuditResult> {
    const startTime = Date.now();
    logger.info('Starting data quality audit');

    context.progress.start('Loading contacts...');

    // Load contacts
    const contacts = await this.loadContacts(context);
    context.progress.update(`Loaded ${contacts.length} contacts`);

    const issues: AuditIssue[] = [];
    let totalAiCost = 0;

    // PHASE 1: Rule-based checks
    logger.info('Phase 1: Running rule-based checks');
    context.progress.update('Running rule-based checks...');
    const ruleBasedIssues = await this.runRuleBasedChecks(contacts, context);
    issues.push(...ruleBasedIssues);
    logger.info({ count: ruleBasedIssues.length }, 'Phase 1 complete');

    // PHASE 2: AI analysis for ambiguous cases
    if (context.config.data_quality.enable_ambiguous_analysis) {
      logger.info('Phase 2: Identifying ambiguous cases');
      context.progress.update('Identifying ambiguous cases...');
      const ambiguousCases = this.identifyAmbiguousCases(contacts, ruleBasedIssues, context);

      if (ambiguousCases.length >= context.config.data_quality.min_ambiguous_cases_for_ai) {
        // Limit to max cases to control cost
        const casesToAnalyze = ambiguousCases.slice(
          0,
          context.config.data_quality.max_ambiguous_cases_per_run
        );

        logger.info(
          {
            total: ambiguousCases.length,
            analyzing: casesToAnalyze.length,
          },
          'Processing ambiguous cases with AI'
        );

        // Group by analysis mode needed
        const reasoningCases = casesToAnalyze.filter((c) => c.needsReasoning);
        const exploratoryCases = casesToAnalyze.filter((c) => c.needsExploration);

        // Process reasoning cases
        if (reasoningCases.length > 0 && totalAiCost < context.config.data_quality.max_ai_cost_per_audit) {
          context.progress.update(`Analyzing ${reasoningCases.length} cases with AI reasoning...`);
          const { issues: aiIssues, cost } = await this.analyzeWithReasoning(reasoningCases, context);
          issues.push(...aiIssues);
          totalAiCost += cost;
          logger.info({ count: aiIssues.length, cost }, 'Reasoning analysis complete');
        }

        // Process exploratory cases
        if (exploratoryCases.length > 0 && totalAiCost < context.config.data_quality.max_ai_cost_per_audit) {
          const remainingBudget = context.config.data_quality.max_ai_cost_per_audit - totalAiCost;
          context.progress.update(`Analyzing ${exploratoryCases.length} cases with AI exploration...`);
          const { issues: aiIssues, cost } = await this.analyzeWithExploration(
            exploratoryCases,
            context,
            remainingBudget
          );
          issues.push(...aiIssues);
          totalAiCost += cost;
          logger.info({ count: aiIssues.length, cost }, 'Exploratory analysis complete');
        }
      } else {
        logger.info(
          {
            found: ambiguousCases.length,
            threshold: context.config.data_quality.min_ambiguous_cases_for_ai,
          },
          'Skipping AI analysis - below minimum threshold'
        );
      }
    }

    // Generate summary
    const summary = this.buildSummary(issues, contacts.length, totalAiCost);

    // Generate AI insights (if any AI analysis was done)
    const ai_insights = await this.generateInsights(issues, context, totalAiCost > 0);

    const elapsedMs = Date.now() - startTime;
    logger.info({ elapsedMs, issuesFound: issues.length, aiCost: totalAiCost }, 'Audit complete');

    context.progress.succeed(`Found ${issues.length} issues in ${contacts.length} contacts`);

    return {
      module: this.name,
      timestamp: new Date(),
      summary,
      issues,
      ai_insights,
    };
  }

  /**
   * Load contacts from HubSpot
   */
  private async loadContacts(context: AuditContext): Promise<Contact[]> {
    const contacts: Contact[] = [];

    // Get all required properties
    const properties = [
      ...context.config.rules.required_contact_fields,
      'email',
      'phone',
      'website',
      'jobtitle',
      'company',
      'industry',
      'lastmodifieddate',
      'notes_last_contacted',
      'hs_analytics_last_visit_timestamp',
    ];

    // Fetch all contacts
    for await (const batch of context.hubspot.getContacts(properties)) {
      contacts.push(...batch);
    }

    return contacts;
  }

  /**
   * PHASE 1: Rule-based checks
   */
  private async runRuleBasedChecks(
    contacts: Contact[],
    context: AuditContext
  ): Promise<AuditIssue[]> {
    const issues: AuditIssue[] = [];

    for (const contact of contacts) {
      // Check missing required fields
      for (const field of context.config.rules.required_contact_fields) {
        const result = this.validateRequiredField(contact, field);
        if (!result.valid && result.issue) {
          issues.push(this.createIssue(contact, result.issue, 'high', 'rule'));
        }
      }

      // Check email format
      if (contact.properties.email) {
        const result = this.validateEmail(contact.properties.email);
        if (!result.valid && result.issue) {
          issues.push(this.createIssue(contact, result.issue, 'high', 'rule'));
        }
      }

      // Check phone format
      if (contact.properties.phone) {
        const result = this.validatePhone(contact.properties.phone);
        if (!result.valid && result.issue) {
          issues.push(this.createIssue(contact, result.issue, 'medium', 'rule'));
        }
      }

      // Check website URL format
      if (contact.properties.website) {
        const result = this.validateUrl(contact.properties.website);
        if (!result.valid && result.issue) {
          issues.push(this.createIssue(contact, result.issue, 'low', 'rule'));
        }
      }

      // Check stale contacts
      const staleResult = this.checkStaleContact(contact, context);
      if (!staleResult.valid && staleResult.issue) {
        issues.push(this.createIssue(contact, staleResult.issue, 'medium', 'rule'));
      }

      // Check obvious typos using regex patterns
      const typoResults = this.checkObviousTypos(contact);
      for (const result of typoResults) {
        if (!result.valid && result.issue) {
          issues.push(this.createIssue(contact, result.issue, 'medium', 'rule'));
        }
      }
    }

    return issues;
  }

  /**
   * Validate required field
   */
  private validateRequiredField(contact: Contact, field: string): ValidationResult {
    const value = contact.properties[field];
    if (!value || String(value).trim() === '') {
      return {
        valid: false,
        issue: {
          type: 'missing_required_field',
          severity: 'high',
          description: `Missing required field: ${field}`,
          currentValue: undefined,
        },
      };
    }
    return { valid: true };
  }

  /**
   * Validate email format
   */
  private validateEmail(email: string): ValidationResult {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        valid: false,
        issue: {
          type: 'invalid_email_format',
          severity: 'high',
          description: 'Invalid email format',
          currentValue: email,
        },
      };
    }
    return { valid: true };
  }

  /**
   * Validate phone format
   */
  private validatePhone(phone: string): ValidationResult {
    // Basic phone validation - at least 10 digits
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      return {
        valid: false,
        issue: {
          type: 'invalid_phone_format',
          severity: 'medium',
          description: 'Phone number appears to be incomplete',
          currentValue: phone,
        },
      };
    }
    return { valid: true };
  }

  /**
   * Validate URL format
   */
  private validateUrl(url: string): ValidationResult {
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
      return { valid: true };
    } catch {
      return {
        valid: false,
        issue: {
          type: 'invalid_url_format',
          severity: 'low',
          description: 'Invalid website URL format',
          currentValue: url,
        },
      };
    }
  }

  /**
   * Check if contact is stale
   */
  private checkStaleContact(contact: Contact, context: AuditContext): ValidationResult {
    const lastContactedStr = contact.properties.notes_last_contacted;
    const lastVisitStr = contact.properties.hs_analytics_last_visit_timestamp;

    const lastContacted = lastContactedStr ? new Date(lastContactedStr) : null;
    const lastVisit = lastVisitStr ? new Date(lastVisitStr) : null;

    const mostRecentActivity = [lastContacted, lastVisit]
      .filter((d): d is Date => d !== null)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    if (!mostRecentActivity) {
      return { valid: true }; // No activity data, can't determine staleness
    }

    const daysSinceActivity = (Date.now() - mostRecentActivity.getTime()) / (1000 * 60 * 60 * 24);
    const threshold = context.config.rules.stale_contact_days;

    if (daysSinceActivity > threshold) {
      return {
        valid: false,
        issue: {
          type: 'stale_contact',
          severity: 'medium',
          description: `No activity in ${Math.floor(daysSinceActivity)} days (threshold: ${threshold})`,
          currentValue: mostRecentActivity.toISOString(),
        },
      };
    }

    return { valid: true };
  }

  /**
   * Check for obvious typos using regex patterns
   */
  private checkObviousTypos(contact: Contact): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Check firstname for obvious issues
    if (contact.properties.firstname) {
      const name = contact.properties.firstname;
      // Multiple consecutive spaces
      if (/\s{2,}/.test(name)) {
        results.push({
          valid: false,
          issue: {
            type: 'obvious_typo',
            severity: 'low',
            description: 'First name contains multiple consecutive spaces',
            currentValue: name,
            suggestedValue: name.replace(/\s+/g, ' ').trim(),
          },
        });
      }
      // Leading/trailing spaces
      if (name !== name.trim()) {
        results.push({
          valid: false,
          issue: {
            type: 'obvious_typo',
            severity: 'low',
            description: 'First name has leading/trailing spaces',
            currentValue: name,
            suggestedValue: name.trim(),
          },
        });
      }
    }

    // Check lastname for obvious issues
    if (contact.properties.lastname) {
      const name = contact.properties.lastname;
      if (/\s{2,}/.test(name) || name !== name.trim()) {
        results.push({
          valid: false,
          issue: {
            type: 'obvious_typo',
            severity: 'low',
            description: 'Last name has formatting issues',
            currentValue: name,
            suggestedValue: name.replace(/\s+/g, ' ').trim(),
          },
        });
      }
    }

    // Check company name for obvious issues
    if (contact.properties.company) {
      const company = contact.properties.company;
      if (/\s{2,}/.test(company) || company !== company.trim()) {
        results.push({
          valid: false,
          issue: {
            type: 'obvious_typo',
            severity: 'low',
            description: 'Company name has formatting issues',
            currentValue: company,
            suggestedValue: company.replace(/\s+/g, ' ').trim(),
          },
        });
      }
    }

    return results;
  }

  /**
   * PHASE 2: Identify ambiguous cases that need AI analysis
   */
  private identifyAmbiguousCases(
    contacts: Contact[],
    ruleBasedIssues: AuditIssue[],
    context: AuditContext
  ): AmbiguousCase[] {
    const cases: AmbiguousCase[] = [];

    // Get contacts that don't already have rule-based issues
    const contactsWithIssues = new Set(ruleBasedIssues.map((i) => i.objectId));

    for (const contact of contacts) {
      // Skip if already has high-confidence issues
      if (contactsWithIssues.has(contact.id)) continue;

      // Check for ambiguous name typos
      if (context.config.data_quality.analyze_name_typos) {
        const nameCase = this.checkAmbiguousNameTypos(contact);
        if (nameCase) cases.push(nameCase);
      }

      // Check for semantic anomalies
      if (context.config.data_quality.analyze_semantic_anomalies) {
        const semanticCase = this.checkSemanticAnomalies(contact);
        if (semanticCase) cases.push(semanticCase);
      }
    }

    return cases;
  }

  /**
   * Check for ambiguous name typos that need AI reasoning
   */
  private checkAmbiguousNameTypos(contact: Contact): AmbiguousCase | null {
    const firstname = contact.properties.firstname;
    const lastname = contact.properties.lastname;

    if (!firstname && !lastname) return null;

    // Common nickname/formal name patterns
    const ambiguousPatterns = [
      { pattern: /^Jon$/, suggestion: 'John', field: 'firstname' },
      { pattern: /^Mike$/, suggestion: 'Michael', field: 'firstname' },
      { pattern: /^Bob$/, suggestion: 'Robert', field: 'firstname' },
      { pattern: /^Bill$/, suggestion: 'William', field: 'firstname' },
      { pattern: /^Inc$/, suggestion: 'Inc.', field: 'company' },
      { pattern: /^LLC$/, suggestion: 'LLC.', field: 'company' },
    ];

    // Check if any pattern matches
    for (const { pattern } of ambiguousPatterns) {
      if ((firstname && pattern.test(firstname)) || (lastname && pattern.test(lastname))) {
        return {
          contact,
          type: 'name_typo',
          description: 'Potential nickname or abbreviation that may need standardization',
          needsReasoning: true,
          needsExploration: false,
        };
      }
    }

    return null;
  }

  /**
   * Check for semantic anomalies that need AI reasoning
   */
  private checkSemanticAnomalies(contact: Contact): AmbiguousCase | null {
    const jobtitle = contact.properties.jobtitle;
    const industry = contact.properties.industry;
    const company = contact.properties.company;

    // If we have job title and industry, check if they might be mismatched
    if (jobtitle && industry) {
      // Look for obvious mismatches that need AI judgment
      const techTitles = ['Engineer', 'Developer', 'Programmer', 'CTO', 'Tech Lead'];
      const nonTechIndustries = ['Agriculture', 'Construction', 'Retail', 'Food Service'];

      const hasTechTitle = techTitles.some((t) => jobtitle.includes(t));
      const hasNonTechIndustry = nonTechIndustries.some((i) => industry.includes(i));

      if (hasTechTitle && hasNonTechIndustry) {
        return {
          contact,
          type: 'semantic_anomaly',
          description: `Tech job title "${jobtitle}" in non-tech industry "${industry}" - may be valid or data error`,
          needsReasoning: true,
          needsExploration: true, // May need to explore company context
        };
      }
    }

    // Check for suspicious company names that need validation
    if (company) {
      const suspiciousPatterns = ['test', 'example', 'sample', 'unknown', 'n/a', 'none'];
      if (suspiciousPatterns.some((p) => company.toLowerCase().includes(p))) {
        return {
          contact,
          type: 'context_dependent',
          description: `Company name "${company}" looks suspicious - may be test data`,
          needsReasoning: false,
          needsExploration: true,
        };
      }
    }

    return null;
  }

  /**
   * Analyze cases using Claude's reasoning mode
   */
  private async analyzeWithReasoning(
    cases: AmbiguousCase[],
    context: AuditContext
  ): Promise<{ issues: AuditIssue[]; cost: number }> {
    logger.info({ count: cases.length }, 'Analyzing with reasoning mode');

    const prompt = this.buildReasoningPrompt(cases, context);

    try {
      const response = await context.claude.analyzeWithReasoning<{
        issues: Array<{
          contactId: string;
          type: string;
          severity: Severity;
          confidence: ConfidenceLevel;
          description: string;
          reasoning: string;
          suggestedValue?: string;
        }>;
        thinking_summary: string;
      }>(
        prompt,
        {
          mode: 'reasoning',
          maxThinkingTokens: 2000,
        },
        'data-quality-reasoning'
      );

      const issues = response.issues.map((issue) => {
        const contact = cases.find((c) => c.contact.id === issue.contactId)?.contact;
        return this.createIssue(
          contact!,
          {
            type: issue.type,
            severity: issue.severity,
            description: issue.description,
            suggestedValue: issue.suggestedValue,
          },
          issue.confidence,
          'ai_reasoning',
          issue.reasoning
        );
      });

      // Get cost from usage stats
      const stats = context.claude.getUsageStats();
      const cost = stats.estimatedCostUsd;

      return { issues, cost };
    } catch (error) {
      logger.error({ error }, 'Reasoning analysis failed');
      return { issues: [], cost: 0 };
    }
  }

  /**
   * Analyze cases using Claude's exploratory mode
   */
  private async analyzeWithExploration(
    cases: AmbiguousCase[],
    context: AuditContext,
    budgetUsd: number
  ): Promise<{ issues: AuditIssue[]; cost: number }> {
    logger.info({ count: cases.length, budgetUsd }, 'Analyzing with exploratory mode');

    const prompt = this.buildExploratoryPrompt(cases, context);
    const tools = this.buildExplorationTools(context);

    try {
      const response = await context.claude.analyzeWithExploration<{
        issues: Array<{
          contactId: string;
          type: string;
          severity: Severity;
          confidence: ConfidenceLevel;
          description: string;
          reasoning: string;
          suggestedValue?: string;
        }>;
        thinking_summary: string;
      }>(
        prompt,
        {
          mode: 'exploratory',
          maxThinkingTokens: 3000,
          tools,
        },
        'data-quality-exploration'
      );

      const issues = response.issues.map((issue) => {
        const contact = cases.find((c) => c.contact.id === issue.contactId)?.contact;
        return this.createIssue(
          contact!,
          {
            type: issue.type,
            severity: issue.severity,
            description: issue.description,
            suggestedValue: issue.suggestedValue,
          },
          issue.confidence,
          'ai_exploratory',
          issue.reasoning
        );
      });

      // Get cost from usage stats
      const stats = context.claude.getUsageStats();
      const cost = stats.estimatedCostUsd;

      return { issues, cost };
    } catch (error) {
      logger.error({ error }, 'Exploratory analysis failed');
      return { issues: [], cost: 0 };
    }
  }

  /**
   * Build prompt for reasoning analysis
   */
  private buildReasoningPrompt(cases: AmbiguousCase[], context: AuditContext): string {
    const caseDescriptions = cases.map((c, i) => {
      return `${i + 1}. Contact ID: ${c.contact.id}
   Type: ${c.type}
   Description: ${c.description}
   Data: ${JSON.stringify(c.contact.properties, null, 2)}`;
    }).join('\n\n');

    return `You are analyzing contact data quality for ${context.config.company.name} (${context.config.company.industry}, ${context.config.company.business_model}).

Your task is to identify data quality issues in the following ambiguous cases. Use your reasoning to determine:
1. Is this actually an issue or is it valid data?
2. What is the confidence level (high/medium/low)?
3. What should be done to fix it?

Cases to analyze:
${caseDescriptions}

Return a JSON object with:
{
  "issues": [
    {
      "contactId": "string",
      "type": "string",
      "severity": "high" | "medium" | "low",
      "confidence": "high" | "medium" | "low",
      "description": "string",
      "reasoning": "string explaining your thinking",
      "suggestedValue": "optional suggested fix"
    }
  ],
  "thinking_summary": "string summarizing key insights"
}`;
  }

  /**
   * Build prompt for exploratory analysis
   */
  private buildExploratoryPrompt(cases: AmbiguousCase[], context: AuditContext): string {
    const caseDescriptions = cases.map((c, i) => {
      return `${i + 1}. Contact ID: ${c.contact.id}
   Type: ${c.type}
   Description: ${c.description}
   Data: ${JSON.stringify(c.contact.properties, null, 2)}`;
    }).join('\n\n');

    return `You are analyzing contact data quality for ${context.config.company.name} (${context.config.company.industry}, ${context.config.company.business_model}).

These cases require investigation. Use the provided tools to:
1. Explore related contacts and companies
2. Search for patterns across similar records
3. Validate context-dependent information

Cases to investigate:
${caseDescriptions}

Return a JSON object with the same format as reasoning mode.`;
  }

  /**
   * Build tools for exploratory analysis
   */
  private buildExplorationTools(_context: AuditContext): any[] {
    return [
      {
        name: 'search_similar_contacts',
        description: 'Find contacts with similar names or data to detect patterns',
        input_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            company: { type: 'string' },
            limit: { type: 'number', default: 10 },
          },
          required: ['name'],
        },
      },
      {
        name: 'get_contact_company',
        description: 'Get company information for a contact to validate context',
        input_schema: {
          type: 'object',
          properties: {
            contactId: { type: 'string' },
          },
          required: ['contactId'],
        },
      },
    ];
  }

  /**
   * Create an audit issue
   */
  private createIssue(
    contact: Contact,
    issueData: {
      type: string;
      severity: Severity;
      description: string;
      currentValue?: unknown;
      suggestedValue?: unknown;
    },
    confidence: ConfidenceLevel,
    detection_method: 'rule' | 'ai_reasoning' | 'ai_exploratory',
    reasoning?: string
  ): AuditIssue {
    return {
      id: randomUUID(),
      type: issueData.type,
      severity: issueData.severity,
      objectType: 'contact',
      objectId: contact.id,
      description: issueData.description,
      currentValue: issueData.currentValue,
      suggestedValue: issueData.suggestedValue,
      confidence,
      detection_method,
      reasoning,
    };
  }

  /**
   * Build summary from issues
   */
  private buildSummary(issues: AuditIssue[], totalRecords: number, aiCostUsd: number): AuditSummary {
    const by_severity: Record<Severity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    const by_type: Record<string, number> = {};

    const by_detection_method = {
      rule_based: 0,
      ai_reasoning: 0,
      ai_exploratory: 0,
    };

    for (const issue of issues) {
      by_severity[issue.severity]++;
      by_type[issue.type] = (by_type[issue.type] || 0) + 1;

      if (issue.detection_method === 'rule') {
        by_detection_method.rule_based++;
      } else if (issue.detection_method === 'ai_reasoning') {
        by_detection_method.ai_reasoning++;
      } else if (issue.detection_method === 'ai_exploratory') {
        by_detection_method.ai_exploratory++;
      }
    }

    return {
      total_records: totalRecords,
      issues_found: issues.length,
      by_severity,
      by_type,
      by_detection_method,
      ai_cost_usd: aiCostUsd,
    };
  }

  /**
   * Generate AI insights summary
   */
  private async generateInsights(
    issues: AuditIssue[],
    _context: AuditContext,
    usedAi: boolean
  ): Promise<AIInsights> {
    const patterns: string[] = [];
    const recommendations: string[] = [];

    // Analyze issue patterns
    const typeGroups = issues.reduce(
      (acc, issue) => {
        acc[issue.type] = (acc[issue.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Find common patterns
    const sortedTypes = Object.entries(typeGroups).sort((a, b) => b[1] - a[1]);
    if (sortedTypes.length > 0) {
      const [topType, topCount] = sortedTypes[0];
      if (topCount > 5) {
        patterns.push(`${topType} is the most common issue (${topCount} occurrences)`);
      }
    }

    // Generate recommendations
    if (issues.some((i) => i.type === 'missing_required_field')) {
      recommendations.push('Review data collection processes to ensure required fields are captured');
    }
    if (issues.some((i) => i.type === 'invalid_email_format')) {
      recommendations.push('Implement email validation at point of entry');
    }
    if (issues.some((i) => i.type === 'stale_contact')) {
      recommendations.push('Consider archiving or re-engaging contacts with no recent activity');
    }

    const summary = usedAi
      ? `Found ${issues.length} data quality issues using two-phase analysis (${issues.filter((i) => i.detection_method === 'rule').length} rule-based, ${issues.filter((i) => i.detection_method !== 'rule').length} AI-detected)`
      : `Found ${issues.length} data quality issues using rule-based analysis`;

    return {
      summary,
      patterns_detected: patterns,
      recommendations,
    };
  }
}
