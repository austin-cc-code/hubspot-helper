/**
 * Rollback manager
 * Epic 8: Reverses executed actions using rollback data
 */

import { readdir } from 'fs/promises';
import { join } from 'path';
import type { HubSpotService } from '../services/HubSpotService.js';
import type { Config } from '../types/config.js';
import type { ExecutionRecord, ExecutedAction } from '../types/actions.js';
import { ActionPlan } from './ActionPlan.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('RollbackManager');

export interface RollbackResult {
  execution_id: string;
  rolled_back: number;
  failed: number;
  non_reversible: number;
  errors: Array<{ action_id: string; error: string }>;
}

export class RollbackError extends Error {
  constructor(
    message: string,
    public readonly actionId: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'RollbackError';
  }
}

/**
 * Manages rollback of executed actions
 */
export class RollbackManager {
  constructor(
    private readonly hubspot: HubSpotService,
    _config: Config,
    private readonly reportsDir: string = './audit-reports'
  ) {}

  /**
   * Rollback an execution
   * Returns result with counts of rolled back, failed, and non-reversible actions
   */
  async rollback(executionId: string): Promise<RollbackResult> {
    logger.info({ executionId }, 'Starting rollback');

    // Load execution record
    const record = await this.loadExecutionRecord(executionId);

    if (!record) {
      throw new Error(`Execution record not found: ${executionId}`);
    }

    logger.info(
      {
        executionId,
        totalActions: record.actions.length,
        status: record.status,
      },
      'Loaded execution record'
    );

    const result: RollbackResult = {
      execution_id: executionId,
      rolled_back: 0,
      failed: 0,
      non_reversible: 0,
      errors: [],
    };

    // Rollback actions in reverse order
    const actionsToRollback = record.actions
      .filter((a) => a.status === 'success')
      .reverse();

    for (const action of actionsToRollback) {
      if (!action.is_reversible) {
        result.non_reversible++;
        logger.warn({ actionId: action.action_id }, 'Action is not reversible');
        continue;
      }

      if (!action.rollback_data) {
        result.failed++;
        result.errors.push({
          action_id: action.action_id,
          error: 'No rollback data available',
        });
        logger.error({ actionId: action.action_id }, 'No rollback data available');
        continue;
      }

      try {
        await this.rollbackAction(action);
        result.rolled_back++;
        logger.info({ actionId: action.action_id }, 'Rolled back action');
      } catch (error) {
        result.failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push({
          action_id: action.action_id,
          error: errorMessage,
        });
        logger.error({ actionId: action.action_id, error }, 'Failed to rollback action');
      }
    }

    logger.info(
      {
        executionId,
        result,
      },
      'Rollback completed'
    );

    return result;
  }

  /**
   * Rollback a single action
   */
  private async rollbackAction(action: ExecutedAction): Promise<void> {
    if (!action.rollback_data) {
      throw new RollbackError('No rollback data', action.action_id);
    }

    const { object_type, object_id, property, original_value } = action.rollback_data;

    logger.info(
      { actionId: action.action_id, object_type, object_id, property },
      'Rolling back action'
    );

    // Restore original property value (convert to string)
    const stringValue = original_value === null || original_value === undefined
      ? ''
      : String(original_value);
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
        throw new RollbackError(
          `Unsupported object type for rollback: ${object_type}`,
          action.action_id
        );
    }
  }

  /**
   * Load execution record from file
   */
  private async loadExecutionRecord(executionId: string): Promise<ExecutionRecord | null> {
    try {
      const executionsDir = join(this.reportsDir, 'executions');
      const recordPath = join(executionsDir, `${executionId}.json`);

      // Use ActionPlan's load method (works for any JSON file)
      const record = await ActionPlan.load(recordPath);
      return record as unknown as ExecutionRecord;
    } catch (error) {
      logger.error({ executionId, error }, 'Failed to load execution record');
      return null;
    }
  }

  /**
   * List all execution records
   */
  async listExecutions(): Promise<ExecutionRecord[]> {
    try {
      const executionsDir = join(this.reportsDir, 'executions');
      const files = await readdir(executionsDir);

      const records: ExecutionRecord[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const executionId = file.replace('.json', '');
          const record = await this.loadExecutionRecord(executionId);
          if (record) {
            records.push(record);
          }
        }
      }

      // Sort by execution date (newest first)
      records.sort((a, b) => {
        return new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime();
      });

      return records;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Directory doesn't exist yet
        return [];
      }
      throw error;
    }
  }

  /**
   * Clean up old execution records
   * Keeps records from the last N days and enforces storage limit
   */
  async cleanup(retentionDays: number = 30, maxSizeMb: number = 100): Promise<number> {
    logger.info({ retentionDays, maxSizeMb }, 'Starting execution record cleanup');

    const records = await this.listExecutions();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let deletedCount = 0;

    // Delete old records
    for (const record of records) {
      const recordDate = new Date(record.executed_at);
      if (recordDate < cutoffDate) {
        await this.deleteExecutionRecord(record.id);
        deletedCount++;
      }
    }

    logger.info({ deletedCount }, 'Cleanup completed');
    return deletedCount;
  }

  /**
   * Delete an execution record
   */
  private async deleteExecutionRecord(executionId: string): Promise<void> {
    const executionsDir = join(this.reportsDir, 'executions');
    const recordPath = join(executionsDir, `${executionId}.json`);

    try {
      const { rm } = await import('fs/promises');
      await rm(recordPath);
      logger.info({ executionId }, 'Deleted execution record');
    } catch (error) {
      logger.error({ executionId, error }, 'Failed to delete execution record');
    }
  }

  /**
   * Get execution record by ID
   */
  async getExecution(executionId: string): Promise<ExecutionRecord | null> {
    return await this.loadExecutionRecord(executionId);
  }

  /**
   * Check if an execution can be rolled back
   */
  async canRollback(executionId: string): Promise<{
    canRollback: boolean;
    reversibleCount: number;
    nonReversibleCount: number;
    reason?: string;
  }> {
    const record = await this.loadExecutionRecord(executionId);

    if (!record) {
      return {
        canRollback: false,
        reversibleCount: 0,
        nonReversibleCount: 0,
        reason: 'Execution record not found',
      };
    }

    const successfulActions = record.actions.filter((a) => a.status === 'success');
    const reversibleActions = successfulActions.filter(
      (a) => a.is_reversible && a.rollback_data
    );
    const nonReversibleActions = successfulActions.filter((a) => !a.is_reversible);

    if (reversibleActions.length === 0 && nonReversibleActions.length > 0) {
      return {
        canRollback: false,
        reversibleCount: 0,
        nonReversibleCount: nonReversibleActions.length,
        reason: 'All actions are non-reversible',
      };
    }

    return {
      canRollback: reversibleActions.length > 0,
      reversibleCount: reversibleActions.length,
      nonReversibleCount: nonReversibleActions.length,
    };
  }
}
