/**
 * Config command implementations
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { ConfigManager } from '../../config/ConfigManager.js';
import type { Config } from '../../config/schema.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('config');

/**
 * Interactive configuration wizard
 */
export async function configInit(): Promise<void> {
  console.log(chalk.bold('\n🔧 HubSpot Audit Tool Configuration Wizard\n'));

  // Check if config already exists
  if (ConfigManager.exists()) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'Configuration file already exists. Overwrite?',
        default: false,
      },
    ]);

    if (!overwrite) {
      console.log(chalk.yellow('\n✗ Configuration initialization cancelled.\n'));
      return;
    }
  }

  console.log(chalk.dim('This wizard will help you set up your configuration.\n'));
  console.log(
    chalk.dim('API keys can be provided here or via environment variables (recommended).\n')
  );

  // Company information
  console.log(chalk.bold('Company Information:'));
  const companyAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Company name:',
      validate: (input: string) => (input.trim().length > 0 ? true : 'Required'),
    },
    {
      type: 'input',
      name: 'industry',
      message: 'Industry (e.g., Technology, Healthcare, Finance):',
      validate: (input: string) => (input.trim().length > 0 ? true : 'Required'),
    },
    {
      type: 'list',
      name: 'business_model',
      message: 'Business model:',
      choices: ['B2B', 'B2C', 'B2B2C'],
    },
  ]);

  // API credentials (optional)
  console.log(chalk.bold('\nAPI Credentials (Optional - can use environment variables):'));
  const credentialAnswers = await inquirer.prompt([
    {
      type: 'password',
      name: 'hubspot_token',
      message: 'HubSpot Access Token (or set HUBSPOT_ACCESS_TOKEN env var):',
      mask: '*',
    },
    {
      type: 'input',
      name: 'hubspot_portal_id',
      message: 'HubSpot Portal ID (optional):',
    },
    {
      type: 'password',
      name: 'anthropic_key',
      message: 'Anthropic API Key (or set ANTHROPIC_API_KEY env var):',
      mask: '*',
    },
  ]);

  // Ideal customer profile (optional)
  console.log(chalk.bold('\nIdeal Customer Profile (Optional):'));
  const { setup_icp } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'setup_icp',
      message: 'Set up Ideal Customer Profile (ICP) now?',
      default: false,
    },
  ]);

  let icpAnswers = {};
  if (setup_icp) {
    icpAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'company_sizes',
        message: 'Target company sizes (comma-separated, e.g., "1-50,51-200"):',
        filter: (input: string) =>
          input
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
      },
      {
        type: 'input',
        name: 'industries',
        message: 'Target industries (comma-separated):',
        filter: (input: string) =>
          input
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
      },
      {
        type: 'input',
        name: 'job_titles',
        message: 'Target job titles (comma-separated):',
        filter: (input: string) =>
          input
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
      },
    ]);
  }

  // Build configuration
  const config = ConfigManager.createTemplate({
    name: companyAnswers.name,
    industry: companyAnswers.industry,
    business_model: companyAnswers.business_model as 'B2B' | 'B2C' | 'B2B2C',
  });

  // Add optional values
  if (credentialAnswers.hubspot_token) {
    config.hubspot.access_token = credentialAnswers.hubspot_token;
  }
  if (credentialAnswers.hubspot_portal_id) {
    config.hubspot.portal_id = credentialAnswers.hubspot_portal_id;
  }
  if (credentialAnswers.anthropic_key) {
    config.anthropic.api_key = credentialAnswers.anthropic_key;
  }

  if (setup_icp) {
    config.icp = icpAnswers as Config['icp'];
  }

  // Save configuration
  const manager = new ConfigManager();
  const paths = ConfigManager.getConfigPaths();

  try {
    await manager.save(config, paths.primary);

    console.log(chalk.green('\n✓ Configuration saved successfully!\n'));
    console.log(chalk.dim(`Location: ${paths.primary}\n`));

    // Show next steps
    console.log(chalk.bold('Next steps:'));
    console.log(chalk.dim('  1. Verify configuration: hubspot-audit config show'));
    console.log(chalk.dim('  2. Test connection: hubspot-audit audit --help'));
    console.log(
      chalk.dim('  3. Set API keys via environment variables (recommended):\n')
    );
    console.log(chalk.dim('     export HUBSPOT_ACCESS_TOKEN=your_token'));
    console.log(chalk.dim('     export ANTHROPIC_API_KEY=your_key\n'));
  } catch (error) {
    logger.error({ error }, 'Failed to save configuration');
    console.error(chalk.red('\n✗ Failed to save configuration:'), (error as Error).message);
    process.exit(1);
  }
}

