/**
 * Duplicate Detection Audit (Epic 9)
 *
 * Three-tier duplicate detection strategy:
 * - Tier 1: Rule-based exact matching (free, high confidence)
 * - Tier 2: AI-powered fuzzy matching (reasoning mode, medium confidence)
 * - Tier 3: Deep merge investigation (exploratory mode, context-dependent)
 *
 * This audit showcases the full power of agentic capabilities.
 */

import { randomUUID } from 'crypto';
import type {
  AuditModule,
  AuditContext,
  AuditResult,
  AuditIssue,
  AuditSummary,
  AIInsights,
  Severity,
  ConfidenceLevel,
  DetectionMethod,
} from '../types/audit.js';
import type { Contact } from '../types/hubspot.js';
import { createLogger } from '../utils/logger.js';
import {
  normalizeName,
  normalizePhone,
  similarityScore,
  // For future use in Tier 2/3:
  // extractEmailDomain,
  // isLikelyNickname,
  // levenshteinDistance,
} from '../utils/matching.js';

const logger = createLogger('DuplicateDetectionAudit');

/**
 * Internal structure representing a potential duplicate pair
 */
interface DuplicatePair {
  contact1: Contact;
  contact2: Contact;
  match_type:
    | 'exact_email'
    | 'exact_phone_company'
    | 'exact_name_company'
    | 'fuzzy_name'
    | 'contextual';
  confidence: ConfidenceLevel;
  detection_method: DetectionMethod;

  // Match factors
  email_match: boolean;
  phone_match: boolean;
  name_similarity_score: number; // 0.0 - 1.0
  company_match: boolean;

  // AI analysis (populated in Tier 2)
  ai_reasoning?: {
    is_duplicate: boolean;
    confidence_explanation: string;
    thinking_summary?: string;
    red_flags?: string[];
  };

  // Merge recommendation (populated in Tier 3)
  merge_recommendation?: {
    should_merge: boolean;
    primary_contact_id: string;
    rationale: string;
    risk_assessment: 'low' | 'medium' | 'high';
    data_to_preserve: string[];
    potential_issues: string[];
  };
}

/**
 * Fuzzy candidate for Tier 2 analysis
 * TODO: Will be used in Tier 2 implementation
 */
// interface FuzzyCandidate {
//   contact1: Contact;
//   contact2: Contact;
//   name_similarity: number;
//   same_company: boolean;
//   same_email_domain: boolean;
//   description: string;
// }

/**
 * Duplicate Detection Audit Module
 */
export class DuplicateDetectionAudit implements AuditModule {
  name = 'duplicate-detection';
  description = 'Detect duplicate contacts using three-tier analysis (exact, fuzzy, investigation)';

  /**
   * Main entry point for duplicate detection audit
   */
  async run(context: AuditContext): Promise<AuditResult> {
    const startTime = Date.now();
    logger.info('Starting duplicate detection audit');

    context.progress.start('Loading contacts');

    // Load all contacts with relevant properties
    const contacts = await this.loadContacts(context);
    logger.info({ count: contacts.length }, 'Contacts loaded');

    if (contacts.length === 0) {
      logger.warn('No contacts found');
      return this.buildEmptyResult();
    }

    const allPairs: DuplicatePair[] = [];
    let totalAiCost = 0;

    // TIER 1: Rule-based exact matching (fast, free, HIGH confidence)
    context.progress.update('Tier 1: Finding exact matches');
    logger.info('Phase 1: Running rule-based exact matching');

    const tier1Pairs = await this.findExactMatches(contacts, context);
    allPairs.push(...tier1Pairs);
    logger.info({ count: tier1Pairs.length }, 'Tier 1 complete: exact matches found');

    // TODO: TIER 2: Fuzzy matching with AI reasoning (will implement next)
    // TODO: TIER 3: Deep merge investigation (will implement next)

    // Build final result
    context.progress.update('Generating insights');
    const duration = Date.now() - startTime;

    logger.info(
      {
        total_pairs: allPairs.length,
        tier1: tier1Pairs.length,
        ai_cost: totalAiCost,
        duration_ms: duration,
      },
      'Duplicate detection complete'
    );

    const issues = this.convertPairsToIssues(allPairs);
    const summary = this.buildSummary(allPairs, contacts.length, totalAiCost);
    const insights = this.generateInsights(allPairs, totalAiCost > 0);

    context.progress.succeed(`Found ${allPairs.length} duplicate pairs`);

    return {
      module: this.name,
      timestamp: new Date(),
      summary,
      issues,
      ai_insights: insights,
    };
  }

