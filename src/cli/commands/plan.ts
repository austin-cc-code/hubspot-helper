/**
 * Plan command implementations
 * Epic 7: Action Plan System
 *
 * Review and manage action plans before execution
 */

import chalk from 'chalk';
import { displayInfo, formatHeader, formatSection, displayError } from '../output/index.js';
import { createLogger } from '../../utils/logger.js';
import { ActionPlan, type ActionFilter, type ConfidenceLevel, type DetectionMethod } from '../../actions/index.js';

const logger = createLogger('plan');

export interface PlanOptions {
  summary?: boolean;
  filter?: string;
  format?: string;
  config?: string;
  verbose?: boolean;
  json?: boolean;
}

/**
 * Show plan details
 */
export async function showPlan(file: string, options: PlanOptions): Promise<void> {
  logger.info({ file, options }, 'Showing plan');

  try {
    // Load the plan
    const plan = await ActionPlan.load(file);
    const planData = plan.getData();

    console.log(chalk.bold(`\n📄 Action Plan\n`));

    // Plan metadata
    console.log(formatSection('Plan Info:', [
      `  ID: ${planData.id}`,
      `  Source Audit: ${planData.source_audit}`,
      `  Created: ${planData.created_at.toLocaleString()}`,
      `  File: ${file}`,
    ].join('\n')));

    // Summary
    console.log(formatSection('Summary:', [
      `  Total Actions: ${planData.summary.total_actions}`,
      '',
      `  By Confidence:`,
      `    High:   ${planData.summary.by_confidence.high}`,
      `    Medium: ${planData.summary.by_confidence.medium}`,
      `    Low:    ${planData.summary.by_confidence.low}`,
      '',
      `  By Detection Method:`,
      `    Rule-based:      ${planData.summary.by_detection_method.rule_based}`,
      `    AI Reasoning:    ${planData.summary.by_detection_method.ai_reasoning}`,
      `    AI Exploratory:  ${planData.summary.by_detection_method.ai_exploratory}`,
      '',
      `  Estimated API Calls: ${planData.summary.estimated_api_calls}`,
      `  AI Analysis Cost: $${planData.summary.estimated_ai_cost_usd.toFixed(4)}`,
    ].join('\n')));

    // Action types
    if (Object.keys(planData.summary.by_type).length > 0) {
      const typesList = Object.entries(planData.summary.by_type)
        .map(([type, count]) => `    ${type}: ${count}`)
        .join('\n');
      console.log(formatSection('By Action Type:', typesList));
    }

    // AI Context
    if (planData.ai_context) {
      const aiLines: string[] = [planData.ai_context.thinking_summary, ''];

      if (planData.ai_context.patterns_identified.length > 0) {
        aiLines.push('  Patterns Identified:');
        aiLines.push(...planData.ai_context.patterns_identified.map((p) => `    • ${p}`));
        aiLines.push('');
      }

      if (planData.ai_context.strategic_recommendations.length > 0) {
        aiLines.push('  Strategic Recommendations:');
        aiLines.push(...planData.ai_context.strategic_recommendations.map((r) => `    • ${r}`));
      }

      console.log(formatSection('AI Context:', aiLines.join('\n')));
    }

    // If not summary-only, show actions
    if (!options.summary) {
      // Apply filters
      const filter: ActionFilter = {};

      if (options.filter) {
        const filterValue = options.filter.toLowerCase();
        if (['high', 'medium', 'low'].includes(filterValue)) {
          filter.confidence = [filterValue as ConfidenceLevel];
        } else if (['rule', 'ai_reasoning', 'ai_exploratory'].includes(filterValue)) {
          filter.detectionMethod = [filterValue as DetectionMethod];
        }
      }

      const actions = plan.getActions(filter);

      console.log(formatSection(`Actions (${actions.length}):`, ''));

      // Group by confidence
      const byConfidence = {
        high: actions.filter((a) => a.confidence === 'high'),
        medium: actions.filter((a) => a.confidence === 'medium'),
        low: actions.filter((a) => a.confidence === 'low'),
      };

      for (const [confidence, actionsInGroup] of Object.entries(byConfidence)) {
        if (actionsInGroup.length === 0) continue;

        console.log(chalk.bold(`\n  ${confidence.toUpperCase()} Confidence (${actionsInGroup.length}):`));

        for (const action of actionsInGroup.slice(0, options.verbose ? Infinity : 5)) {
          console.log(chalk.dim(`\n    ID: ${action.id}`));
          console.log(`    Type: ${action.type}`);
          console.log(`    Target: ${action.target.display_name} (${action.target.object_type})`);
          console.log(`    Change: ${action.change.description}`);

          if (action.change.property) {
            console.log(`    Property: ${action.change.property}`);
          }

          if (action.change.current_value !== undefined) {
            console.log(chalk.red(`    Current: ${JSON.stringify(action.change.current_value)}`));
          }

          if (action.change.new_value !== undefined) {
            console.log(chalk.green(`    New: ${JSON.stringify(action.change.new_value)}`));
          }

          console.log(`    Detection: ${action.detection_method}`);
          console.log(`    Reversible: ${action.reversible ? 'Yes' : chalk.red('No')}`);

          if (action.requires_confirmation) {
            console.log(chalk.yellow(`    ⚠ Requires confirmation`));
          }

          if (action.ai_reasoning) {
            console.log(chalk.dim(`\n    AI Reasoning:`));
            console.log(chalk.dim(`      ${action.ai_reasoning.primary_reason}`));

            if (action.ai_reasoning.confidence_factors.length > 0) {
              console.log(chalk.dim(`      Factors: ${action.ai_reasoning.confidence_factors.join(', ')}`));
            }
          } else {
            console.log(chalk.dim(`    Reasoning: ${action.reasoning}`));
          }
        }

        if (actionsInGroup.length > 5 && !options.verbose) {
          console.log(chalk.dim(`\n    ... and ${actionsInGroup.length - 5} more ${confidence} confidence actions\n`));
        }
      }
    }

    // High-risk actions warning
    const highRisk = plan.getHighRiskActions();
    if (highRisk.length > 0) {
      console.log(chalk.yellow([
        '',
        `⚠️  Warning: ${highRisk.length} high-risk actions`,
        '   These actions are not reversible or require extra confirmation.',
        '   Review carefully before execution.',
        '',
      ].join('\n')));
    }

    // Next steps
    console.log(chalk.dim([
      'Next steps:',
      options.summary ? `  Full details: hubspot-audit plan show ${file}` : '',
      options.filter ? `  All actions:  hubspot-audit plan show ${file}` : '',
      `  Execute:      hubspot-audit execute ${file}`,
      '',
    ].filter(Boolean).join('\n')));

    // JSON output
    if (options.json) {
      console.log(JSON.stringify(planData, null, 2));
    }

  } catch (error) {
    logger.error({ error, file }, 'Failed to show plan');
    const err = error instanceof Error ? error : new Error(String(error));
    displayError(err, { verbose: options.verbose });
    process.exit(1);
  }
}

