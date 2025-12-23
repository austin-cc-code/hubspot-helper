/**
 * Claude Service Types
 *
 * Types for AI analysis with agentic capabilities
 */

import type { Tool } from '@anthropic-ai/sdk/resources/messages.js';

export type AnalysisMode = 'simple' | 'reasoning' | 'exploratory' | 'iterative';

export interface ClaudeConfig {
  apiKey: string;
  model: 'claude-sonnet-4-20250514' | 'claude-3-haiku-20240307';
  maxTokensPerRequest: number; // Default: 4096

  // Agentic capabilities configuration
  enableExtendedThinking: boolean; // Enable thinking blocks
  enableToolUse: boolean; // Enable bounded data exploration
  enableMultiTurn: boolean; // Enable iterative analysis
  maxThinkingTokens?: number; // Limit thinking token usage (default: 4000)
  maxToolCalls?: number; // Limit tool calls per request (default: 5)
  maxConversationTurns?: number; // Limit multi-turn iterations (default: 2)

  // Budget and reliability
  monthlyBudgetUsd?: number; // Optional spending cap
  fallbackToRulesOnly: boolean; // If API unavailable, continue without AI
  maxRetries: number; // Default: 3
  timeoutMs: number; // Default: 60000
}

export interface AnalysisConfig {
  mode: AnalysisMode;
  maxThinkingTokens?: number;
  tools?: Tool[];
  maxTurns?: number;
  systemPrompt?: string;
}

export interface UsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalThinkingTokens: number; // Track thinking separately
  totalToolCalls: number; // Track tool usage
  totalRequests: number;
  estimatedCostUsd: number;
  byOperation: Record<string, OperationStats>;
  byMode: Record<AnalysisMode, OperationStats>; // Track by mode
}

export interface OperationStats {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  toolCalls: number;
  costUsd: number;
  errors: number;
}

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalCostUsd: number;
  breakdown: {
    inputCost: number;
    outputCost: number;
    thinkingCost: number;
  };
}

export interface AnalysisContext {
  isObvious: boolean;
  highConfidence: boolean;
  requiresReasoning: boolean;
  mediumComplexity: boolean;
  requiresContext: boolean;
  highImpact: boolean;
  strategic: boolean;
  multiFactored: boolean;
}

// Pricing (per million tokens)
export const PRICING = {
  'claude-sonnet-4-20250514': {
    input: 3.0, // $3 per MTok
    output: 15.0, // $15 per MTok
    thinking: 3.0, // $3 per MTok (extended thinking uses input pricing)
  },
  'claude-3-haiku-20240307': {
    input: 0.25, // $0.25 per MTok
    output: 1.25, // $1.25 per MTok
    thinking: 0.25, // $0.25 per MTok
  },
} as const;

export type ClaudeModel = keyof typeof PRICING;
