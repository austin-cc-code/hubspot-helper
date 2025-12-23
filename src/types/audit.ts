/**
 * Audit result types
 * Epic 6: Enhanced with detection method tracking and AI insights
 */

import type { Config } from './config.js';
import type { HubSpotService } from '../services/HubSpotService.js';
import type { ClaudeService } from '../services/ClaudeService.js';
import type { ConfidenceLevel as ConfidenceLevelType } from './actions.js';

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type ConfidenceLevel = ConfidenceLevelType;
export type DetectionMethod = 'rule' | 'ai_reasoning' | 'ai_exploratory';

export interface AuditIssue {
  id: string;
  type: string;
  severity: Severity;
  objectType: 'contact' | 'company' | 'deal' | 'list';
  objectId: string;
  description: string;
  currentValue?: unknown;
  suggestedValue?: unknown;
  confidence: ConfidenceLevel;
  detection_method: DetectionMethod;
  reasoning?: string; // AI's reasoning if detected by AI
}

export interface AuditSummary {
  total_records: number;
  issues_found: number;
  by_severity: Record<Severity, number>;
  by_type: Record<string, number>;
  by_detection_method: {
    rule_based: number;
    ai_reasoning: number;
    ai_exploratory: number;
  };
  ai_cost_usd: number; // Cost of AI analysis
}

export interface AIInsights {
  summary: string;
  patterns_detected: string[];
  recommendations: string[];
  thinking_summary?: string; // Key points from extended thinking
}

export interface AuditResult {
  module: string;
  timestamp: Date;
  summary: AuditSummary;
  issues: AuditIssue[];
  ai_insights: AIInsights;
}

export interface AuditContext {
  hubspot: HubSpotService;
  claude: ClaudeService;
  config: Config;
  progress: ProgressReporter;
}

export interface ProgressReporter {
  start(message: string): void;
  update(message: string, progress?: number): void;
  succeed(message: string): void;
  fail(message: string): void;
  info(message: string): void;
}

/**
 * Base interface for all audit modules
 */
export interface AuditModule {
  name: string;
  description: string;
  run(context: AuditContext): Promise<AuditResult>;
}
