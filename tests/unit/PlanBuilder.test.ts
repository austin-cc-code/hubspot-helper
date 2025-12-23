/**
 * Unit tests for PlanBuilder class
 * Epic 7: Action Plan System
 */

import { describe, it, expect } from '@jest/globals';
import { randomUUID } from 'crypto';
import { PlanBuilder } from '../../src/actions/PlanBuilder.js';
import type { AuditResult, AuditIssue } from '../../src/types/audit.js';

describe('PlanBuilder', () => {
  const createTestAuditResult = (issues: AuditIssue[]): AuditResult => ({
    module: 'data-quality',
    timestamp: new Date('2025-01-15T10:30:00Z'),
    summary: {
      total_records: 100,
      issues_found: issues.length,
      by_severity: {
        low: issues.filter((i) => i.severity === 'low').length,
        medium: issues.filter((i) => i.severity === 'medium').length,
        high: issues.filter((i) => i.severity === 'high').length,
        critical: issues.filter((i) => i.severity === 'critical').length,
      },
      by_type: issues.reduce(
        (acc, issue) => {
          acc[issue.type] = (acc[issue.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      by_detection_method: {
        rule_based: issues.filter((i) => i.detection_method === 'rule').length,
        ai_reasoning: issues.filter((i) => i.detection_method === 'ai_reasoning').length,
        ai_exploratory: issues.filter((i) => i.detection_method === 'ai_exploratory').length,
      },
      ai_cost_usd: 0.05,
    },
    issues,
    ai_insights: {
      summary: 'Found issues using two-phase analysis',
      patterns_detected: ['Missing required fields is common'],
      recommendations: ['Review data collection processes'],
      thinking_summary: 'Analyzed with rule-based and AI methods',
    },
  });

  describe('buildPlan', () => {
    it('should convert audit result to action plan', async () => {
      const issues: AuditIssue[] = [
        {
          id: randomUUID(),
          type: 'missing_required_field',
          severity: 'high',
          objectType: 'contact',
          objectId: 'contact123',
          description: 'Missing required field: email',
          currentValue: undefined,
          suggestedValue: 'test@example.com',
          confidence: 'high',
          detection_method: 'rule',
        },
        {
          id: randomUUID(),
          type: 'invalid_email_format',
          severity: 'high',
          objectType: 'contact',
          objectId: 'contact456',
          description: 'Invalid email format',
          currentValue: 'invalid-email',
          suggestedValue: 'test@example.com',
          confidence: 'high',
          detection_method: 'rule',
        },
      ];

      const auditResult = createTestAuditResult(issues);
      const builder = new PlanBuilder();
      const plan = await builder.buildPlan(auditResult);

      expect(plan).toBeDefined();
      expect(plan.id).toBeDefined();
      expect(plan.source_audit).toBe('data-quality');
      expect(plan.actions).toHaveLength(2);
      expect(plan.summary.total_actions).toBe(2);
    });

    it('should preserve AI cost in summary', async () => {
      const auditResult = createTestAuditResult([]);
      auditResult.summary.ai_cost_usd = 1.5;

      const builder = new PlanBuilder();
      const plan = await builder.buildPlan(auditResult);

      expect(plan.summary.estimated_ai_cost_usd).toBe(1.5);
    });

    it('should include AI context when configured', async () => {
      const auditResult = createTestAuditResult([]);
      const builder = new PlanBuilder({ includeAIContext: true });
      const plan = await builder.buildPlan(auditResult);

      expect(plan.ai_context).toBeDefined();
      expect(plan.ai_context?.patterns_identified).toHaveLength(1);
      expect(plan.ai_context?.strategic_recommendations).toHaveLength(1);
    });

    it('should exclude AI context when configured', async () => {
      const auditResult = createTestAuditResult([]);
      const builder = new PlanBuilder({ includeAIContext: false });
      const plan = await builder.buildPlan(auditResult);

      expect(plan.ai_context).toBeUndefined();
    });

    it('should skip low-confidence actions when configured', async () => {
      const issues: AuditIssue[] = [
        {
          id: randomUUID(),
          type: 'missing_required_field',
          severity: 'high',
          objectType: 'contact',
          objectId: 'contact123',
          description: 'Missing required field: email',
          confidence: 'high',
          detection_method: 'rule',
        },
        {
          id: randomUUID(),
          type: 'obvious_typo',
          severity: 'low',
          objectType: 'contact',
          objectId: 'contact456',
          description: 'Possible typo in name',
          confidence: 'low',
          detection_method: 'ai_reasoning',
        },
      ];

      const auditResult = createTestAuditResult(issues);
      const builder = new PlanBuilder({ includeLowConfidence: false });
      const plan = await builder.buildPlan(auditResult);

      expect(plan.actions).toHaveLength(1);
      expect(plan.actions[0].confidence).toBe('high');
    });
  });

  describe('action type determination', () => {
    it('should map missing_required_field to update_property', async () => {
      const issues: AuditIssue[] = [
        {
          id: randomUUID(),
          type: 'missing_required_field',
          severity: 'high',
          objectType: 'contact',
          objectId: 'contact123',
          description: 'Missing required field: email',
          confidence: 'high',
          detection_method: 'rule',
        },
      ];

      const auditResult = createTestAuditResult(issues);
      const builder = new PlanBuilder();
      const plan = await builder.buildPlan(auditResult);

      expect(plan.actions[0].type).toBe('update_property');
    });

    it('should map invalid format issues to update_property', async () => {
      const issues: AuditIssue[] = [
        {
          id: randomUUID(),
          type: 'invalid_email_format',
          severity: 'high',
          objectType: 'contact',
          objectId: 'contact123',
          description: 'Invalid email format',
          confidence: 'high',
          detection_method: 'rule',
        },
        {
          id: randomUUID(),
          type: 'invalid_phone_format',
          severity: 'medium',
          objectType: 'contact',
          objectId: 'contact456',
          description: 'Invalid phone format',
          confidence: 'high',
          detection_method: 'rule',
        },
      ];

      const auditResult = createTestAuditResult(issues);
      const builder = new PlanBuilder();
      const plan = await builder.buildPlan(auditResult);

      expect(plan.actions).toHaveLength(2);
      expect(plan.actions.every((a) => a.type === 'update_property')).toBe(true);
    });

    it('should map stale_contact to set_marketing_status', async () => {
      const issues: AuditIssue[] = [
        {
          id: randomUUID(),
          type: 'stale_contact',
          severity: 'medium',
          objectType: 'contact',
          objectId: 'contact123',
          description: 'No activity in 365+ days',
          confidence: 'high',
          detection_method: 'rule',
        },
      ];

      const auditResult = createTestAuditResult(issues);
      const builder = new PlanBuilder();
      const plan = await builder.buildPlan(auditResult);

      expect(plan.actions[0].type).toBe('set_marketing_status');
    });
  });

  describe('AI reasoning extraction', () => {
    it('should extract AI reasoning for AI-detected issues', async () => {
      const issues: AuditIssue[] = [
        {
          id: randomUUID(),
          type: 'name_typo',
          severity: 'medium',
          objectType: 'contact',
          objectId: 'contact123',
          description: 'Potential name typo',
          confidence: 'medium',
          detection_method: 'ai_reasoning',
          reasoning: 'Name pattern suggests possible typo based on common variations',
        },
      ];

      const auditResult = createTestAuditResult(issues);
      const builder = new PlanBuilder({ includeAIReasoning: true });
      const plan = await builder.buildPlan(auditResult);

      expect(plan.actions[0].ai_reasoning).toBeDefined();
      expect(plan.actions[0].ai_reasoning?.primary_reason).toContain('Name pattern');
      expect(plan.actions[0].ai_reasoning?.confidence_factors).toBeDefined();
    });

    it('should not include AI reasoning for rule-based issues', async () => {
      const issues: AuditIssue[] = [
        {
          id: randomUUID(),
          type: 'missing_required_field',
          severity: 'high',
          objectType: 'contact',
          objectId: 'contact123',
          description: 'Missing required field: email',
          confidence: 'high',
          detection_method: 'rule',
        },
      ];

      const auditResult = createTestAuditResult(issues);
      const builder = new PlanBuilder({ includeAIReasoning: true });
      const plan = await builder.buildPlan(auditResult);

      expect(plan.actions[0].ai_reasoning).toBeUndefined();
    });

    it('should exclude AI reasoning when configured', async () => {
      const issues: AuditIssue[] = [
        {
          id: randomUUID(),
          type: 'name_typo',
          severity: 'medium',
          objectType: 'contact',
          objectId: 'contact123',
          description: 'Potential name typo',
          confidence: 'medium',
          detection_method: 'ai_reasoning',
          reasoning: 'AI detected pattern',
        },
      ];

      const auditResult = createTestAuditResult(issues);
      const builder = new PlanBuilder({ includeAIReasoning: false });
      const plan = await builder.buildPlan(auditResult);

      expect(plan.actions[0].ai_reasoning).toBeUndefined();
    });
  });

  describe('reversibility and confirmation', () => {
    it('should mark update_property actions as reversible', async () => {
      const issues: AuditIssue[] = [
        {
          id: randomUUID(),
          type: 'missing_required_field',
          severity: 'high',
          objectType: 'contact',
          objectId: 'contact123',
          description: 'Missing field',
          confidence: 'high',
          detection_method: 'rule',
        },
      ];

      const auditResult = createTestAuditResult(issues);
      const builder = new PlanBuilder();
      const plan = await builder.buildPlan(auditResult);

      expect(plan.actions[0].reversible).toBe(true);
    });

    it('should require confirmation for low-confidence actions', async () => {
      const issues: AuditIssue[] = [
        {
          id: randomUUID(),
          type: 'obvious_typo',
          severity: 'low',
          objectType: 'contact',
          objectId: 'contact123',
          description: 'Possible typo',
          confidence: 'low',
          detection_method: 'ai_reasoning',
        },
      ];

      const auditResult = createTestAuditResult(issues);
      const builder = new PlanBuilder();
      const plan = await builder.buildPlan(auditResult);

      expect(plan.actions[0].requires_confirmation).toBe(true);
    });

    it('should require confirmation for high-severity issues', async () => {
      const issues: AuditIssue[] = [
        {
          id: randomUUID(),
          type: 'missing_required_field',
          severity: 'critical',
          objectType: 'contact',
          objectId: 'contact123',
          description: 'Critical issue',
          confidence: 'high',
          detection_method: 'rule',
        },
      ];

      const auditResult = createTestAuditResult(issues);
      const builder = new PlanBuilder();
      const plan = await builder.buildPlan(auditResult);

      expect(plan.actions[0].requires_confirmation).toBe(true);
    });
  });

  describe('summary calculation', () => {
    it('should calculate summary correctly', async () => {
      const issues: AuditIssue[] = [
        {
          id: randomUUID(),
          type: 'missing_required_field',
          severity: 'high',
          objectType: 'contact',
          objectId: 'contact1',
          description: 'Missing field',
          confidence: 'high',
          detection_method: 'rule',
        },
        {
          id: randomUUID(),
          type: 'invalid_email_format',
          severity: 'high',
          objectType: 'contact',
          objectId: 'contact2',
          description: 'Invalid email',
          confidence: 'high',
          detection_method: 'rule',
        },
        {
          id: randomUUID(),
          type: 'name_typo',
          severity: 'medium',
          objectType: 'contact',
          objectId: 'contact3',
          description: 'Typo',
          confidence: 'medium',
          detection_method: 'ai_reasoning',
        },
      ];

      const auditResult = createTestAuditResult(issues);
      const builder = new PlanBuilder();
      const plan = await builder.buildPlan(auditResult);

      expect(plan.summary.total_actions).toBe(3);
      expect(plan.summary.by_confidence.high).toBe(2);
      expect(plan.summary.by_confidence.medium).toBe(1);
      expect(plan.summary.by_detection_method.rule_based).toBe(2);
      expect(plan.summary.by_detection_method.ai_reasoning).toBe(1);
    });
  });

  describe('static filter methods', () => {
    it('should filter by confidence level', async () => {
      const issues: AuditIssue[] = [
        {
          id: randomUUID(),
          type: 'missing_required_field',
          severity: 'high',
          objectType: 'contact',
          objectId: 'contact1',
          description: 'High confidence',
          confidence: 'high',
          detection_method: 'rule',
        },
        {
          id: randomUUID(),
          type: 'obvious_typo',
          severity: 'medium',
          objectType: 'contact',
          objectId: 'contact2',
          description: 'Medium confidence',
          confidence: 'medium',
          detection_method: 'ai_reasoning',
        },
        {
          id: randomUUID(),
          type: 'name_typo',
          severity: 'low',
          objectType: 'contact',
          objectId: 'contact3',
          description: 'Low confidence',
          confidence: 'low',
          detection_method: 'ai_reasoning',
        },
      ];

      const auditResult = createTestAuditResult(issues);
      const builder = new PlanBuilder();
      const plan = await builder.buildPlan(auditResult);

      const highOnly = PlanBuilder.filterByConfidence(plan.actions, 'high');
      expect(highOnly).toHaveLength(1);

      const mediumUp = PlanBuilder.filterByConfidence(plan.actions, 'medium');
      expect(mediumUp).toHaveLength(2);
    });

    it('should filter by detection method', async () => {
      const issues: AuditIssue[] = [
        {
          id: randomUUID(),
          type: 'missing_required_field',
          severity: 'high',
          objectType: 'contact',
          objectId: 'contact1',
          description: 'Rule-based',
          confidence: 'high',
          detection_method: 'rule',
        },
        {
          id: randomUUID(),
          type: 'name_typo',
          severity: 'medium',
          objectType: 'contact',
          objectId: 'contact2',
          description: 'AI reasoning',
          confidence: 'medium',
          detection_method: 'ai_reasoning',
        },
      ];

      const auditResult = createTestAuditResult(issues);
      const builder = new PlanBuilder();
      const plan = await builder.buildPlan(auditResult);

      const ruleBased = PlanBuilder.filterByDetectionMethod(plan.actions, ['rule']);
      expect(ruleBased).toHaveLength(1);

      const aiOnly = PlanBuilder.filterByDetectionMethod(plan.actions, ['ai_reasoning', 'ai_exploratory']);
      expect(aiOnly).toHaveLength(1);
    });
  });
});
