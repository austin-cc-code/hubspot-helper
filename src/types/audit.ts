/**
 * Audit result types
 */

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface AuditIssue {
  id: string;
  type: string;
  severity: Severity;
  objectType: 'contact' | 'company' | 'deal' | 'list';
  objectId: string;
  description: string;
  currentValue?: unknown;
  suggestedValue?: unknown;
  reasoning?: string;
}

export interface AuditSummary {
  total_records: number;
  issues_found: number;
  by_severity: Record<Severity, number>;
  by_type: Record<string, number>;
}

export interface AuditResult {
  module: string;
  timestamp: Date;
  summary: AuditSummary;
  issues: AuditIssue[];
  ai_insights: string;
}

export interface AuditContext {
  config: unknown; // Will be properly typed when config is implemented
  progress: ProgressReporter;
}

export interface ProgressReporter {
  start(message: string): void;
  update(message: string, progress?: number): void;
  succeed(message: string): void;
  fail(message: string): void;
}
