#!/usr/bin/env node
/**
 * HubSpot CLI Audit Tool
 *
 * AI-powered CLI that audits HubSpot data, identifies issues,
 * generates actionable fix plans, and executes changes safely with rollback capability.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createLogger } from '../utils/logger.js';
import { configInit, configShow, configValidate, configSet } from './commands/config.js';
import { runAudit, getAuditInfo } from './commands/audit.js';
import { showPlan, diffPlan, exportPlan, getPlanInfo } from './commands/plan.js';
import {
  executePlan,
  rollbackExecution,
  listExecutions,
  getExecuteInfo,
} from './commands/execute.js';
import {
  displayError,
  setupGracefulShutdown,
} from './output/index.js';

const logger = createLogger('cli');

// Set up graceful shutdown
setupGracefulShutdown();

const program = new Command();

program
  .name('hubspot-audit')
  .description(
    'AI-powered CLI tool that audits HubSpot data, identifies issues, and generates actionable fix plans'
  )
  .version('0.1.0')
  .addHelpText('after', `
${chalk.bold('Safety Model:')} ${chalk.dim('AUDIT → PLAN → REVIEW → APPROVE → EXECUTE')}

${chalk.dim('The tool NEVER modifies data automatically.')}
${chalk.dim('All changes require explicit review and approval.')}

${chalk.bold('Exit Codes:')}
  ${chalk.dim('0 - Success, no issues found')}
  ${chalk.dim('1 - Error (config, auth, API failure)')}
  ${chalk.dim('2 - Success, issues found')}
  ${chalk.dim('3 - Partial success')}
  ${chalk.dim('130 - Interrupted (Ctrl+C)')}

${chalk.bold('Examples:')}
  ${chalk.dim('$ hubspot-audit config init')}
  ${chalk.dim('$ hubspot-audit audit contacts --check=data-quality')}
  ${chalk.dim('$ hubspot-audit plan show ./audit-reports/plan.yaml')}
  ${chalk.dim('$ hubspot-audit execute plan.yaml --dry-run')}

${chalk.bold('Documentation:')}
  ${chalk.dim('https://github.com/anthropics/hubspot-audit')}
`);

// Config commands
const configCmd = program
  .command('config')
  .description('Manage configuration');

configCmd
  .command('init')
  .description('Initialize configuration with interactive wizard')
  .action(async () => {
    try {
      await configInit();
    } catch (error) {
      logger.error({ error }, 'Config init failed');
      displayError(error as Error, { verbose: program.opts().verbose });
      process.exit(1);
    }
  });

configCmd
  .command('show')
  .description('Display current configuration')
  .option('--config <path>', 'Use alternate config file')
  .action(async (options: { config?: string }) => {
    try {
      await configShow(options);
    } catch (error) {
      logger.error({ error }, 'Config show failed');
      displayError(error as Error, { verbose: program.opts().verbose });
      process.exit(1);
    }
  });

configCmd
  .command('validate')
  .description('Validate configuration file')
  .option('--config <path>', 'Use alternate config file')
  .action(async (options: { config?: string }) => {
    try {
      await configValidate(options);
    } catch (error) {
      logger.error({ error }, 'Config validate failed');
      displayError(error as Error, { verbose: program.opts().verbose });
      process.exit(1);
    }
  });

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value (e.g., config set company.name "Acme Corp")')
  .option('--config <path>', 'Use alternate config file')
  .action(async (key: string, value: string, options: { config?: string }) => {
    try {
      await configSet(key, value, options);
    } catch (error) {
      logger.error({ error }, 'Config set failed');
      displayError(error as Error, { verbose: program.opts().verbose });
      process.exit(1);
    }
  });

// Audit commands
const auditCmd = program
  .command('audit')
  .description('Run audit on HubSpot data (read-only, generates plan file)')
  .argument('[type]', 'Object type to audit: contacts, companies, deals, all')
  .option('-c, --check <checks>', 'Specific checks to run (comma-separated)')
  .option('--comprehensive', 'Run comprehensive audit with cross-cutting analysis')
  .option('--output <path>', 'Write output to file instead of stdout')
  .action(async (type: string | undefined, options: any) => {
    try {
      const globalOpts = program.opts();
      await runAudit(type, { ...options, ...globalOpts });
    } catch (error) {
      logger.error({ error }, 'Audit failed');
      displayError(error as Error, { verbose: program.opts().verbose, json: program.opts().json });
      process.exit(1);
    }
  });

auditCmd.addHelpCommand('info', 'Show available audits and checks');
auditCmd.command('info').description('Show available audits and checks').action(getAuditInfo);

// Plan commands
const planCmd = program.command('plan').description('Review and manage action plans');

planCmd
  .command('show <file>')
  .description('Display plan details')
  .option('--summary', 'Show summary only')
  .option('--filter <level>', 'Filter by confidence level: high, medium, low')
  .action(async (file: string, options: any) => {
    try {
      const globalOpts = program.opts();
      await showPlan(file, { ...options, ...globalOpts });
    } catch (error) {
      logger.error({ error }, 'Plan show failed');
      displayError(error as Error, { verbose: program.opts().verbose, json: program.opts().json });
      process.exit(1);
    }
  });

planCmd
  .command('diff <file>')
  .description('Show before/after for each action')
  .action(async (file: string, options: any) => {
    try {
      const globalOpts = program.opts();
      await diffPlan(file, { ...options, ...globalOpts });
    } catch (error) {
      logger.error({ error }, 'Plan diff failed');
      displayError(error as Error, { verbose: program.opts().verbose, json: program.opts().json });
      process.exit(1);
    }
  });

planCmd
  .command('export <file>')
  .description('Export plan to different format')
  .option('--format <format>', 'Export format: csv, json, html, markdown')
  .action(async (file: string, options: any) => {
    try {
      const globalOpts = program.opts();
      await exportPlan(file, { ...options, ...globalOpts });
    } catch (error) {
      logger.error({ error }, 'Plan export failed');
      displayError(error as Error, { verbose: program.opts().verbose, json: program.opts().json });
      process.exit(1);
    }
  });

planCmd.command('info').description('Show plan command help').action(getPlanInfo);

// Execute command
program
  .command('execute <file>')
  .description('Execute an action plan (THIS MODIFIES DATA)')
  .option('--dry-run', 'Show what would happen without making changes')
  .option('--high-confidence-only', 'Only execute high-confidence actions')
  .action(async (file: string, options: any) => {
    try {
      const globalOpts = program.opts();
      await executePlan(file, { ...options, ...globalOpts });
    } catch (error) {
      logger.error({ error }, 'Execute failed');
      displayError(error as Error, { verbose: program.opts().verbose, json: program.opts().json });
      process.exit(1);
    }
  });

// Rollback command
program
  .command('rollback <execution-id>')
  .description('Rollback a previous execution')
  .action(async (executionId: string, options: any) => {
    try {
      const globalOpts = program.opts();
      await rollbackExecution(executionId, { ...options, ...globalOpts });
    } catch (error) {
      logger.error({ error }, 'Rollback failed');
      displayError(error as Error, { verbose: program.opts().verbose, json: program.opts().json });
      process.exit(1);
    }
  });

// Executions command
const executionsCmd = program
  .command('executions')
  .description('Manage execution history');

executionsCmd
  .command('list')
  .description('List recent executions')
  .action(async () => {
    try {
      const globalOpts = program.opts();
      await listExecutions(globalOpts);
    } catch (error) {
      logger.error({ error }, 'List executions failed');
      displayError(error as Error, { verbose: program.opts().verbose, json: program.opts().json });
      process.exit(1);
    }
  });

executionsCmd.command('info').description('Show execution command help').action(getExecuteInfo);

// Global options
program
  .option('--config <path>', 'Use alternate config file')
  .option('-v, --verbose', 'Increase output verbosity')
  .option('-q, --quiet', 'Suppress non-essential output')
  .option('--no-color', 'Disable colored output')
  .option('--json', 'Output results as JSON');

// Parse and run
program.parse();