/**
 * Display current configuration
 */
export async function configShow(options: { config?: string }): Promise<void> {
  const manager = new ConfigManager();

  try {
    const config = await manager.load(options.config);
    const masked = ConfigManager.maskSensitive(config);

    console.log(chalk.bold('\n📋 Current Configuration:\n'));
    console.log(yaml.dump(masked, { indent: 2, lineWidth: 100 }));
  } catch (error) {
    logger.error({ error }, 'Failed to load configuration');
    console.error(chalk.red('✗ Failed to load configuration:'), (error as Error).message);
    process.exit(1);
  }
}

/**
 * Validate configuration
 */
export async function configValidate(options: { config?: string }): Promise<void> {
  console.log(chalk.bold('\n🔍 Validating configuration...\n'));

  const manager = new ConfigManager();
  const result = await manager.validate(options.config);

  if (result.valid) {
    console.log(chalk.green('✓ Configuration is valid\n'));

    // Try to load and show summary
    try {
      const config = await manager.load(options.config);
      console.log(chalk.dim('Company:'), config.company.name);
      console.log(chalk.dim('Industry:'), config.company.industry);
      console.log(chalk.dim('Business Model:'), config.company.business_model);

      // Check for credentials
      const hasHubSpot = config.hubspot.access_token || process.env.HUBSPOT_ACCESS_TOKEN;
      const hasAnthropic = config.anthropic.api_key || process.env.ANTHROPIC_API_KEY;

      console.log(
        chalk.dim('\nCredentials:'),
        hasHubSpot ? chalk.green('✓ HubSpot') : chalk.yellow('⚠ HubSpot missing'),
        hasAnthropic ? chalk.green('✓ Anthropic') : chalk.yellow('⚠ Anthropic missing')
      );

      if (!hasHubSpot || !hasAnthropic) {
        console.log(
          chalk.yellow(
            '\n⚠ Missing credentials. Set via environment variables or config file.\n'
          )
        );
      }
    } catch (error) {
      // Validation passed but loading failed (shouldn't happen)
      logger.warn({ error }, 'Validation passed but loading failed');
    }
  } else {
    console.log(chalk.red('✗ Configuration is invalid:\n'));
    result.errors?.forEach((error) => {
      console.log(chalk.red(`  - ${error}`));
    });
    console.log();
    process.exit(1);
  }
}

/**
 * Set a configuration value
 */
export async function configSet(
  key: string,
  value: string,
  options: { config?: string }
): Promise<void> {
  const manager = new ConfigManager();

  try {
    // Parse key path (e.g., "company.name" or "rules.stale_contact_days")
    const parts = key.split('.');

    if (parts.length === 0) {
      throw new Error('Invalid key path');
    }

    // Build partial config update
    const update: any = {};
    let current = update;

    for (let i = 0; i < parts.length - 1; i++) {
      current[parts[i]] = {};
      current = current[parts[i]];
    }

    // Try to parse value as JSON (for numbers, booleans, arrays)
    let parsedValue: unknown = value;
    try {
      parsedValue = JSON.parse(value);
    } catch {
      // Keep as string
    }

    current[parts[parts.length - 1]] = parsedValue;

    // Update config
    await manager.update(update, options.config);

    console.log(chalk.green(`\n✓ Updated ${key} = ${value}\n`));
  } catch (error) {
    logger.error({ error, key, value }, 'Failed to set configuration value');
    console.error(chalk.red('✗ Failed to update configuration:'), (error as Error).message);
    process.exit(1);
  }
}
