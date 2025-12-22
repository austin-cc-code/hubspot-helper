/**
 * Action plan types
 */

export type ActionType =
  | 'update_property'
  | 'delete_contact'
  | 'merge_contacts'
  | 'remove_from_list'
  | 'set_marketing_status'
  | 'create_association';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ActionTarget {
  object_type: 'contact' | 'company' | 'list';
  object_id: string;
  display_name: string;
}

export interface ActionChange {
  description: string;
  property?: string;
  current_value?: unknown;
  new_value?: unknown;
}

export interface Action {
  id: string;
  type: ActionType;
  confidence: ConfidenceLevel;
  target: ActionTarget;
  change: ActionChange;
  reasoning: string;
  reversible: boolean;
  requires_confirmation: boolean;
  dependencies?: string[];
}

export interface ActionPlanSummary {
  total_actions: number;
  by_type: Record<ActionType, number>;
  by_confidence: Record<ConfidenceLevel, number>;
  estimated_api_calls: number;
}

export interface ActionPlan {
  id: string;
  created_at: Date;
  source_audit: string;
  summary: ActionPlanSummary;
  actions: Action[];
}

export type ExecutionStatus =
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'partially_completed';

export type ActionStatus = 'success' | 'failed' | 'skipped' | 'pending';

export interface RollbackData {
  object_type: string;
  object_id: string;
  property: string;
  original_value: unknown;
}

export interface ExecutedAction {
  action_id: string;
  status: ActionStatus;
  error?: string;
  executed_at?: Date;
  rollback_data: RollbackData | null;
  is_reversible: boolean;
}

export interface ExecutionResults {
  successful: number;
  failed: number;
  skipped: number;
  non_reversible: number;
}

export interface ExecutionRecord {
  id: string;
  plan_id: string;
  executed_at: Date;
  completed_at?: Date;
  status: ExecutionStatus;
  results: ExecutionResults;
  actions: ExecutedAction[];
  resume_from?: string;
}
