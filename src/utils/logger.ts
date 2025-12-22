/**
 * Logging utility using pino
 *
 * Features:
 * - Structured JSON logging (production)
 * - Pretty printing (development)
 * - PII masking for sensitive fields
 * - Child loggers for module-specific context
 */

import pino from 'pino';

// Fields that may contain PII and should be masked
const PII_FIELDS = ['email', 'phone', 'name', 'firstName', 'lastName', 'address'];

/**
 * Redact PII from objects before logging
 */
function redactPII<T>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactPII) as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (PII_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactPII(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

// Configure transport based on environment
const isPretty = process.env.LOG_PRETTY === 'true' || process.env.NODE_ENV === 'development';

const transport = isPretty
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    }
  : undefined;

// Create base logger
const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport,
  formatters: {
    level: (label) => ({ level: label }),
  },
  // Redact paths for PII fields
  redact: {
    paths: PII_FIELDS.map((field) => `*.${field}`),
    censor: '[REDACTED]',
  },
});

/**
 * Create a child logger with module context
 */
export function createLogger(module: string): pino.Logger {
  return baseLogger.child({ module });
}

/**
 * Create a safe loggable version of an object with PII redacted
 */
export function safeLog<T>(obj: T): T {
  return redactPII(obj);
}

export { baseLogger as logger };
