/**
 * Action plan executor
 * Epic 8: Safely executes action plans with rollback data capture
 */

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type { HubSpotService } from '../services/HubSpotService.js';
import type { Config } from '../types/config.js';
import {
  type Action,
  type ExecutionRecord,
  type ExecutedAction,
  type RollbackData,
  type ExecutionResults,
} from '../types/actions.js';
import { ActionPlan as ActionPlanClass } from './ActionPlan.js';
import { ExecutionLock } from './ExecutionLock.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Executor');

export interface ExecutorOptions {
  dryRun?: boolean;
  batchSize?: number;
  continueOnError?: boolean;
  reportsDir?: string;
}

export interface ExecutionProgress {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  currentAction?: string;
}

export type ProgressCallback = (progress: ExecutionProgress) => void;

export class ExecutionError extends Error {
  constructor(
    message: string,
    public readonly actionId: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ExecutionError';
  }
}

/**
 * Executes action plans against HubSpot with rollback capability
 */
export class Executor {
  private lock: ExecutionLock | null = null;

  constructor(
    private readonly hubspot: HubSpotService,
    private readonly config: Config,
    private readonly options: ExecutorOptions = {}
  ) {}

  /**
   * Execute an action plan
   * Returns execution record with results and rollback data
   */
  async execute(
    planFile: string,
    progressCallback?: ProgressCallback
  ): Promise<ExecutionRecord> {
    const executionId = this.generateExecutionId();
    logger.info({ executionId, planFile, options: this.options }, 'Starting execution');

    // Load plan
    const planObj = await ActionPlanClass.load(planFile);
    const plan = planObj.getData();
    logger.info(
      { planId: plan.id, actionCount: plan.actions.length },
      'Loaded action plan'
    );

    // Initialize execution record
    const record: ExecutionRecord = {
      id: executionId,
      plan_id: plan.id,
      executed_at: new Date(),
      status: 'in_progress',
      results: {
        successful: 0,
        failed: 0,
        skipped: 0,
        non_reversible: 0,
      },
      actions: [],
    };

    try {
      // Acquire execution lock
      if (!this.options.dryRun) {
        await this.acquireLock(executionId);
      }

      // Validate and order actions
      const orderedActions = this.orderActionsByDependencies(plan.actions);
      logger.info({ count: orderedActions.length }, 'Actions ordered by dependencies');

      // Execute actions
      for (let i = 0; i < orderedActions.length; i++) {
        const action = orderedActions[i];

        // Update progress
        if (progressCallback) {
          progressCallback({
            total: orderedActions.length,
            completed: record.results.successful,
            failed: record.results.failed,
            skipped: record.results.skipped,
            currentAction: action.change.description,
          });
        }

        // Execute action
        const result = await this.executeAction(action, record.results);
        record.actions.push(result);

        // Update results
        if (result.status === 'success') {
          record.results.successful++;
          if (!result.is_reversible) {
            record.results.non_reversible++;
          }
        } else if (result.status === 'failed') {
          record.results.failed++;

          // Stop on error if not continuing
          if (!this.options.continueOnError) {
            logger.error({ actionId: action.id }, 'Execution failed, stopping');
            record.status = 'failed';
            record.resume_from = action.id;
            break;
          }
        } else if (result.status === 'skipped') {
          record.results.skipped++;
        }
      }

      // Determine final status
      if (record.status === 'in_progress') {
        if (record.results.failed === 0) {
          record.status = 'completed';
        } else if (record.results.successful > 0) {
          record.status = 'partially_completed';
        } else {
          record.status = 'failed';
        }
      }

      record.completed_at = new Date();

      // Save execution record
      if (!this.options.dryRun) {
        await this.saveExecutionRecord(record);
      }

      logger.info(
        {
          executionId,
          status: record.status,
          results: record.results,
        },
        'Execution completed'
      );

      return record;
    } finally {
      // Release lock
      if (this.lock) {
        await this.lock.release();
        this.lock = null;
      }
    }
  }