/**
 * Show diff for plan actions
 */
export async function diffPlan(file: string, options: PlanOptions): Promise<void> {
  logger.info({ file, options }, 'Showing plan diff');

  console.log(chalk.bold(`\n🔍 Plan Diff: ${file}\n`));

  // TODO: Implement in Epic 7
  displayInfo(
    'Plan diff functionality coming in Epic 7',
    [
      'Will show before/after for each action:',
      '  - Current value → New value',
      '  - Color-coded changes',
      '  - Confidence levels',
    ]
  );
}

/**
 * Export plan to different format
 */
export async function exportPlan(file: string, options: PlanOptions): Promise<void> {
  logger.info({ file, options }, 'Exporting plan');

  const format = options.format || 'json';
  console.log(chalk.bold(`\n📤 Exporting plan to ${format}...\n`));

  // TODO: Implement in Epic 7
  displayInfo(
    'Plan export functionality coming in Epic 7',
    [
      'Will support formats:',
      '  - JSON (default)',
      '  - CSV',
      '  - HTML',
      '  - Markdown',
    ]
  );
}

/**
 * Get plan command help
 */
export function getPlanInfo(): void {
  console.log(formatHeader('\n📋 Plan Commands\n'));

  console.log(formatSection('Commands:', [
    '  show   - Display plan details',
    '  diff   - Show before/after for each action',
    '  export - Export plan to different format',
  ].join('\n')));

  console.log(formatSection('Examples:', [
    '  hubspot-audit plan show ./audit-reports/plan-2024-01-15.yaml',
    '  hubspot-audit plan show plan.yaml --summary',
    '  hubspot-audit plan show plan.yaml --filter=high',
    '  hubspot-audit plan diff plan.yaml',
    '  hubspot-audit plan export plan.yaml --format=csv',
  ].join('\n')));

  console.log();
}
