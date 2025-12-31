/**
 * Audit command implementations
 *
 * Read-only analysis of HubSpot data that generates action plans
 */

import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { join } from 'path';
import { formatHeader, formatSection, displayError } from '../output/index.js';
import { createLogger } from '../../utils/logger.js';
import { ConfigManager } from '../../config/ConfigManager.js';
import { HubSpotService } from '../../services/HubSpotService.js';
import { ClaudeService } from '../../services/ClaudeService.js';
import { DataQualityAudit, DuplicateDetectionAudit } from '../../audits/index.js';
import { PlanBuilder, ActionPlan } from '../../actions/index.js';
import type { ProgressReporter, AuditContext, AuditResult } from '../../types/audit.js';
import type { Config } from '../../types/config.js';

const logger = createLogger('audit');

export interface AuditOptions {
  check?: string;
  comprehensive?: boolean;
  config?: string;
  verbose?: boolean;
  json?: boolean;
  output?: string;
}

/**
 * Progress reporter implementation using Ora
 */
class OraProgressReporter implements ProgressReporter {
  private spinner: Ora | null = null;

  start(message: string): void {
    this.spinner = ora(message).start();
  }

  update(message: string, progress?: number): void {
    if (this.spinner) {
      const text = progress !== undefined ? `${message} (${progress}%)` : message;
      this.spinner.text = text;
    }
  }

  succeed(message: string): void {
    if (this.spinner) {
      this.spinner.succeed(message);
      this.spinner = null;
    }
  }

  fail(message: string): void {
    if (this.spinner) {
      this.spinner.fail(message);
      this.spinner = null;
    }
  }

  info(message: string): void {
    if (this.spinner) {
      this.spinner.info(message);
      this.spinner = null;
    }
  }
}

/**
 * Run audit on specified object type
 */
export async function runAudit(
  type: string | undefined,
  options: AuditOptions
): Promise<void> {
  const objectType = type || 'contacts';

  logger.info({ objectType, options }, 'Starting audit');

  try {
    // Load config
    const configManager = new ConfigManager();
    const config = await configManager.load(options.config);

    // Parse checks
    const checks = options.check ? options.check.split(',').map((c) => c.trim()) : ['data-quality'];

    // Display header
    console.log(chalk.bold(`\n📊 Auditing ${objectType}\n`));
    console.log(chalk.dim(`Checks: ${checks.join(', ')}\n`));

    // Initialize services
    const hubspot = HubSpotService.fromConfig(config);
    const claude = ClaudeService.fromConfig(config);
    const progress = new OraProgressReporter();

    // Create audit context
    const context: AuditContext = {
      hubspot,
      claude,
      config,
      progress,
    };

    // Run audits based on checks
    for (const check of checks) {
      const result = await runCheck(check, objectType, context, options);

      if (result) {
        await displayResult(result, config, options);
      }
    }

  } catch (error) {
    logger.error({ error }, 'Audit failed');
    const err = error instanceof Error ? error : new Error(String(error));
    displayError(err, { verbose: options.verbose });
    process.exit(1);
  }
}

/**
 * Run a specific check
 */
async function runCheck(
  check: string,
  objectType: string,
  context: AuditContext,
  _options: AuditOptions
): Promise<AuditResult | null> {
  switch (check) {
    case 'data-quality':
      if (objectType === 'contacts' || objectType === 'all') {
        const audit = new DataQualityAudit();
        return await audit.run(context);
      } else {
        console.log(chalk.yellow(`\nData quality audit is only available for contacts\n`));
        return null;
      }

    case 'duplicates':
      if (objectType === 'contacts' || objectType === 'all') {
        const audit = new DuplicateDetectionAudit();
        return await audit.run(context);
      } else {
        console.log(chalk.yellow(`\nDuplicate detection is only available for contacts\n`));
        return null;
      }

    case 'properties':
    case 'lists':
    case 'marketing':
      console.log(chalk.yellow(`\n${check} audit coming in future epics\n`));
      return null;

    default:
      console.log(chalk.red(`\nUnknown check: ${check}\n`));
      return null;
  }
}

/**
 * Display audit result and generate action plan
 */
