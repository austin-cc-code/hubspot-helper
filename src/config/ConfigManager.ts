/**
 * Configuration Manager
 *
 * Handles loading, saving, and validating configuration files.
 * Supports environment variable fallbacks for API keys.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import yaml from 'js-yaml';
import dotenv from 'dotenv';
import { ZodError } from 'zod';
import { configSchema, type Config, type PartialConfig } from './schema.js';
import { defaultConfig } from './defaults.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('config');

// Load environment variables
dotenv.config();

export interface ConfigPaths {
  primary: string; // ~/.hubspot-audit/config.yaml
  fallback: string; // ./hubspot-audit.config.yaml
}

export class ConfigManager {
  private config: Config | null = null;
  private configPath: string | null = null;

  /**
   * Get standard config file paths
   */
  static getConfigPaths(): ConfigPaths {
    return {
      primary: join(homedir(), '.hubspot-audit', 'config.yaml'),
      fallback: join(process.cwd(), 'hubspot-audit.config.yaml'),
    };
  }

  /**
   * Find existing config file
   */
  static findConfigFile(customPath?: string): string | null {
    if (customPath) {
      return existsSync(customPath) ? customPath : null;
    }

    const paths = ConfigManager.getConfigPaths();

    if (existsSync(paths.primary)) {
      return paths.primary;
    }

    if (existsSync(paths.fallback)) {
      return paths.fallback;
    }

    return null;
  }

  /**
   * Load configuration from file
   */
  async load(customPath?: string): Promise<Config> {
    const configPath = ConfigManager.findConfigFile(customPath);

    if (!configPath) {
      throw new Error(
        'Configuration file not found. Run: hubspot-audit config init'
      );
    }

    logger.info({ configPath }, 'Loading configuration');

    try {
      const fileContents = await readFile(configPath, 'utf-8');
      const rawConfig = yaml.load(fileContents) as Record<string, unknown>;

      // Merge with environment variables
      const configWithEnv = this.mergeWithEnv(rawConfig);

      // Validate
      this.config = configSchema.parse(configWithEnv);
      this.configPath = configPath;

      logger.info('Configuration loaded successfully');
      return this.config;
    } catch (error) {
      if (error instanceof ZodError) {
        logger.error({ errors: error.errors }, 'Configuration validation failed');
        throw new Error(
          `Configuration validation failed:\n${this.formatZodErrors(error)}`
        );
      }
      throw error;
    }
  }

  /**
   * Save configuration to file
   */
  async save(config: Config, customPath?: string): Promise<void> {
    const paths = ConfigManager.getConfigPaths();
    const savePath = customPath || this.configPath || paths.primary;

    // Create directory if it doesn't exist
    const dir = dirname(savePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    // Validate before saving
    const validatedConfig = configSchema.parse(config);

    // Convert to YAML
    const yamlContent = yaml.dump(validatedConfig, {
      indent: 2,
      lineWidth: 100,
      noRefs: true,
    });

    await writeFile(savePath, yamlContent, 'utf-8');

    this.config = validatedConfig;
    this.configPath = savePath;

    logger.info({ configPath: savePath }, 'Configuration saved');
  }

  /**
   * Validate configuration without loading
   */
  async validate(customPath?: string): Promise<{ valid: boolean; errors?: string[] }> {
    const configPath = ConfigManager.findConfigFile(customPath);

    if (!configPath) {
      return {
        valid: false,
        errors: ['Configuration file not found'],
      };
    }

    try {
      const fileContents = await readFile(configPath, 'utf-8');
      const rawConfig = yaml.load(fileContents) as Record<string, unknown>;
      const configWithEnv = this.mergeWithEnv(rawConfig);

      configSchema.parse(configWithEnv);

      return { valid: true };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        };
      }

      return {
        valid: false,
        errors: [(error as Error).message],
      };
    }
  }

  /**
   * Update specific config values
   */
  async update(updates: PartialConfig, customPath?: string): Promise<Config> {
    // Load existing config
    const existing = this.config || (await this.load(customPath));

    // Deep merge updates
    const merged = this.deepMerge(existing, updates);

    // Validate and save
    await this.save(merged, customPath);

    return merged;
  }

  /**
   * Get current config (throws if not loaded)
   */
  getConfig(): Config {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }
    return this.config;
  }

  /**
   * Check if config file exists
   */
  static exists(customPath?: string): boolean {
    return ConfigManager.findConfigFile(customPath) !== null;
  }

  /**
   * Merge config with environment variables
   */
  private mergeWithEnv(config: Record<string, unknown>): Record<string, unknown> {
    const merged = { ...config };

    // HubSpot credentials from env
    if (process.env.HUBSPOT_ACCESS_TOKEN) {
      merged.hubspot = {
        ...(merged.hubspot as Record<string, unknown>),
        access_token: process.env.HUBSPOT_ACCESS_TOKEN,
      };
    }

    if (process.env.HUBSPOT_PORTAL_ID) {
      merged.hubspot = {
        ...(merged.hubspot as Record<string, unknown>),
        portal_id: process.env.HUBSPOT_PORTAL_ID,
      };
    }

    // Anthropic credentials from env
    if (process.env.ANTHROPIC_API_KEY) {
      merged.anthropic = {
        ...(merged.anthropic as Record<string, unknown>),
        api_key: process.env.ANTHROPIC_API_KEY,
      };
    }

    if (process.env.ANTHROPIC_MODEL) {
      merged.anthropic = {
        ...(merged.anthropic as Record<string, unknown>),
        model: process.env.ANTHROPIC_MODEL,
      };
    }

    return merged;
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: unknown, source: unknown): any {
    if (typeof target !== 'object' || target === null) {
      return source;
    }

    if (typeof source !== 'object' || source === null) {
      return target;
    }

    const result: Record<string, unknown> = { ...(target as Record<string, unknown>) };

    for (const key in source as Record<string, unknown>) {
      const sourceValue = (source as Record<string, unknown>)[key];
      const targetValue = result[key];

      if (
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue)
      ) {
        result[key] = this.deepMerge(targetValue, sourceValue);
      } else {
        result[key] = sourceValue;
      }
    }

    return result;
  }

  /**
   * Format Zod errors for display
   */
  private formatZodErrors(error: ZodError): string {
    return error.errors
      .map((e) => {
        const path = e.path.join('.');
        return `  - ${path}: ${e.message}`;
      })
      .join('\n');
  }

  /**
   * Create minimal config template (for init wizard)
   */
  static createTemplate(company: {
    name: string;
    industry: string;
    business_model: 'B2B' | 'B2C' | 'B2B2C';
  }): Config {
    return {
      ...defaultConfig,
      company,
    } as Config;
  }

  /**
   * Mask sensitive values for display
   */
  static maskSensitive(config: Config): Config {
    return {
      ...config,
      hubspot: {
        ...config.hubspot,
        access_token: config.hubspot.access_token
          ? `${config.hubspot.access_token.substring(0, 8)}...`
          : undefined,
      },
      anthropic: {
        ...config.anthropic,
        api_key: config.anthropic.api_key
          ? `${config.anthropic.api_key.substring(0, 8)}...`
          : undefined,
      },
    };
  }
}