  /**
   * Load contacts with all relevant properties for duplicate detection
   */
  private async loadContacts(context: AuditContext): Promise<Contact[]> {
    const contacts: Contact[] = [];

    const properties = [
      'email',
      'firstname',
      'lastname',
      'phone',
      'mobilephone',
      'company',
      'jobtitle',
      'lifecyclestage',
      'hs_marketable_status',
      'lastmodifieddate',
      'createdate',
      'hs_object_id',
    ];

    // Use async generator to load all contacts
    for await (const batch of context.hubspot.getContacts(properties)) {
      contacts.push(...batch);
    }

    return contacts;
  }

  /**
   * TIER 1: Find exact matches using rule-based logic
   * Returns high-confidence duplicate pairs
   */
  private async findExactMatches(
    contacts: Contact[],
    context: AuditContext
  ): Promise<DuplicatePair[]> {
    const pairs: DuplicatePair[] = [];
    const seenPairs = new Set<string>(); // Track seen pairs to avoid duplicates

    const config = context.config.duplicate_detection;

    // Exact email match
    if (config.exact_email_match) {
      pairs.push(...this.findExactEmailMatches(contacts, seenPairs));
    }

    // Exact phone + company match
    if (config.exact_phone_and_company_match) {
      pairs.push(...this.findExactPhoneAndCompanyMatches(contacts, seenPairs));
    }

    // Exact name + company match
    if (config.exact_name_and_company_match) {
      pairs.push(...this.findExactNameAndCompanyMatches(contacts, seenPairs));
    }

    return pairs;
  }

  /**
   * Find contacts with identical email addresses (99% confidence)
   */
  private findExactEmailMatches(
    contacts: Contact[],
    seenPairs: Set<string>
  ): DuplicatePair[] {
    const pairs: DuplicatePair[] = [];
    const emailMap = new Map<string, Contact[]>();

    // Build email -> contacts map
    for (const contact of contacts) {
      const email = contact.properties.email;
      if (!email || email.trim() === '') continue;

      const normalizedEmail = email.toLowerCase().trim();
      if (!emailMap.has(normalizedEmail)) {
        emailMap.set(normalizedEmail, []);
      }
      emailMap.get(normalizedEmail)!.push(contact);
    }

    // Create pairs for each email with multiple contacts
    for (const [, emailContacts] of emailMap.entries()) {
      if (emailContacts.length < 2) continue;

      // Create all pairwise combinations
      for (let i = 0; i < emailContacts.length; i++) {
        for (let j = i + 1; j < emailContacts.length; j++) {
          const contact1 = emailContacts[i];
          const contact2 = emailContacts[j];
          const pairKey = this.getPairKey(contact1.id, contact2.id);

          if (seenPairs.has(pairKey)) continue;
          seenPairs.add(pairKey);

          pairs.push({
            contact1,
            contact2,
            match_type: 'exact_email',
            confidence: 'high',
            detection_method: 'rule',
            email_match: true,
            phone_match: this.phonesMatch(contact1, contact2),
            name_similarity_score: this.calculateNameSimilarity(contact1, contact2),
            company_match: this.companiesMatch(contact1, contact2),
          });
        }
      }
    }

    logger.info({ count: pairs.length }, 'Exact email matches found');
    return pairs;
  }