async function displayResult(result: AuditResult, config: Config, options: AuditOptions): Promise<void> {
  console.log(chalk.bold(`\n📋 ${result.module.toUpperCase()} Results\n`));

  // Summary
  console.log(formatSection('Summary:', [
    `  Total Records: ${result.summary.total_records}`,
    `  Issues Found: ${result.summary.issues_found}`,
    `  - High: ${result.summary.by_severity.high}`,
    `  - Medium: ${result.summary.by_severity.medium}`,
    `  - Low: ${result.summary.by_severity.low}`,
    '',
    `  Detection Methods:`,
    `  - Rule-based: ${result.summary.by_detection_method.rule_based}`,
    `  - AI Reasoning: ${result.summary.by_detection_method.ai_reasoning}`,
    `  - AI Exploratory: ${result.summary.by_detection_method.ai_exploratory}`,
    '',
    `  AI Cost: $${result.summary.ai_cost_usd.toFixed(4)}`,
  ].join('\n')));

  // Issue types
  if (Object.keys(result.summary.by_type).length > 0) {
    const typesList = Object.entries(result.summary.by_type)
      .map(([type, count]) => `  - ${type}: ${count}`)
      .join('\n');
    console.log(formatSection('Issues by Type:', typesList));
  }

  // AI Insights
  if (result.ai_insights.summary) {
    console.log(formatSection('AI Insights:', [
      result.ai_insights.summary,
      '',
      ...(result.ai_insights.patterns_detected.length > 0
        ? ['Patterns:', ...result.ai_insights.patterns_detected.map((p) => `  - ${p}`), '']
        : []),
      ...(result.ai_insights.recommendations.length > 0
        ? ['Recommendations:', ...result.ai_insights.recommendations.map((r) => `  - ${r}`)]
        : []),
    ].join('\n')));
  }

  // Sample issues (verbose mode)
  if (options.verbose && result.issues.length > 0) {
    const sampleIssues = result.issues.slice(0, 5);
    console.log(formatSection('\nSample Issues:', ''));
    for (const issue of sampleIssues) {
      console.log(chalk.dim(`\n  ID: ${issue.id}`));
      console.log(`  Type: ${issue.type}`);
      console.log(`  Severity: ${getSeverityColor(issue.severity)}`);
      console.log(`  Confidence: ${issue.confidence}`);
      console.log(`  Description: ${issue.description}`);
      if (issue.reasoning) {
        console.log(chalk.dim(`  Reasoning: ${issue.reasoning}`));
      }
    }
    if (result.issues.length > 5) {
      console.log(chalk.dim(`\n  ... and ${result.issues.length - 5} more issues\n`));
    }
  }

  // Generate and save action plan
  if (result.issues.length > 0) {
    console.log(chalk.bold('\n📝 Generating Action Plan...\n'));

    const planBuilder = new PlanBuilder();
    const planData = await planBuilder.buildPlan(result);
    const plan = new ActionPlan(planData);

    // Save to output directory
    const outputDir = config.settings.output_directory;
    const filename = plan.generateFilename();
    const filePath = join(outputDir, filename);

    await plan.save(filePath);

    console.log(formatSection('Action Plan Generated:', [
      `  Plan ID: ${plan.getId()}`,
      `  Total Actions: ${planData.summary.total_actions}`,
      `  - High Confidence: ${planData.summary.by_confidence.high}`,
      `  - Medium Confidence: ${planData.summary.by_confidence.medium}`,
      `  - Low Confidence: ${planData.summary.by_confidence.low}`,
      '',
      `  Detection Methods:`,
      `  - Rule-based: ${planData.summary.by_detection_method.rule_based}`,
      `  - AI Reasoning: ${planData.summary.by_detection_method.ai_reasoning}`,
      `  - AI Exploratory: ${planData.summary.by_detection_method.ai_exploratory}`,
      '',
      `  Estimated API Calls: ${planData.summary.estimated_api_calls}`,
      `  AI Analysis Cost: $${planData.summary.estimated_ai_cost_usd.toFixed(4)}`,
      '',
      chalk.green(`  ✓ Plan saved to: ${filePath}`),
    ].join('\n')));

    console.log(chalk.dim([
      '',
      'Next steps:',
      `  Review plan:  hubspot-audit plan show ${filePath}`,
      `  Execute plan: hubspot-audit execute ${filePath}`,
      '',
    ].join('\n')));
  } else {
    console.log(chalk.green('\n✓ No issues found - no action plan needed\n'));
  }

  // JSON output
  if (options.json) {
    console.log('\n' + JSON.stringify(result, null, 2));
  }

  // Output to file
  if (options.output) {
    const fs = await import('fs/promises');
    await fs.writeFile(options.output, JSON.stringify(result, null, 2));
    console.log(chalk.green(`\n✓ Results saved to ${options.output}\n`));
  }

  console.log();
}

/**
 * Get colored severity text
 */
function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return chalk.red.bold(severity);
    case 'high':
      return chalk.red(severity);
    case 'medium':
      return chalk.yellow(severity);
    case 'low':
      return chalk.blue(severity);
    default:
      return severity;
  }
}

/**
 * Get available audit types and checks
 */
export function getAuditInfo(): void {
  console.log(formatHeader('\n📋 Available Audits\n'));

  console.log(formatSection('Object Types:', [
    '  contacts  - Audit contact records',
    '  companies - Audit company records',
    '  deals     - Audit deal records',
    '  all       - Audit all object types (default)',
  ].join('\n')));

  console.log(formatSection('Available Checks:', [
    '  data-quality - Missing fields, invalid formats, stale data',
    '  duplicates   - Potential duplicate records',
    '  properties   - Property usage and custom field analysis',
    '  lists        - List hygiene and membership issues',
    '  marketing    - Marketing contact optimization',
  ].join('\n')));

  console.log(formatSection('Examples:', [
    '  hubspot-audit audit contacts --check=data-quality',
    '  hubspot-audit audit companies --check=duplicates',
    '  hubspot-audit audit all --comprehensive',
    '  hubspot-audit audit contacts --check=data-quality,duplicates',
  ].join('\n')));

  console.log();
}
