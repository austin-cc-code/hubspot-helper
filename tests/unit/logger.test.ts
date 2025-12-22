/**
 * Logger utility tests
 */

import { describe, it, expect } from '@jest/globals';
import { safeLog } from '../../src/utils/logger.js';

describe('Logger', () => {
  describe('safeLog', () => {
    it('should redact email fields', () => {
      const input = { email: 'test@example.com', name: 'John' };
      const result = safeLog(input);
      expect(result.email).toBe('[REDACTED]');
      expect(result.name).toBe('[REDACTED]');
    });

    it('should handle nested objects', () => {
      const input = {
        contact: {
          email: 'test@example.com',
          company: 'Test Corp',
        },
      };
      const result = safeLog(input);
      expect((result.contact as Record<string, string>).email).toBe('[REDACTED]');
      expect((result.contact as Record<string, string>).company).toBe('Test Corp');
    });

    it('should handle arrays', () => {
      const input = [{ email: 'test@example.com' }, { email: 'other@example.com' }];
      const result = safeLog(input);
      expect(result[0].email).toBe('[REDACTED]');
      expect(result[1].email).toBe('[REDACTED]');
    });

    it('should pass through primitives unchanged', () => {
      expect(safeLog('test')).toBe('test');
      expect(safeLog(123)).toBe(123);
      expect(safeLog(null)).toBe(null);
    });
  });
});
