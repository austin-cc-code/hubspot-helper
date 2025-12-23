/**
 * Claude Service
 *
 * AI analysis service with agentic capabilities:
 * - Multiple analysis modes (simple, reasoning, exploratory, iterative)
 * - Extended thinking for complex reasoning
 * - Tool use for data exploration
 * - Multi-turn conversations for iterative refinement
 * - Usage tracking and budget controls
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  Tool,
  MessageCreateParamsNonStreaming,
} from '@anthropic-ai/sdk/resources/messages.js';
import type { Config } from '../config/schema.js';
import { createLogger } from '../utils/logger.js';
import type {
  ClaudeConfig,
  AnalysisConfig,
  AnalysisMode,
  UsageStats,
  OperationStats,
  CostEstimate,
  AnalysisContext,
  ClaudeModel,
} from '../types/claude.js';
import { PRICING as PricingTable } from '../types/claude.js';

const logger = createLogger('claude');

export class ClaudeService {
  private client: Anthropic;
  private config: ClaudeConfig;
  private usageStats: UsageStats;

  constructor(config: ClaudeConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      maxRetries: config.maxRetries,
      timeout: config.timeoutMs,
    });

    this.config = config;
    this.usageStats = this.initializeUsageStats();

    logger.info({ model: config.model }, 'Claude service initialized');
  }

  /**
   * Create service from app config
   */
  static fromConfig(config: Config): ClaudeService {
    const apiKey = config.anthropic.api_key || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error(
        'Anthropic API key not found. Set ANTHROPIC_API_KEY or configure in config file.'
      );
    }

    const anthropicConfig = config.anthropic;

    return new ClaudeService({
      apiKey,
      model: anthropicConfig.model as ClaudeModel,
      maxTokensPerRequest: anthropicConfig.max_tokens_per_request,
      enableExtendedThinking: anthropicConfig.enable_extended_thinking,
      enableToolUse: anthropicConfig.enable_tool_use,
      enableMultiTurn: anthropicConfig.enable_multi_turn,
      maxThinkingTokens: anthropicConfig.max_thinking_tokens,
      maxToolCalls: anthropicConfig.max_tool_calls,
      maxConversationTurns: anthropicConfig.max_conversation_turns,
      monthlyBudgetUsd: anthropicConfig.monthly_budget_usd,
      fallbackToRulesOnly: anthropicConfig.fallback_to_rules_only,
      maxRetries: anthropicConfig.max_retries,
      timeoutMs: anthropicConfig.timeout_ms,
    });
  }

  /**
   * Analyze with reasoning mode (extended thinking enabled)
   */
  async analyzeWithReasoning<T>(
    prompt: string,
    config: AnalysisConfig,
    operation: string = 'reasoning'
  ): Promise<T> {
    logger.info({ operation, mode: 'reasoning' }, 'Starting reasoning analysis');

    return await this.executeAnalysis<T>(prompt, {
      ...config,
      mode: 'reasoning',
    }, operation);
  }

  /**
   * Analyze with exploration mode (extended thinking + tool use)
   */
  async analyzeWithExploration<T>(
    prompt: string,
    config: AnalysisConfig,
    operation: string = 'exploration'
  ): Promise<T> {
    logger.info({ operation, mode: 'exploratory' }, 'Starting exploratory analysis');

    return await this.executeAnalysis<T>(prompt, {
      ...config,
      mode: 'exploratory',
    }, operation);
  }

  /**
   * Analyze with iterative mode (multi-turn conversation)
   */
  async analyzeWithIteration<T>(
    initialPrompt: string,
    config: AnalysisConfig,
    operation: string = 'iterative'
  ): Promise<T> {
    logger.info({ operation, mode: 'iterative' }, 'Starting iterative analysis');

    return await this.executeAnalysis<T>(initialPrompt, {
      ...config,
      mode: 'iterative',
    }, operation);
  }

  /**
   * Simple analysis (no extended thinking, just tool use for structured output)
   */
  async analyzeSimple<T>(
    prompt: string,
    tools: Tool[],
    operation: string = 'simple'
  ): Promise<T> {
    logger.info({ operation, mode: 'simple' }, 'Starting simple analysis');

    return await this.executeAnalysis<T>(prompt, {
      mode: 'simple',
      tools,
    }, operation);
  }

  /**
   * Execute analysis with specified configuration
   */
  private async executeAnalysis<T>(
    prompt: string,
    config: AnalysisConfig,
    operation: string
  ): Promise<T> {
    const startTime = Date.now();

    // Check budget
    if (this.config.monthlyBudgetUsd && this.usageStats.estimatedCostUsd >= this.config.monthlyBudgetUsd) {
      const error = new Error('Monthly budget exceeded');
      logger.error({ budget: this.config.monthlyBudgetUsd, spent: this.usageStats.estimatedCostUsd }, 'Budget exceeded');

      if (this.config.fallbackToRulesOnly) {
        logger.warn('Falling back to rules-only mode due to budget');
        throw error; // Caller should catch and handle fallback
      }

      throw error;
    }

    try {
      // Build request parameters
      const params: MessageCreateParamsNonStreaming = {
        model: this.config.model,
        max_tokens: this.config.maxTokensPerRequest,
        messages: [{ role: 'user', content: prompt }],
      };

      // Add system prompt if provided
      if (config.systemPrompt) {
        params.system = config.systemPrompt;
      }

      // Add tools if provided
      if (config.tools && config.tools.length > 0 && this.config.enableToolUse) {
        params.tools = config.tools;
      }

      // Enable extended thinking for reasoning/exploratory/iterative modes
      if (
        (config.mode === 'reasoning' || config.mode === 'exploratory' || config.mode === 'iterative') &&
        this.config.enableExtendedThinking
      ) {
        params.thinking = {
          type: 'enabled',
          budget_tokens: config.maxThinkingTokens || this.config.maxThinkingTokens || 4000,
        };
      }

      // Execute request
      const response = await this.client.messages.create(params);

      // Track usage
      this.trackUsage(response, config.mode, operation);

      // Extract result from tool use
      const toolUseBlock = response.content.find((block) => block.type === 'tool_use');

      if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
        throw new Error('No tool_use block found in response');
      }

      const duration = Date.now() - startTime;
      logger.info(
        {
          operation,
          mode: config.mode,
          duration,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        'Analysis completed'
      );

      return toolUseBlock.input as T;
    } catch (error) {
      logger.error({ error, operation, mode: config.mode }, 'Analysis failed');

      // Track error
      this.trackError(config.mode, operation);

      // Re-throw for caller to handle
      throw error;
    }
  }

  /**
   * Select appropriate analysis mode based on context
   */
  selectAnalysisMode(context: AnalysisContext): AnalysisMode {
    // Rule-based first (free and fast)
    if (context.isObvious && context.highConfidence) {
      return 'simple'; // Just structured output
    }

    // Extended thinking for ambiguous cases
    if (context.requiresReasoning && context.mediumComplexity) {
      return 'reasoning'; // Add thinking
    }

    // Exploration for business judgment
    if (context.requiresContext && context.highImpact) {
      return 'exploratory'; // Add thinking + tools
    }

    // Iterative for strategic decisions
    if (context.strategic && context.multiFactored) {
      return 'iterative'; // Add thinking + tools + multi-turn
    }

    return 'simple'; // Default to cheapest
  }

  /**
   * Estimate cost for an operation
   */
  estimateCost(
    inputTokens: number,
    outputTokens: number,
    thinkingTokens: number,
    _mode: AnalysisMode
  ): CostEstimate {
    const pricing = PricingTable[this.config.model];

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    const thinkingCost = (thinkingTokens / 1_000_000) * pricing.thinking;

    return {
      inputTokens,
      outputTokens,
      thinkingTokens,
      totalCostUsd: inputCost + outputCost + thinkingCost,
      breakdown: {
        inputCost,
        outputCost,
        thinkingCost,
      },
    };
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): UsageStats {
    return { ...this.usageStats };
  }

  /**
   * Track usage from API response
   */
  private trackUsage(
    response: Anthropic.Messages.Message,
    mode: AnalysisMode,
    operation: string
  ): void {
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;

    // Extract thinking tokens if available (new API feature)
    const thinkingTokens = (response as any).usage?.thinking_tokens || 0;

    // Count tool calls
    const toolCalls = response.content.filter((block) => block.type === 'tool_use').length;

    // Calculate cost
    const cost = this.estimateCost(inputTokens, outputTokens, thinkingTokens, mode);

    // Update total stats
    this.usageStats.totalInputTokens += inputTokens;
    this.usageStats.totalOutputTokens += outputTokens;
    this.usageStats.totalThinkingTokens += thinkingTokens;
    this.usageStats.totalToolCalls += toolCalls;
    this.usageStats.totalRequests += 1;
    this.usageStats.estimatedCostUsd += cost.totalCostUsd;

    // Update operation stats
    if (!this.usageStats.byOperation[operation]) {
      this.usageStats.byOperation[operation] = this.createOperationStats();
    }
    this.updateOperationStats(this.usageStats.byOperation[operation], inputTokens, outputTokens, thinkingTokens, toolCalls, cost.totalCostUsd);

    // Update mode stats
    if (!this.usageStats.byMode[mode]) {
      this.usageStats.byMode[mode] = this.createOperationStats();
    }
    this.updateOperationStats(this.usageStats.byMode[mode], inputTokens, outputTokens, thinkingTokens, toolCalls, cost.totalCostUsd);

    logger.debug(
      {
        operation,
        mode,
        inputTokens,
        outputTokens,
        thinkingTokens,
        toolCalls,
        costUsd: cost.totalCostUsd,
      },
      'Usage tracked'
    );
  }

  /**
   * Track error
   */
  private trackError(mode: AnalysisMode, operation: string): void {
    if (!this.usageStats.byOperation[operation]) {
      this.usageStats.byOperation[operation] = this.createOperationStats();
    }
    this.usageStats.byOperation[operation].errors += 1;

    if (!this.usageStats.byMode[mode]) {
      this.usageStats.byMode[mode] = this.createOperationStats();
    }
    this.usageStats.byMode[mode].errors += 1;
  }

  /**
   * Initialize usage stats
   */
  private initializeUsageStats(): UsageStats {
    return {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalThinkingTokens: 0,
      totalToolCalls: 0,
      totalRequests: 0,
      estimatedCostUsd: 0,
      byOperation: {},
      byMode: {
        simple: this.createOperationStats(),
        reasoning: this.createOperationStats(),
        exploratory: this.createOperationStats(),
        iterative: this.createOperationStats(),
      },
    };
  }

  /**
   * Create operation stats object
   */
  private createOperationStats(): OperationStats {
    return {
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      thinkingTokens: 0,
      toolCalls: 0,
      costUsd: 0,
      errors: 0,
    };
  }

  /**
   * Update operation stats
   */
  private updateOperationStats(
    stats: OperationStats,
    inputTokens: number,
    outputTokens: number,
    thinkingTokens: number,
    toolCalls: number,
    cost: number
  ): void {
    stats.requests += 1;
    stats.inputTokens += inputTokens;
    stats.outputTokens += outputTokens;
    stats.thinkingTokens += thinkingTokens;
    stats.toolCalls += toolCalls;
    stats.costUsd += cost;
  }

  /**
   * Reset usage stats (useful for testing or monthly resets)
   */
  resetUsageStats(): void {
    this.usageStats = this.initializeUsageStats();
    logger.info('Usage stats reset');
  }
}
