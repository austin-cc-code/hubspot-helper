/**
 * Error classes Unit Tests
 */

import {
  HubSpotError,
  AuthError,
  ScopeError,
  RateLimitError,
  NotFoundError,
  ValidationError,
  ConflictError,
  parseHubSpotError,
} from '../../src/services/errors.js';

describe('Error Classes', () => {
  describe('HubSpotError', () => {
    it('should create error with message and code', () => {
      const error = new HubSpotError('Test error', 500, 'TEST');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.category).toBe('TEST');
      expect(error.name).toBe('HubSpotError');
    });
  });

  describe('AuthError', () => {
    it('should create auth error with default message', () => {
      const error = new AuthError();

      expect(error.message).toContain('Authentication failed');
      expect(error.statusCode).toBe(401);
      expect(error.category).toBe('AUTHENTICATION');
      expect(error.name).toBe('AuthError');
    });

    it('should create auth error with custom message', () => {
      const error = new AuthError('Invalid token');

      expect(error.message).toBe('Invalid token');
    });
  });

  describe('ScopeError', () => {
    it('should create scope error', () => {
      const error = new ScopeError();

      expect(error.message).toContain('Missing required scope');
      expect(error.statusCode).toBe(403);
      expect(error.category).toBe('AUTHORIZATION');
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error with retry after', () => {
      const error = new RateLimitError('Rate limited', 10);

      expect(error.message).toContain('Rate limit');
      expect(error.statusCode).toBe(429);
      expect(error.category).toBe('RATE_LIMIT');
      expect(error.retryAfter).toBe(10);
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with resource details', () => {
      const error = new NotFoundError('Contact not found', 'contact', '12345');

      expect(error.message).toBe('Contact not found');
      expect(error.statusCode).toBe(404);
      expect(error.resourceType).toBe('contact');
      expect(error.resourceId).toBe('12345');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with field errors', () => {
      const fieldErrors = [
        { field: 'email', message: 'Invalid email format' },
        { field: 'name', message: 'Name is required' },
      ];

      const error = new ValidationError('Validation failed', fieldErrors);

      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.errors).toEqual(fieldErrors);
    });
  });

  describe('ConflictError', () => {
    it('should create conflict error', () => {
      const error = new ConflictError();

      expect(error.message).toContain('Conflict');
      expect(error.statusCode).toBe(409);
    });
  });

  describe('parseHubSpotError', () => {
    it('should parse 401 error', () => {
      const rawError = {
        statusCode: 401,
        message: 'Unauthorized',
      };

      expect(() => parseHubSpotError(rawError)).toThrow(AuthError);
    });

    it('should parse 403 error', () => {
      const rawError = {
        statusCode: 403,
        message: 'Forbidden',
      };

      expect(() => parseHubSpotError(rawError)).toThrow(ScopeError);
    });

    it('should parse 404 error', () => {
      const rawError = {
        statusCode: 404,
        message: 'Not found',
      };

      expect(() => parseHubSpotError(rawError)).toThrow(NotFoundError);
    });

    it('should parse 409 error', () => {
      const rawError = {
        statusCode: 409,
        message: 'Conflict',
      };

      expect(() => parseHubSpotError(rawError)).toThrow(ConflictError);
    });

    it('should parse 429 error with retry-after header', () => {
      const rawError = {
        statusCode: 429,
        message: 'Rate limit exceeded',
        response: {
          headers: {
            'retry-after': '30',
          },
        },
      };

      try {
        parseHubSpotError(rawError);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect(error.retryAfter).toBe(30);
      }
    });

    it('should parse 400 validation error', () => {
      const rawError = {
        statusCode: 400,
        message: 'Validation failed',
        body: {
          errors: [{ field: 'email', message: 'Invalid' }],
        },
      };

      try {
        parseHubSpotError(rawError);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.errors).toBeDefined();
      }
    });

    it('should parse unknown status codes as HubSpotError', () => {
      const rawError = {
        statusCode: 500,
        message: 'Internal server error',
      };

      expect(() => parseHubSpotError(rawError)).toThrow(HubSpotError);
    });

    it('should handle errors without status code', () => {
      const rawError = {
        message: 'Unknown error',
      };

      expect(() => parseHubSpotError(rawError)).toThrow(HubSpotError);
    });

    it('should handle errors with code instead of statusCode', () => {
      const rawError = {
        code: 401,
        message: 'Unauthorized',
      };

      expect(() => parseHubSpotError(rawError)).toThrow(AuthError);
    });
  });
});
