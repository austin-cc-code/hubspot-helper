/**
 * Unit tests for ActionPlan class
 * Epic 7: Action Plan System
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { ActionPlan } from '../../src/actions/ActionPlan.js';
import type { ActionPlan as ActionPlanType, Action } from '../../src/types/actions.js';

const TEST_DIR = join(process.cwd(), 'test-output', 'action-plans');

describe('ActionPlan', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  const createTestPlan = (): ActionPlanType => ({
    id: randomUUID(),
    created_at: new Date('2025-01-15T10:30:00Z'),
    source_audit: 'data-quality',
    summary: {
      total_actions: 3,
      by_type: {
        update_property: 2,
        set_marketing_status: 1,
        delete_contact: 0,
        merge_contacts: 0,
        remove_from_list: 0,
        create_association: 0,
      },
      by_confidence: {
        high: 2,
        medium: 1,
        low: 0,
      },
      by_detection_method: {
        rule_based: 2,
        ai_reasoning: 1,
        ai_exploratory: 0,
      },
      estimated_api_calls: 3,
      estimated_ai_cost_usd: 0.05,
    },
    actions: [
      {
        id: randomUUID(),
        type: 'update_property',
        confidence: 'high',
        target: {
          object_type: 'contact',
          object_id: 'contact123',
          display_name: 'test@example.com',
        },
        change: {
          description: 'Fix invalid email format',
          property: 'email',
          current_value: 'invalid-email',
          new_value: 'test@example.com',
        },
        reasoning: 'Email format is invalid',
        detection_method: 'rule',
        reversible: true,
        requires_confirmation: false,
      },
      {
        id: randomUUID(),
        type: 'update_property',
        confidence: 'high',
        target: {
          object_type: 'contact',
          object_id: 'contact456',
          display_name: 'John Smith',
        },
        change: {
          description: 'Update missing required field',
          property: 'firstname',
          current_value: undefined,
          new_value: 'John',
        },
        reasoning: 'Missing required field: firstname',
        detection_method: 'rule',
        reversible: true,
        requires_confirmation: false,
      },
      {
        id: randomUUID(),
        type: 'set_marketing_status',
        confidence: 'medium',
        target: {
          object_type: 'contact',
          object_id: 'contact789',
          display_name: 'old@example.com',
        },
        change: {
          description: 'Downgrade stale contact',
          property: 'hs_marketable_status',
          current_value: 'marketing',
          new_value: 'non-marketing',
        },
        reasoning: 'Contact has been inactive for 365+ days',
        detection_method: 'ai_reasoning',
        ai_reasoning: {
          primary_reason: 'No activity in 400 days, low engagement',
          confidence_factors: ['Clear pattern match', 'Supported by data analysis'],
        },
        reversible: true,
        requires_confirmation: false,
      },
    ],
    ai_context: {
      patterns_identified: ['Missing required fields is the most common issue'],
      strategic_recommendations: ['Review data collection processes'],
      thinking_summary: 'Found 3 data quality issues using two-phase analysis',
    },
  });

  describe('constructor and basic getters', () => {
    it('should create an ActionPlan instance', () => {
      const planData = createTestPlan();
      const plan = new ActionPlan(planData);

      expect(plan).toBeInstanceOf(ActionPlan);
      expect(plan.getId()).toBe(planData.id);
      expect(plan.getSourceAudit()).toBe('data-quality');
      expect(plan.getData()).toEqual(planData);
    });

    it('should get summary', () => {
      const planData = createTestPlan();
      const plan = new ActionPlan(planData);
      const summary = plan.getSummary();

      expect(summary.total_actions).toBe(3);
      expect(summary.by_confidence.high).toBe(2);
      expect(summary.by_detection_method.rule_based).toBe(2);
    });

    it('should get AI context', () => {
      const planData = createTestPlan();
      const plan = new ActionPlan(planData);
      const aiContext = plan.getAIContext();

      expect(aiContext).toBeDefined();
      expect(aiContext?.patterns_identified).toHaveLength(1);
      expect(aiContext?.strategic_recommendations).toHaveLength(1);
    });
  });

  describe('save and load', () => {
    it('should save plan to file', async () => {
      const planData = createTestPlan();
      const plan = new ActionPlan(planData);
      const filePath = join(TEST_DIR, 'test-plan.json');

      await plan.save(filePath);

      // Verify file exists and can be loaded
      const loaded = await ActionPlan.load(filePath);
      expect(loaded.getId()).toBe(plan.getId());
      expect(loaded.getSourceAudit()).toBe(plan.getSourceAudit());
    });

    it('should generate filename correctly', () => {
      const planData = createTestPlan();
      const plan = new ActionPlan(planData);
      const filename = plan.generateFilename();

      expect(filename).toMatch(/^data-quality-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
    });

    it('should load plan from file', async () => {
      const planData = createTestPlan();
      const plan = new ActionPlan(planData);
      const filePath = join(TEST_DIR, 'test-plan.json');

      await plan.save(filePath);
      const loaded = await ActionPlan.load(filePath);

      expect(loaded.getData().id).toBe(planData.id);
      expect(loaded.getData().actions).toHaveLength(3);
      expect(loaded.getData().created_at).toBeInstanceOf(Date);
    });

    it('should throw error when loading non-existent file', async () => {
      const filePath = join(TEST_DIR, 'non-existent.json');
      await expect(ActionPlan.load(filePath)).rejects.toThrow();
    });
  });

  describe('filtering actions', () => {
    it('should filter actions by confidence', () => {
      const planData = createTestPlan();
      const plan = new ActionPlan(planData);

      const highConfidence = plan.getActions({ confidence: ['high'] });
      expect(highConfidence).toHaveLength(2);
      expect(highConfidence.every((a) => a.confidence === 'high')).toBe(true);

      const mediumConfidence = plan.getActions({ confidence: ['medium'] });
      expect(mediumConfidence).toHaveLength(1);
    });

    it('should filter actions by detection method', () => {
      const planData = createTestPlan();
      const plan = new ActionPlan(planData);

      const ruleBased = plan.getActions({ detectionMethod: ['rule'] });
      expect(ruleBased).toHaveLength(2);

      const aiReasoning = plan.getActions({ detectionMethod: ['ai_reasoning'] });
      expect(aiReasoning).toHaveLength(1);
    });

    it('should filter actions by type', () => {
      const planData = createTestPlan();
      const plan = new ActionPlan(planData);

      const updateProperty = plan.getActions({ actionType: ['update_property'] });
      expect(updateProperty).toHaveLength(2);

      const setMarketingStatus = plan.getActions({ actionType: ['set_marketing_status'] });
      expect(setMarketingStatus).toHaveLength(1);
    });

    it('should filter reversible actions only', () => {
      const planData = createTestPlan();
      planData.actions[0].reversible = false; // Make first action non-reversible

      const plan = new ActionPlan(planData);
      const reversible = plan.getActions({ reversibleOnly: true });

      expect(reversible).toHaveLength(2);
      expect(reversible.every((a) => a.reversible)).toBe(true);
    });
  });

  describe('grouping actions', () => {
    it('should group actions by confidence', () => {
      const planData = createTestPlan();
      const plan = new ActionPlan(planData);
      const byConfidence = plan.getActionsByConfidence();

      expect(byConfidence.high).toHaveLength(2);
      expect(byConfidence.medium).toHaveLength(1);
      expect(byConfidence.low).toHaveLength(0);
    });

    it('should group actions by detection method', () => {
      const planData = createTestPlan();
      const plan = new ActionPlan(planData);
      const byDetection = plan.getActionsByDetectionMethod();

      expect(byDetection.rule).toHaveLength(2);
      expect(byDetection.ai_reasoning).toHaveLength(1);
      expect(byDetection.ai_exploratory).toHaveLength(0);
    });
  });

  describe('high-risk actions', () => {
    it('should identify non-reversible actions as high-risk', () => {
      const planData = createTestPlan();
      planData.actions[0].reversible = false;

      const plan = new ActionPlan(planData);
      const highRisk = plan.getHighRiskActions();

      expect(highRisk).toHaveLength(1);
      expect(highRisk[0].reversible).toBe(false);
    });

    it('should identify actions requiring confirmation as high-risk', () => {
      const planData = createTestPlan();
      planData.actions[1].requires_confirmation = true;

      const plan = new ActionPlan(planData);
      const highRisk = plan.getHighRiskActions();

      expect(highRisk).toHaveLength(1);
      expect(highRisk[0].requires_confirmation).toBe(true);
    });
  });

  describe('dependency management', () => {
    it('should validate dependencies correctly', () => {
      const planData = createTestPlan();
      const plan = new ActionPlan(planData);

      const validation = plan.validateDependencies();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid dependencies', () => {
      const planData = createTestPlan();
      planData.actions[0].dependencies = ['non-existent-action-id'];

      const plan = new ActionPlan(planData);
      const validation = plan.validateDependencies();

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should return actions in dependency order', () => {
      const planData = createTestPlan();
      const action1 = planData.actions[0];
      const action2 = planData.actions[1];
      const action3 = planData.actions[2];

      // action3 depends on action1
      action3.dependencies = [action1.id];
      // action2 depends on action3
      action2.dependencies = [action3.id];

      const plan = new ActionPlan(planData);
      const ordered = plan.getActionsInDependencyOrder();

      // Should be ordered: action1 -> action3 -> action2
      const indices = ordered.map((a) => planData.actions.indexOf(a));
      expect(indices).toEqual([0, 2, 1]);
    });
  });

  describe('filtered copy', () => {
    it('should create filtered copy of plan', () => {
      const planData = createTestPlan();
      const plan = new ActionPlan(planData);

      const filtered = plan.createFiltered({ confidence: ['high'] });
      const filteredData = filtered.getData();

      expect(filteredData.actions).toHaveLength(2);
      expect(filteredData.summary.total_actions).toBe(2);
      expect(filteredData.summary.by_confidence.high).toBe(2);
    });
  });

  describe('filename parsing', () => {
    it('should parse valid filename', () => {
      const result = ActionPlan.parseFilename('data-quality-2025-01-15T10-30-00.json');

      expect(result).not.toBeNull();
      expect(result?.sourceAudit).toBe('data-quality');
      expect(result?.timestamp).toBeInstanceOf(Date);
    });

    it('should return null for invalid filename', () => {
      const result = ActionPlan.parseFilename('invalid-filename.json');
      expect(result).toBeNull();
    });
  });
});