  /**
   * Find contacts with same phone + company (95% confidence)
   */
  private findExactPhoneAndCompanyMatches(
    contacts: Contact[],
    seenPairs: Set<string>
  ): DuplicatePair[] {
    const pairs: DuplicatePair[] = [];
    const phoneCompanyMap = new Map<string, Contact[]>();

    // Build (phone, company) -> contacts map
    for (const contact of contacts) {
      const phone =
        contact.properties.phone || contact.properties.mobilephone;
      const company = contact.properties.company;

      if (!phone || !company) continue;

      const normalizedPhone = normalizePhone(phone);
      const normalizedCompany = normalizeName(company);

      if (!normalizedPhone || !normalizedCompany) continue;

      const key = `${normalizedPhone}|${normalizedCompany}`;
      if (!phoneCompanyMap.has(key)) {
        phoneCompanyMap.set(key, []);
      }
      phoneCompanyMap.get(key)!.push(contact);
    }

    // Create pairs
    for (const [, phoneCompanyContacts] of phoneCompanyMap.entries()) {
      if (phoneCompanyContacts.length < 2) continue;

      for (let i = 0; i < phoneCompanyContacts.length; i++) {
        for (let j = i + 1; j < phoneCompanyContacts.length; j++) {
          const contact1 = phoneCompanyContacts[i];
          const contact2 = phoneCompanyContacts[j];
          const pairKey = this.getPairKey(contact1.id, contact2.id);

          if (seenPairs.has(pairKey)) continue;
          seenPairs.add(pairKey);

          pairs.push({
            contact1,
            contact2,
            match_type: 'exact_phone_company',
            confidence: 'high',
            detection_method: 'rule',
            email_match: this.emailsMatch(contact1, contact2),
            phone_match: true,
            name_similarity_score: this.calculateNameSimilarity(contact1, contact2),
            company_match: true,
          });
        }
      }
    }

    logger.info({ count: pairs.length }, 'Exact phone+company matches found');
    return pairs;
  }

  /**
   * Find contacts with same name + company (95% confidence)
   */
  private findExactNameAndCompanyMatches(
    contacts: Contact[],
    seenPairs: Set<string>
  ): DuplicatePair[] {
    const pairs: DuplicatePair[] = [];
    const nameCompanyMap = new Map<string, Contact[]>();

    // Build (name, company) -> contacts map
    for (const contact of contacts) {
      const firstname = contact.properties.firstname;
      const lastname = contact.properties.lastname;
      const company = contact.properties.company;

      if (!firstname || !lastname || !company) continue;

      const normalizedName = `${normalizeName(firstname)} ${normalizeName(lastname)}`;
      const normalizedCompany = normalizeName(company);

      if (!normalizedName.trim() || !normalizedCompany) continue;

      const key = `${normalizedName}|${normalizedCompany}`;
      if (!nameCompanyMap.has(key)) {
        nameCompanyMap.set(key, []);
      }
      nameCompanyMap.get(key)!.push(contact);
    }

    // Create pairs
    for (const [, nameCompanyContacts] of nameCompanyMap.entries()) {
      if (nameCompanyContacts.length < 2) continue;

      for (let i = 0; i < nameCompanyContacts.length; i++) {
        for (let j = i + 1; j < nameCompanyContacts.length; j++) {
          const contact1 = nameCompanyContacts[i];
          const contact2 = nameCompanyContacts[j];
          const pairKey = this.getPairKey(contact1.id, contact2.id);

          if (seenPairs.has(pairKey)) continue;
          seenPairs.add(pairKey);

          pairs.push({
            contact1,
            contact2,
            match_type: 'exact_name_company',
            confidence: 'high',
            detection_method: 'rule',
            email_match: this.emailsMatch(contact1, contact2),
            phone_match: this.phonesMatch(contact1, contact2),
            name_similarity_score: 1.0, // Exact name match
            company_match: true,
          });
        }
      }
    }

    logger.info({ count: pairs.length }, 'Exact name+company matches found');
    return pairs;
  }

  // ====================
  // Helper Methods
  // ====================

  /**
   * Generate unique pair key for deduplication
   * Always puts smaller ID first for consistency
   */
  private getPairKey(id1: string, id2: string): string {
    return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
  }

  /**
   * Check if two contacts have matching emails
   */
  private emailsMatch(contact1: Contact, contact2: Contact): boolean {
    const email1 = contact1.properties.email?.toLowerCase().trim();
    const email2 = contact2.properties.email?.toLowerCase().trim();
    return !!email1 && !!email2 && email1 === email2;
  }

