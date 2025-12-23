/**
 * Tool Schemas for Claude Data Exploration
 *
 * Defines tools that Claude can use to explore HubSpot data during analysis
 */

import type { Tool } from '@anthropic-ai/sdk/resources/messages.js';

/**
 * Tool for reporting data quality issues (structured output)
 */
export const reportDataQualityIssuesTool: Tool = {
  name: 'report_data_quality_issues',
  description: 'Report data quality issues found in the contacts',
  input_schema: {
    type: 'object',
    properties: {
      issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            contactId: { type: 'string', description: 'HubSpot contact ID' },
            issueType: {
              type: 'string',
              description: 'Type of issue (e.g., missing_field, invalid_format, typo, anomaly)',
            },
            severity: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Severity of the issue',
            },
            field: { type: 'string', description: 'Field with the issue' },
            currentValue: { type: 'string', description: 'Current (problematic) value' },
            description: { type: 'string', description: 'Description of the issue' },
            suggestedFix: { type: 'string', description: 'Suggested fix for the issue' },
            confidence: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Confidence in this assessment',
            },
          },
          required: ['contactId', 'issueType', 'severity', 'description', 'confidence'],
        },
      },
      summary: {
        type: 'string',
        description: 'Overall summary of the data quality assessment',
      },
      patterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Patterns detected across multiple records',
      },
    },
    required: ['issues', 'summary'],
  },
};

/**
 * Tool for reporting duplicate contacts
 */
export const reportDuplicatesTool: Tool = {
  name: 'report_duplicates',
  description: 'Report potential duplicate contacts found',
  input_schema: {
    type: 'object',
    properties: {
      duplicateSets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            contactIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'IDs of contacts that may be duplicates',
            },
            matchReason: {
              type: 'string',
              description: 'Why these contacts are considered duplicates',
            },
            confidence: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
            },
            primaryContactId: {
              type: 'string',
              description: 'Recommended primary contact to keep',
            },
            mergeStrategy: {
              type: 'string',
              description: 'Recommended approach for merging',
            },
          },
          required: ['contactIds', 'matchReason', 'confidence'],
        },
      },
      summary: { type: 'string' },
    },
    required: ['duplicateSets', 'summary'],
  },
};

/**
 * Tool for reporting property usage analysis
 */
export const reportPropertyAnalysisTool: Tool = {
  name: 'report_property_analysis',
  description: 'Report analysis of property usage and recommendations',
  input_schema: {
    type: 'object',
    properties: {
      properties: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            propertyName: { type: 'string' },
            usageRate: { type: 'number', description: 'Percentage of records using this property' },
            dataQuality: {
              type: 'string',
              enum: ['good', 'fair', 'poor'],
            },
            recommendation: {
              type: 'string',
              enum: ['keep', 'consolidate', 'deprecate', 'rename'],
            },
            reasoning: { type: 'string' },
          },
          required: ['propertyName', 'usageRate', 'recommendation', 'reasoning'],
        },
      },
      summary: { type: 'string' },
      recommendations: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['properties', 'summary', 'recommendations'],
  },
};

/**
 * Tool for general analysis summary
 */
export const reportAnalysisSummaryTool: Tool = {
  name: 'report_analysis_summary',
  description: 'Report overall analysis summary and recommendations',
  input_schema: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'Natural language summary of findings',
      },
      keyFindings: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of key findings',
      },
      recommendations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
            },
            estimatedImpact: { type: 'string' },
          },
          required: ['title', 'description', 'priority'],
        },
      },
      metrics: {
        type: 'object',
        description: 'Key metrics from the analysis',
        additionalProperties: true,
      },
    },
    required: ['summary', 'keyFindings', 'recommendations'],
  },
};

/**
 * Get tools for data quality analysis
 */
export function getDataQualityTools(): Tool[] {
  return [reportDataQualityIssuesTool, reportAnalysisSummaryTool];
}

/**
 * Get tools for duplicate analysis
 */
export function getDuplicateAnalysisTools(): Tool[] {
  return [reportDuplicatesTool, reportAnalysisSummaryTool];
}

/**
 * Get tools for property analysis
 */
export function getPropertyAnalysisTools(): Tool[] {
  return [reportPropertyAnalysisTool, reportAnalysisSummaryTool];
}
