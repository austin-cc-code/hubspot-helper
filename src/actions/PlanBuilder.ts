/**
 * PlanBuilder - converts AuditResults into ActionPlans
 * Epic 7: Action Plan System
 *
 * Responsibilities:
 * - Convert audit issues into actionable fixes
 * - Extract and preserve AI reasoning from AI-detected issues
 * - Build AI context from audit insights
 * - Calculate summary statistics
 * - Apply confidence scoring logic
 */

import { randomUUID } from 'crypto';
import { createLogger } from '../utils/logger.js';
import type { AuditResult, AuditIssue } from '../types/audit.js';
import type {
  ActionPlan as ActionPlanType,
  Action,
  ActionType,
  ConfidenceLevel,
  DetectionMethod,
  AIReasoning,
  AIContext,
  ActionPlanSummary,
} from '../types/actions.js';

const logger = createLogger('plan-builder');

/**
 * Configuration for action generation
 */
export interface PlanBuilderConfig {
  // Whether to include low-confidence actions
  includeLowConfidence?: boolean;
  // Whether to include AI reasoning in actions
  includeAIReasoning?: boolean;
  // Whether to generate AI context summary
  includeAIContext?: boolean;
}

/**
 * PlanBuilder class for creating action plans from audit results
 */
export class PlanBuilder {
  private config: Required<PlanBuilderConfig>;

  constructor(config: PlanBuilderConfig = {}) {
    this.config = {
      includeLowConfidence: config.includeLowConfidence ?? true,
      includeAIReasoning: config.includeAIReasoning ?? true,
      includeAIContext: config.includeAIContext ?? true,
    };
  }

  /**
   * Build an action plan from audit results
   */
  async buildPlan(auditResult: AuditResult): Promise<ActionPlanType> {
    logger.info(
      {
        module: auditResult.module,
        issueCount: auditResult.issues.length,
      },
      'Building action plan'
    );

    const planId = randomUUID();
    const actions: Action[] = [];

    // Convert each issue into an action
    for (const issue of auditResult.issues) {
      // Skip low-confidence issues if configured
      if (!this.config.includeLowConfidence && issue.confidence === 'low') {
        continue;
      }

      const action = this.issueToAction(issue);
      if (action) {
        actions.push(action);
      }
    }

    // Build summary statistics
    const summary = this.buildSummary(actions, auditResult.summary.ai_cost_usd);

    // Build AI context from audit insights
    const ai_context = this.config.includeAIContext
      ? this.buildAIContext(auditResult)
      : undefined;

    const plan: ActionPlanType = {
      id: planId,
      created_at: new Date(),
      source_audit: auditResult.module,
      summary,
      actions,
      ai_context,
    };

    logger.info(
      {
        planId,
        actionCount: actions.length,
        highConfidence: summary.by_confidence.high,
        mediumConfidence: summary.by_confidence.medium,
        lowConfidence: summary.by_confidence.low,
      },
      'Action plan built'
    );

    return plan;
  }

  /**
   * Convert an audit issue into an action
   */
  private issueToAction(issue: AuditIssue): Action | null {
    // Determine action type based on issue type
    const actionType = this.determineActionType(issue);
    if (!actionType) {
      logger.warn({ issueType: issue.type }, 'Cannot determine action type for issue');
      return null;
    }

    // Build the action
    const action: Action = {
      id: randomUUID(),
      type: actionType,
      confidence: issue.confidence,
      target: {
        object_type: issue.objectType,
        object_id: issue.objectId,
        display_name: this.generateDisplayName(issue),
      },
      change: {
        description: issue.description,
        property: this.extractPropertyName(issue),
        current_value: issue.currentValue,
        new_value: issue.suggestedValue,
      },
      reasoning: this.generateReasoning(issue),
      detection_method: issue.detection_method,
      ai_reasoning: this.extractAIReasoning(issue),
      reversible: this.isReversible(actionType),
      requires_confirmation: this.requiresConfirmation(actionType, issue),
    };

    return action;
  }

  /**
   * Determine the action type from an issue
   */
  private determineActionType(issue: AuditIssue): ActionType | null {
    const { type } = issue;

    // Map issue types to action types
    if (
      type === 'missing_required_field' ||
      type === 'invalid_email_format' ||
      type === 'invalid_phone_format' ||
      type === 'invalid_url_format' ||
      type === 'obvious_typo' ||
      type === 'name_typo' ||
      type === 'semantic_anomaly'
    ) {
      return 'update_property';
    }

    if (type === 'stale_contact') {
      // Could be delete or remove from marketing
      return 'set_marketing_status'; // Default to downgrade marketing status
    }

    if (type === 'duplicate') {
      return 'merge_contacts';
    }

    // Add more mappings as new audit types are implemented
    logger.warn({ issueType: type }, 'Unknown issue type, cannot map to action');
    return null;
  }

  /**
   * Generate a human-readable display name for the target object
   */
  private generateDisplayName(issue: AuditIssue): string {
    // For contacts, try to build a name from current values
    if (issue.objectType === 'contact') {
      // If the issue has current values that look like name fields
      if (typeof issue.currentValue === 'string' && issue.currentValue.includes('@')) {
        return issue.currentValue; // Email address
      }
      return `Contact ${issue.objectId}`;
    }

    if (issue.objectType === 'company') {
      return `Company ${issue.objectId}`;
    }

    return `${issue.objectType} ${issue.objectId}`;
  }