  /**
   * Check if two contacts have matching phones
   */
  private phonesMatch(contact1: Contact, contact2: Contact): boolean {
    const phone1 =
      contact1.properties.phone || contact1.properties.mobilephone;
    const phone2 =
      contact2.properties.phone || contact2.properties.mobilephone;

    if (!phone1 || !phone2) return false;

    const normalized1 = normalizePhone(phone1);
    const normalized2 = normalizePhone(phone2);

    return normalized1 === normalized2;
  }

  /**
   * Check if two contacts have matching companies
   */
  private companiesMatch(contact1: Contact, contact2: Contact): boolean {
    const company1 = normalizeName(contact1.properties.company);
    const company2 = normalizeName(contact2.properties.company);
    return !!company1 && !!company2 && company1 === company2;
  }

  /**
   * Calculate name similarity between two contacts
   */
  private calculateNameSimilarity(contact1: Contact, contact2: Contact): number {
    const name1 = `${contact1.properties.firstname || ''} ${contact1.properties.lastname || ''}`.trim();
    const name2 = `${contact2.properties.firstname || ''} ${contact2.properties.lastname || ''}`.trim();

    if (!name1 || !name2) return 0;

    const normalized1 = normalizeName(name1);
    const normalized2 = normalizeName(name2);

    return similarityScore(normalized1, normalized2);
  }

  /**
   * Convert duplicate pairs to audit issues
   */
  private convertPairsToIssues(pairs: DuplicatePair[]): AuditIssue[] {
    return pairs.map((pair) => this.createIssueFromPair(pair));
  }

  /**
   * Create audit issue from duplicate pair
   */
  private createIssueFromPair(pair: DuplicatePair): AuditIssue {
    // Determine primary contact (for objectId)
    const primaryId =
      pair.merge_recommendation?.primary_contact_id || pair.contact1.id;
    const secondaryId =
      primaryId === pair.contact1.id ? pair.contact2.id : pair.contact1.id;
    const primaryContact =
      primaryId === pair.contact1.id ? pair.contact1 : pair.contact2;
    const secondaryContact =
      primaryId === pair.contact1.id ? pair.contact2 : pair.contact1;

    return {
      id: randomUUID(),
      type: 'duplicate',
      severity: this.determineSeverity(pair),
      objectType: 'contact',
      objectId: primaryId,
      description: this.buildDescription(pair, primaryContact, secondaryContact),
      currentValue: {
        primaryId,
        secondaryId,
        match_type: pair.match_type,
        match_factors: {
          email_match: pair.email_match,
          phone_match: pair.phone_match,
          company_match: pair.company_match,
          name_similarity: pair.name_similarity_score,
        },
      },
      suggestedValue: secondaryId, // Secondary contact to merge
      confidence: pair.confidence,
      detection_method: pair.detection_method,
      reasoning: this.buildReasoning(pair),
    };
  }

  /**
   * Determine severity based on match type and confidence
   */
  private determineSeverity(pair: DuplicatePair): Severity {
    // Exact matches are high severity (clear duplicates)
    if (pair.match_type.startsWith('exact')) return 'high';

    // AI-confirmed high confidence
    if (pair.ai_reasoning?.is_duplicate && pair.confidence === 'high') {
      return 'high';
    }

    // Fuzzy matches are medium
    if (pair.confidence === 'medium') return 'medium';

    // Low confidence or needs investigation
    return 'low';
  }

  /**
   * Build human-readable description of the duplicate
   */
  private buildDescription(
    pair: DuplicatePair,
    primary: Contact,
    secondary: Contact
  ): string {
    const matchReasons = [];

    if (pair.email_match) matchReasons.push('same email');
    if (pair.phone_match) matchReasons.push('same phone');
    if (pair.company_match) matchReasons.push('same company');
    if (pair.name_similarity_score >= 0.9)
      matchReasons.push('nearly identical names');
    else if (pair.name_similarity_score >= 0.7)
      matchReasons.push('similar names');

    const primaryName = `${primary.properties.firstname || ''} ${primary.properties.lastname || ''}`.trim() || 'Unknown';
    const secondaryName = `${secondary.properties.firstname || ''} ${secondary.properties.lastname || ''}`.trim() || 'Unknown';

    return `Potential duplicate: "${primaryName}" and "${secondaryName}" have ${matchReasons.join(', ')}`;
  }