  /**
   * Order actions by dependencies
   * Actions with dependencies must run after their dependencies
   */
  private orderActionsByDependencies(actions: Action[]): Action[] {
    const ordered: Action[] = [];
    const remaining = new Set(actions);
    const completed = new Set<string>();

    // Keep processing until no more actions can be ordered
    let lastSize = remaining.size;
    while (remaining.size > 0) {
      let addedAny = false;

      for (const action of remaining) {
        // Check if all dependencies are completed
        const deps = action.dependencies || [];
        const canExecute = deps.every((depId) => completed.has(depId));

        if (canExecute) {
          ordered.push(action);
          completed.add(action.id);
          remaining.delete(action);
          addedAny = true;
        }
      }

      // Detect circular dependencies
      if (!addedAny && remaining.size === lastSize) {
        const remainingIds = Array.from(remaining).map((a) => a.id);
        logger.error({ remainingIds }, 'Circular dependency detected');
        throw new Error(
          `Circular dependency detected among actions: ${remainingIds.join(', ')}`
        );
      }

      lastSize = remaining.size;
    }

    return ordered;
  }

  /**
   * Execute a single action
   */
  private async executeAction(
    action: Action,
    _results: ExecutionResults
  ): Promise<ExecutedAction> {
    logger.info({ actionId: action.id, type: action.type }, 'Executing action');

    const result: ExecutedAction = {
      action_id: action.id,
      status: 'pending',
      rollback_data: null,
      is_reversible: action.reversible,
    };

    try {
      // Capture rollback data before making changes
      if (action.reversible && !this.options.dryRun) {
        result.rollback_data = await this.captureRollbackData(action);
      }

      // Execute based on action type
      if (this.options.dryRun) {
        logger.info({ actionId: action.id }, 'Dry run - skipping actual execution');
        result.status = 'skipped';
      } else {
        await this.executeActionByType(action);
        result.status = 'success';
        result.executed_at = new Date();
      }
    } catch (error) {
      logger.error({ actionId: action.id, error }, 'Action execution failed');
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Execute action based on type
   */
  private async executeActionByType(action: Action): Promise<void> {
    switch (action.type) {
      case 'update_property':
        await this.executeUpdateProperty(action);
        break;
      case 'delete_contact':
        await this.executeDeleteContact(action);
        break;
      case 'merge_contacts':
        await this.executeMergeContacts(action);
        break;
      case 'remove_from_list':
        await this.executeRemoveFromList(action);
        break;
      case 'set_marketing_status':
        await this.executeSetMarketingStatus(action);
        break;
      case 'create_association':
        await this.executeCreateAssociation(action);
        break;
      default:
        throw new ExecutionError(
          `Unknown action type: ${(action as Action).type}`,
          action.id
        );
    }
  }

  /**
   * Update property action
   */
  private async executeUpdateProperty(action: Action): Promise<void> {
    const { object_type, object_id } = action.target;
    const { property, new_value } = action.change;

    if (!property) {
      throw new ExecutionError('Missing property name', action.id);
    }

    // Convert value to string (HubSpot properties are strings)
    const stringValue = new_value === null || new_value === undefined
      ? ''
      : String(new_value);
    const properties = { [property]: stringValue };

    switch (object_type) {
      case 'contact':
        await this.hubspot.updateContact(object_id, properties);
        break;
      case 'company':
        await this.hubspot.updateCompany(object_id, properties);
        break;
      case 'deal':
        await this.hubspot.updateDeal(object_id, properties);
        break;
      default:
        throw new ExecutionError(
          `Unsupported object type for update: ${object_type}`,
          action.id
        );
    }

    logger.info({ actionId: action.id, object_type, object_id, property }, 'Updated property');
  }

  /**
   * Delete contact action
   */
  private async executeDeleteContact(action: Action): Promise<void> {
    const { object_id } = action.target;
    await this.hubspot.deleteContact(object_id);
    logger.info({ actionId: action.id, contactId: object_id }, 'Deleted contact');
  }

  /**
   * Merge contacts action (NOT REVERSIBLE!)
   */
  private async executeMergeContacts(action: Action): Promise<void> {
    // For merge, we expect object_id to be primary and new_value to contain secondary ID
    // const primaryId = action.target.object_id;
    const secondaryId = action.change.new_value as string;

    if (!secondaryId) {
      throw new ExecutionError('Missing secondary contact ID for merge', action.id);
    }

    // Note: Merge is not implemented in HubSpotService yet (requires raw HTTP)
    throw new ExecutionError(
      'Merge operation not yet implemented (requires HubSpot API enhancement)',
      action.id
    );

    // When implemented:
    // await this.hubspot.mergeContacts(_primaryId, secondaryId);
    // logger.warn({ actionId: action.id, _primaryId, secondaryId }, 'Merged contacts (NOT REVERSIBLE)');
  }

  /**
   * Remove from list action
   */
  private async executeRemoveFromList(action: Action): Promise<void> {
    const listId = action.target.object_id;
    const contactId = action.change.new_value as string;

    if (!contactId) {
      throw new ExecutionError('Missing contact ID for list removal', action.id);
    }

    await this.hubspot.removeFromList(listId, [contactId]);
    logger.info({ actionId: action.id, listId, contactId }, 'Removed from list');
  }

  /**
   * Set marketing status action
   */
  private async executeSetMarketingStatus(action: Action): Promise<void> {
    const contactId = action.target.object_id;
    const isMarketing = action.change.new_value as boolean;

    await this.hubspot.setMarketingContactStatus(contactId, isMarketing);
    logger.info({ actionId: action.id, contactId, isMarketing }, 'Set marketing status');
  }

  /**
   * Create association action
   */
  private async executeCreateAssociation(action: Action): Promise<void> {
    // For associations, we use target for "from" and change.new_value for "to"
    const fromType = action.target.object_type;
    const fromId = action.target.object_id;
    const toData = action.change.new_value as { type: string; id: string };

    if (!toData || !toData.type || !toData.id) {
      throw new ExecutionError('Invalid association data', action.id);
    }

    await this.hubspot.createAssociation(fromType, fromId, toData.type as any, toData.id);
    logger.info(
      { actionId: action.id, from: `${fromType}:${fromId}`, to: `${toData.type}:${toData.id}` },
      'Created association'
    );
  }

  /**
   * Capture current values for rollback
   */
  private async captureRollbackData(action: Action): Promise<RollbackData | null> {
    try {
      const { object_type, object_id } = action.target;
      const { property } = action.change;

      // Different actions have different rollback data
      switch (action.type) {
        case 'update_property': {
          if (!property) return null;

          let currentValue: unknown;

          // Fetch current value
          switch (object_type) {
            case 'contact': {
              const contact = await this.hubspot.getContact(object_id);
              currentValue = contact.properties[property];
              break;
            }
            case 'company': {
              const company = await this.hubspot.getCompany(object_id);
              currentValue = company.properties[property];
              break;
            }
            case 'deal': {
              const deal = await this.hubspot.getDeal(object_id);
              currentValue = deal.properties[property];
              break;
            }
            default:
              return null;
          }

          return {
            object_type,
            object_id,
            property,
            original_value: currentValue,
          };
        }

        case 'set_marketing_status': {
          const status = await this.hubspot.getMarketingContactStatus(object_id);
          return {
            object_type: 'contact',
            object_id,
            property: 'hs_marketable_status',
            original_value: status,
          };
        }

        // Other action types don't have simple rollback data
        default:
          return null;
      }
    } catch (error) {
      logger.error({ actionId: action.id, error }, 'Failed to capture rollback data');
      // Continue without rollback data
      return null;
    }
  }

  /**
   * Acquire execution lock
   */
  private async acquireLock(executionId: string): Promise<void> {
    const reportsDir = this.options.reportsDir || this.config.settings.output_directory;
    const portalId = this.config.hubspot.portal_id || 'default';

    this.lock = new ExecutionLock(reportsDir, portalId);
    await this.lock.acquire(executionId);
  }

  /**
   * Save execution record
   */
  private async saveExecutionRecord(record: ExecutionRecord): Promise<void> {
    const reportsDir = this.options.reportsDir || this.config.settings.output_directory;
    const executionsDir = join(reportsDir, 'executions');

    // Ensure directory exists
    await mkdir(executionsDir, { recursive: true });

    // Save record as JSON
    const recordPath = join(executionsDir, `${record.id}.json`);
    const content = JSON.stringify(record, null, 2);
    await writeFile(recordPath, content, 'utf-8');

    logger.info({ recordPath }, 'Saved execution record');
  }

  /**
   * Generate execution ID
   */
  private generateExecutionId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `exec-${timestamp}`;
  }
}