  /**
   * Extract property name from issue description or type
   */
  private extractPropertyName(issue: AuditIssue): string | undefined {
    const { type, description } = issue;

    // Try to extract from issue type
    if (type === 'missing_required_field' && description.includes(':')) {
      const parts = description.split(':');
      if (parts.length > 1) {
        return parts[1].trim();
      }
    }

    if (type === 'invalid_email_format') return 'email';
    if (type === 'invalid_phone_format') return 'phone';
    if (type === 'invalid_url_format') return 'website';
    if (type.includes('firstname')) return 'firstname';
    if (type.includes('lastname')) return 'lastname';
    if (type.includes('company')) return 'company';

    return undefined;
  }

  /**
   * Generate reasoning text for the action
   */
  private generateReasoning(issue: AuditIssue): string {
    if (issue.reasoning) {
      return issue.reasoning;
    }

    // Generate basic reasoning from issue description
    return `Fix data quality issue: ${issue.description}`;
  }

  /**
   * Extract AI reasoning details from an AI-detected issue
   */
  private extractAIReasoning(issue: AuditIssue): AIReasoning | undefined {
    if (!this.config.includeAIReasoning) {
      return undefined;
    }

    // Only include AI reasoning for AI-detected issues
    if (issue.detection_method === 'rule') {
      return undefined;
    }

    if (!issue.reasoning) {
      return undefined;
    }

    // Build AI reasoning object
    const aiReasoning: AIReasoning = {
      primary_reason: issue.reasoning,
      confidence_factors: this.extractConfidenceFactors(issue),
      thinking_excerpt: undefined, // Would be populated from Claude's thinking blocks
      explored_alternatives: undefined, // Would be populated from exploratory analysis
    };

    return aiReasoning;
  }

  /**
   * Extract confidence factors from issue
   */
  private extractConfidenceFactors(issue: AuditIssue): string[] {
    const factors: string[] = [];

    // Add factors based on confidence level
    if (issue.confidence === 'high') {
      factors.push('Clear pattern match');
      factors.push('Supported by data analysis');
    } else if (issue.confidence === 'medium') {
      factors.push('Requires human review');
      factors.push('Some ambiguity in data');
    } else if (issue.confidence === 'low') {
      factors.push('Uncertain recommendation');
      factors.push('May need additional context');
    }

    // Add detection method factor
    if (issue.detection_method === 'ai_reasoning') {
      factors.push('Detected using AI reasoning');
    } else if (issue.detection_method === 'ai_exploratory') {
      factors.push('Detected using AI data exploration');
    }

    return factors;
  }

  /**
   * Determine if an action type is reversible
   */
  private isReversible(actionType: ActionType): boolean {
    switch (actionType) {
      case 'update_property':
        return true; // Can restore original value
      case 'remove_from_list':
        return true; // Can re-add to list
      case 'set_marketing_status':
        return true; // Can toggle status back
      case 'create_association':
        return true; // Can remove association
      case 'delete_contact':
        return false; // Depends on HubSpot's soft delete support
      case 'merge_contacts':
        return false; // NOT REVERSIBLE - secondary record permanently deleted
      default:
        return false;
    }
  }

  /**
   * Determine if an action requires extra confirmation
   */
  private requiresConfirmation(actionType: ActionType, issue: AuditIssue): boolean {
    // Non-reversible actions always require confirmation
    if (!this.isReversible(actionType)) {
      return true;
    }

    // Low confidence actions should require confirmation
    if (issue.confidence === 'low') {
      return true;
    }

    // High-severity issues might need confirmation
    if (issue.severity === 'critical' || issue.severity === 'high') {
      return true;
    }

    return false;
  }

  /**
   * Build summary statistics for the plan
   */
  private buildSummary(actions: Action[], aiCostUsd: number): ActionPlanSummary {
    const by_type: Record<string, number> = {};
    const by_confidence: Record<ConfidenceLevel, number> = {
      high: 0,
      medium: 0,
      low: 0,
    };
    const by_detection_method = {
      rule_based: 0,
      ai_reasoning: 0,
      ai_exploratory: 0,
    };

    for (const action of actions) {
      // Count by type
      by_type[action.type] = (by_type[action.type] || 0) + 1;

      // Count by confidence
      by_confidence[action.confidence]++;

      // Count by detection method
      if (action.detection_method === 'rule') {
        by_detection_method.rule_based++;
      } else if (action.detection_method === 'ai_reasoning') {
        by_detection_method.ai_reasoning++;
      } else if (action.detection_method === 'ai_exploratory') {
        by_detection_method.ai_exploratory++;
      }
    }

    // Estimate API calls (most actions = 1 call, could be optimized with batching)
    const estimated_api_calls = actions.length;

    return {
      total_actions: actions.length,
      by_type: by_type as Record<ActionType, number>,
      by_confidence,
      by_detection_method,
      estimated_api_calls,
      estimated_ai_cost_usd: aiCostUsd,
    };
  }

  /**
   * Build AI context from audit insights
   */
  private buildAIContext(auditResult: AuditResult): AIContext | undefined {
    const { ai_insights } = auditResult;

    if (!ai_insights) {
      return undefined;
    }

    return {
      patterns_identified: ai_insights.patterns_detected || [],
      strategic_recommendations: ai_insights.recommendations || [],
      thinking_summary: ai_insights.thinking_summary || ai_insights.summary,
    };
  }

  /**
   * Filter actions by confidence level
   */
  static filterByConfidence(
    actions: Action[],
    minConfidence: ConfidenceLevel
  ): Action[] {
    const confidenceOrder: Record<ConfidenceLevel, number> = {
      high: 3,
      medium: 2,
      low: 1,
    };

    const minLevel = confidenceOrder[minConfidence];
    return actions.filter((a) => confidenceOrder[a.confidence] >= minLevel);
  }

  /**
   * Filter actions by detection method
   */
  static filterByDetectionMethod(
    actions: Action[],
    methods: DetectionMethod[]
  ): Action[] {
    return actions.filter((a) => methods.includes(a.detection_method));
  }
}