  /**
   * Build reasoning explanation for the issue
   */
  private buildReasoning(pair: DuplicatePair): string {
    if (pair.ai_reasoning) {
      return pair.ai_reasoning.confidence_explanation;
    }

    // Rule-based reasoning
    switch (pair.match_type) {
      case 'exact_email':
        return 'Contacts share the same email address (99% confidence duplicate)';
      case 'exact_phone_company':
        return 'Contacts have the same phone number and company (95% confidence duplicate)';
      case 'exact_name_company':
        return 'Contacts have the same name and company (95% confidence duplicate)';
      default:
        return 'Duplicate detected based on matching criteria';
    }
  }

  /**
   * Build audit summary
   */
  private buildSummary(
    pairs: DuplicatePair[],
    totalContacts: number,
    aiCost: number
  ): AuditSummary {
    const issues = this.convertPairsToIssues(pairs);

    const bySeverity: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    const byType: Record<string, number> = {};
    const byDetectionMethod = {
      rule_based: 0,
      ai_reasoning: 0,
      ai_exploratory: 0,
    };

    for (const issue of issues) {
      bySeverity[issue.severity]++;
      byType[issue.type] = (byType[issue.type] || 0) + 1;

      if (issue.detection_method === 'rule') {
        byDetectionMethod.rule_based++;
      } else if (issue.detection_method === 'ai_reasoning') {
        byDetectionMethod.ai_reasoning++;
      } else if (issue.detection_method === 'ai_exploratory') {
        byDetectionMethod.ai_exploratory++;
      }
    }

    return {
      total_records: totalContacts,
      issues_found: issues.length,
      by_severity: bySeverity,
      by_type: byType,
      by_detection_method: byDetectionMethod,
      ai_cost_usd: aiCost,
    };
  }

  /**
   * Generate insights and recommendations
   */
  private generateInsights(pairs: DuplicatePair[], usedAi: boolean): AIInsights {
    const patterns: string[] = [];
    const recommendations: string[] = [];

    // Analyze patterns
    const matchTypeCounts: Record<string, number> = {};
    for (const pair of pairs) {
      matchTypeCounts[pair.match_type] =
        (matchTypeCounts[pair.match_type] || 0) + 1;
    }

    // Generate pattern insights
    const sortedTypes = Object.entries(matchTypeCounts).sort(
      (a, b) => b[1] - a[1]
    );
    if (sortedTypes.length > 0) {
      const [topType, topCount] = sortedTypes[0];
      patterns.push(
        `Most common duplicate type: ${topType.replace(/_/g, ' ')} (${topCount} pairs)`
      );
    }

    // Count email matches
    const emailMatches = pairs.filter((p) => p.email_match).length;
    if (emailMatches > 0) {
      patterns.push(`${emailMatches} pairs share the same email address`);
    }

    // Generate recommendations
    if (pairs.length > 10) {
      recommendations.push(
        'Consider reviewing data entry processes to prevent future duplicates'
      );
    }
    if (emailMatches > 5) {
      recommendations.push(
        'Implement email validation at point of entry to catch duplicates early'
      );
    }
    if (pairs.length > 0) {
      recommendations.push(
        'Review merge recommendations carefully before executing - merges are NOT reversible'
      );
    }

    const summary = usedAi
      ? `Found ${pairs.length} duplicate pairs using three-tier analysis (rule-based + AI)`
      : `Found ${pairs.length} duplicate pairs using rule-based exact matching`;

    return {
      summary,
      patterns_detected: patterns,
      recommendations,
    };
  }

  /**
   * Build empty result when no contacts found
   */
  private buildEmptyResult(): AuditResult {
    return {
      module: this.name,
      timestamp: new Date(),
      summary: {
        total_records: 0,
        issues_found: 0,
        by_severity: { critical: 0, high: 0, medium: 0, low: 0 },
        by_type: {},
        by_detection_method: {
          rule_based: 0,
          ai_reasoning: 0,
          ai_exploratory: 0,
        },
        ai_cost_usd: 0,
      },
      issues: [],
      ai_insights: {
        summary: 'No contacts found for duplicate detection',
        patterns_detected: [],
        recommendations: [],
      },
    };
  }
}
