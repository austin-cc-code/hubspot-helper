/**
 * Actions module exports
 * Epic 7: Action Plan System
 * Epic 8: Execution Engine with Rollback
 */

export { ActionPlan, type ActionFilter } from './ActionPlan.js';
export { PlanBuilder, type PlanBuilderConfig } from './PlanBuilder.js';
export { Executor, type ExecutorOptions, type ExecutionProgress, type ProgressCallback } from './Executor.js';
export { RollbackManager, type RollbackResult } from './RollbackManager.js';
export { ExecutionLock, type ExecutionLockData, ExecutionLockError } from './ExecutionLock.js';

// Re-export action types for convenience
export type {
  ActionPlan as ActionPlanType,
  Action,
  ActionType,
  ActionTarget,
  ActionChange,
  ActionPlanSummary,
  AIReasoning,
  AIContext,
  ConfidenceLevel,
  DetectionMethod,
  ExecutionRecord,
  ExecutedAction,
  ExecutionStatus,
  ExecutionResults,
  RollbackData,
} from '../types/actions.js';
