/**
 * Action plan types
 * Epic 7: Enhanced with AI reasoning capture and detection method tracking
 */

export type ActionType =
  | 'update_property'
  | 'delete_contact'
  | 'merge_contacts'
  | 'remove_from_list'
  | 'set_marketing_status'
  | 'create_association';

export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type DetectionMethod = 'rule' | 'ai_reasoning' | 'ai_exploratory';

export interface ActionTarget {
  object_type: 'contact' | 'company' | 'deal' | 'list';
  object_id: string;
  display_name: string;
}

export interface ActionChange {
  description: string;
  property?: string;
  current_value?: unknown;
  new_value?: unknown;
}

/**
 * AI reasoning details for actions generated from AI-detected issues
 */
export interface AIReasoning {
  primary_reason: string; // Main reason for this action
  confidence_factors: string[]; // What increases/decreases confidence
  thinking_excerpt?: string; // Key insight from extended thinking
  explored_alternatives?: string[]; // Other options considered
}

/**
 * Individual action within a plan
 */
export interface Action {
  id: string;
  type: ActionType;
  confidence: ConfidenceLevel;
  target: ActionTarget;
  change: ActionChange;
  reasoning: string; // Why this action is recommended
  detection_method: DetectionMethod; // How the issue was detected
  ai_reasoning?: AIReasoning; // Enhanced reasoning for AI-generated actions
  reversible: boolean; // Can this be undone?
  requires_confirmation: boolean; // Extra confirmation for destructive actions
  dependencies?: string[]; // Action IDs that must complete first
}

/**
 * AI context for the overall plan
 */
export interface AIContext {
  patterns_identified: string[]; // Patterns found across issues
  strategic_recommendations: string[]; // High-level recommendations
  thinking_summary: string; // Summary of AI's reasoning process
}

export interface ActionPlanSummary {
  total_actions: number;
  by_type: Record<ActionType, number>;
  by_confidence: Record<ConfidenceLevel, number>;
  by_detection_method: {
    // Track source of actions
    rule_based: number;
    ai_reasoning: number;
    ai_exploratory: number;
  };
  estimated_api_calls: number;
  estimated_ai_cost_usd: number; // Cost of AI analysis that generated plan
}

/**
 * Complete action plan - a proposal to fix audit issues
 * Plans are saved as JSON files and only executed when user explicitly approves
 */
export interface ActionPlan {
  id: string;
  created_at: Date;
  source_audit: string; // Name of the audit that generated this plan
  summary: ActionPlanSummary;
  actions: Action[];
  ai_context?: AIContext; // Overall AI insights
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
