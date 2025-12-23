/**
 * ActionPlan class - manages action plan files
 * Epic 7: Action Plan System
 *
 * Handles:
 * - Loading plans from JSON files
 * - Saving plans to JSON files with proper formatting
 * - Filtering actions by confidence, type, or detection method
 * - Generating summaries and previews
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, basename } from 'path';
import { createLogger } from '../utils/logger.js';
import type {
  ActionPlan as ActionPlanType,
  Action,
  ConfidenceLevel,
  DetectionMethod,
  ActionType,
} from '../types/actions.js';

const logger = createLogger('action-plan');

/**
 * Filter options for actions
 */
export interface ActionFilter {
  confidence?: ConfidenceLevel[];
  detectionMethod?: DetectionMethod[];
  actionType?: ActionType[];
  reversibleOnly?: boolean;
}

/**
 * ActionPlan class for managing action plan files
 */
export class ActionPlan {
  private data: ActionPlanType;

  constructor(data: ActionPlanType) {
    this.data = data;
  }

  /**
   * Load a plan from a JSON file
   */
  static async load(filePath: string): Promise<ActionPlan> {
    logger.info({ filePath }, 'Loading action plan');

    try {
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content) as ActionPlanType;

      // Convert date strings back to Date objects
      data.created_at = new Date(data.created_at);

      logger.info(
        {
          id: data.id,
          actionCount: data.actions.length,
        },
        'Action plan loaded'
      );

      return new ActionPlan(data);
    } catch (error) {
      logger.error({ error, filePath }, 'Failed to load action plan');
      throw new Error(`Failed to load action plan: ${error}`);
    }
  }

  /**
   * Save the plan to a JSON file
   */
  async save(filePath: string): Promise<void> {
    logger.info({ filePath }, 'Saving action plan');

    try {
      // Ensure directory exists
      await mkdir(dirname(filePath), { recursive: true });

      // Write with pretty formatting
      const content = JSON.stringify(this.data, null, 2);
      await writeFile(filePath, content, 'utf-8');

      logger.info(
        {
          id: this.data.id,
          filePath,
          actionCount: this.data.actions.length,
        },
        'Action plan saved'
      );
    } catch (error) {
      logger.error({ error, filePath }, 'Failed to save action plan');
      throw new Error(`Failed to save action plan: ${error}`);
    }
  }

  /**
   * Get the plan data
   */
  getData(): ActionPlanType {
    return this.data;
  }

  /**
   * Get all actions (or filtered actions)
   */
  getActions(filter?: ActionFilter): Action[] {
    let actions = this.data.actions;

    if (!filter) {
      return actions;
    }

    // Filter by confidence
    if (filter.confidence && filter.confidence.length > 0) {
      actions = actions.filter((a) => filter.confidence!.includes(a.confidence));
    }

    // Filter by detection method
    if (filter.detectionMethod && filter.detectionMethod.length > 0) {
      actions = actions.filter((a) => filter.detectionMethod!.includes(a.detection_method));
    }

    // Filter by action type
    if (filter.actionType && filter.actionType.length > 0) {
      actions = actions.filter((a) => filter.actionType!.includes(a.type));
    }

    // Filter by reversibility
    if (filter.reversibleOnly === true) {
      actions = actions.filter((a) => a.reversible);
    }

    return actions;
  }

  /**
   * Get actions that require extra confirmation (non-reversible or destructive)
   */
  getHighRiskActions(): Action[] {
    return this.data.actions.filter((a) => !a.reversible || a.requires_confirmation);
  }

  /**
   * Get actions grouped by confidence level
   */
  getActionsByConfidence(): Record<ConfidenceLevel, Action[]> {
    return {
      high: this.data.actions.filter((a) => a.confidence === 'high'),
      medium: this.data.actions.filter((a) => a.confidence === 'medium'),
      low: this.data.actions.filter((a) => a.confidence === 'low'),
    };
  }

  /**
   * Get actions grouped by detection method
   */
  getActionsByDetectionMethod(): Record<DetectionMethod, Action[]> {
    return {
      rule: this.data.actions.filter((a) => a.detection_method === 'rule'),
      ai_reasoning: this.data.actions.filter((a) => a.detection_method === 'ai_reasoning'),
      ai_exploratory: this.data.actions.filter((a) => a.detection_method === 'ai_exploratory'),
    };
  }

  /**
   * Get a summary of the plan
   */
  getSummary(): ActionPlanType['summary'] {
    return this.data.summary;
  }

  /**
   * Get AI context if available
   */
  getAIContext(): ActionPlanType['ai_context'] {
    return this.data.ai_context;
  }

  /**
   * Get the plan ID
   */
  getId(): string {
    return this.data.id;
  }

  /**
   * Get the source audit name
   */
  getSourceAudit(): string {
    return this.data.source_audit;
  }

  /**
   * Get the creation date
   */
  getCreatedAt(): Date {
    return this.data.created_at;
  }

  /**
   * Generate a filename for this plan
   * Format: {source-audit}-{timestamp}.json
   * Example: data-quality-2025-01-15T10-30-00.json
   */
  generateFilename(): string {
    const timestamp = this.data.created_at.toISOString().replace(/:/g, '-').split('.')[0];
    return `${this.data.source_audit}-${timestamp}.json`;
  }

  /**
   * Create a filtered copy of this plan
   */
  createFiltered(filter: ActionFilter): ActionPlan {
    const filteredActions = this.getActions(filter);

    // Recalculate summary for filtered actions
    const summary = this.calculateSummary(filteredActions);

    const filteredData: ActionPlanType = {
      ...this.data,
      summary,
      actions: filteredActions,
    };

    return new ActionPlan(filteredData);
  }

  /**
   * Calculate summary statistics for a set of actions
   */
  private calculateSummary(actions: Action[]): ActionPlanType['summary'] {
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

    // Estimate API calls (most actions = 1 call, batch operations could be optimized)
    const estimated_api_calls = actions.length;

    return {
      total_actions: actions.length,
      by_type: by_type as Record<ActionType, number>,
      by_confidence,
      by_detection_method,
      estimated_api_calls,
      estimated_ai_cost_usd: this.data.summary.estimated_ai_cost_usd, // Keep original
    };
  }

  /**
   * Validate that all action dependencies can be satisfied
   */
  validateDependencies(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const actionIds = new Set(this.data.actions.map((a) => a.id));

    for (const action of this.data.actions) {
      if (action.dependencies) {
        for (const depId of action.dependencies) {
          if (!actionIds.has(depId)) {
            errors.push(
              `Action ${action.id} depends on ${depId} which is not in the plan`
            );
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get actions in dependency order (dependencies first)
   */
  getActionsInDependencyOrder(): Action[] {
    const actions = [...this.data.actions];
    const ordered: Action[] = [];
    const processed = new Set<string>();

    const addAction = (action: Action) => {
      if (processed.has(action.id)) {
        return;
      }

      // Add dependencies first
      if (action.dependencies) {
        for (const depId of action.dependencies) {
          const dep = actions.find((a) => a.id === depId);
          if (dep && !processed.has(dep.id)) {
            addAction(dep);
          }
        }
      }

      ordered.push(action);
      processed.add(action.id);
    };

    for (const action of actions) {
      addAction(action);
    }

    return ordered;
  }

  /**
   * Parse a plan filename to extract metadata
   * Format: {source-audit}-{timestamp}.json
   * Example: data-quality-2025-01-15T10-30-00.json
   */
  static parseFilename(filename: string): {
    sourceAudit: string;
    timestamp: Date | null;
  } | null {
    const name = basename(filename, '.json');

    // Match pattern: {name}-YYYY-MM-DDTHH-MM-SS
    const match = name.match(/^(.+?)-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})$/);

    if (!match) {
      return null;
    }

    const sourceAudit = match[1];
    const timestampPart = match[2];

    // Convert: YYYY-MM-DDTHH-MM-SS -> YYYY-MM-DDTHH:MM:SS
    const isoTimestamp = timestampPart.replace(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})$/, '$1-$2-$3T$4:$5:$6');

    let timestamp: Date | null = null;
    try {
      timestamp = new Date(isoTimestamp);
      if (isNaN(timestamp.getTime())) {
        timestamp = null;
      }
    } catch {
      timestamp = null;
    }

    return {
      sourceAudit,
      timestamp,
    };
  }
}
