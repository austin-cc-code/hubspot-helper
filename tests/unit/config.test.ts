/**
 * ConfigManager tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ConfigManager } from '../../src/config/ConfigManager.js';
import { configSchema } from '../../src/config/schema.js';
import type { Config } from '../../src/config/schema.js';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';

describe('ConfigManager', () => {
  let tempDir: string;
  let testConfigPath: string;

  beforeEach(() => {
    // Create temporary directory for test configs
    tempDir = mkdtempSync(join(tmpdir(), 'config-test-'));
    testConfigPath = join(tempDir, 'test-config.yaml');
  });

  afterEach(() => {
    // Clean up temp directory
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('createTemplate', () => {
    it('should create a valid config template', () => {
      const config = ConfigManager.createTemplate({
        name: 'Test Company',
        industry: 'Technology',
        business_model: 'B2B',
      });

      // Validate against schema
      const result = configSchema.safeParse(config);
      expect(result.success).toBe(true);

      expect(config.company.name).toBe('Test Company');
      expect(config.company.industry).toBe('Technology');
      expect(config.company.business_model).toBe('B2B');

      // Check defaults are applied
      expect(config.settings.batch_size).toBe(100);
      expect(config.rules.stale_contact_days).toBe(365);
      expect(config.security.mask_pii_in_logs).toBe(true);
    });
  });

  describe('save and load', () => {
    it('should save and load config successfully', async () => {
      const manager = new ConfigManager();
      const config = ConfigManager.createTemplate({
        name: 'Test Company',
        industry: 'Technology',
        business_model: 'B2B',
      });

      // Save
      await manager.save(config, testConfigPath);

      // Load
      const loaded = await manager.load(testConfigPath);

      expect(loaded.company.name).toBe('Test Company');
      expect(loaded.company.industry).toBe('Technology');
      expect(loaded.settings.batch_size).toBe(100);
    });

    it('should throw error when loading non-existent config', async () => {
      const manager = new ConfigManager();

      await expect(manager.load('/non/existent/path.yaml')).rejects.toThrow(
        'Configuration file not found'
      );
    });
  });

  describe('validate', () => {
    it('should validate valid config', async () => {
      const config = ConfigManager.createTemplate({
        name: 'Test Company',
        industry: 'Technology',
        business_model: 'B2B',
      });

      // Write config to file
      writeFileSync(testConfigPath, yaml.dump(config));

      const manager = new ConfigManager();
      const result = await manager.validate(testConfigPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should detect invalid config', async () => {
      const invalidConfig = {
        company: {
          name: '',  // Invalid: empty string
          industry: 'Tech',
          business_model: 'Invalid', // Invalid: not in enum
        },
      };

      writeFileSync(testConfigPath, yaml.dump(invalidConfig));

      const manager = new ConfigManager();
      const result = await manager.validate(testConfigPath);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should detect missing config file', async () => {
      const manager = new ConfigManager();
      const result = await manager.validate('/non/existent.yaml');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Configuration file not found');
    });
  });

  describe('update', () => {
    it('should update specific config values', async () => {
      const manager = new ConfigManager();
      const config = ConfigManager.createTemplate({
        name: 'Test Company',
        industry: 'Technology',
        business_model: 'B2B',
      });

      await manager.save(config, testConfigPath);

      // Update company name
      const updated = await manager.update(
        {
          company: {
            name: 'Updated Company',
          },
        },
        testConfigPath
      );

      expect(updated.company.name).toBe('Updated Company');
      expect(updated.company.industry).toBe('Technology'); // Unchanged
    });

    it('should update nested values', async () => {
      const manager = new ConfigManager();
      const config = ConfigManager.createTemplate({
        name: 'Test Company',
        industry: 'Technology',
        business_model: 'B2B',
      });

      await manager.save(config, testConfigPath);

      // Update rate limit
      const updated = await manager.update(
        {
          settings: {
            rate_limit: {
              requests_per_10_seconds: 50,
            },
          },
        },
        testConfigPath
      );

      expect(updated.settings.rate_limit.requests_per_10_seconds).toBe(50);
      expect(updated.settings.rate_limit.burst_limit).toBe(10); // Unchanged
    });
  });

  describe('maskSensitive', () => {
    it('should mask API keys and tokens', () => {
      const config = ConfigManager.createTemplate({
        name: 'Test Company',
        industry: 'Technology',
        business_model: 'B2B',
      });

      config.hubspot.access_token = 'pat-na1-secrettoken123456';
      config.anthropic.api_key = 'sk-ant-api-secretkey123456';

      const masked = ConfigManager.maskSensitive(config);

      expect(masked.hubspot.access_token).toBe('pat-na1-...');
      expect(masked.anthropic.api_key).toBe('sk-ant-a...');
      expect(masked.company.name).toBe('Test Company'); // Unchanged
    });

    it('should handle missing credentials gracefully', () => {
      const config = ConfigManager.createTemplate({
        name: 'Test Company',
        industry: 'Technology',
        business_model: 'B2B',
      });

      // Explicitly set to undefined
      config.hubspot.access_token = undefined;
      config.anthropic.api_key = undefined;

      const masked = ConfigManager.maskSensitive(config);

      // Should remain undefined (not mask)
      expect(masked.hubspot.access_token).toBeUndefined();
      expect(masked.anthropic.api_key).toBeUndefined();
    });
  });

  describe('exists', () => {
    it('should detect existing config file', () => {
      writeFileSync(testConfigPath, 'test: true');

      expect(ConfigManager.exists(testConfigPath)).toBe(true);
    });

    it('should return false for non-existent file', () => {
      expect(ConfigManager.exists('/non/existent.yaml')).toBe(false);
    });
  });

  describe('environment variable fallbacks', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should merge environment variables', async () => {
      process.env.HUBSPOT_ACCESS_TOKEN = 'env-token-123';
      process.env.ANTHROPIC_API_KEY = 'env-key-456';

      const config = ConfigManager.createTemplate({
        name: 'Test Company',
        industry: 'Technology',
        business_model: 'B2B',
      });

      writeFileSync(testConfigPath, yaml.dump(config));

      const manager = new ConfigManager();
      const loaded = await manager.load(testConfigPath);

      expect(loaded.hubspot.access_token).toBe('env-token-123');
      expect(loaded.anthropic.api_key).toBe('env-key-456');
    });

    it('should prefer env vars over config file values', async () => {
      process.env.HUBSPOT_ACCESS_TOKEN = 'env-token-123';

      const config = ConfigManager.createTemplate({
        name: 'Test Company',
        industry: 'Technology',
        business_model: 'B2B',
      });
      config.hubspot.access_token = 'config-token-456';

      writeFileSync(testConfigPath, yaml.dump(config));

      const manager = new ConfigManager();
      const loaded = await manager.load(testConfigPath);

      // Env var should override config file
      expect(loaded.hubspot.access_token).toBe('env-token-123');
    });
  });
});
