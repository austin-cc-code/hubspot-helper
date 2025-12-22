/**
 * Custom error classes for HubSpot API operations
 */

export class HubSpotError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly category?: string
  ) {
    super(message);
    this.name = 'HubSpotError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthError extends HubSpotError {
  constructor(message: string = 'Authentication failed. Invalid or expired access token.') {
    super(message, 401, 'AUTHENTICATION');
    this.name = 'AuthError';
  }
}

export class ScopeError extends HubSpotError {
  constructor(message: string = 'Missing required scope. Check your Private App permissions.') {
    super(message, 403, 'AUTHORIZATION');
    this.name = 'ScopeError';
  }
}

export class RateLimitError extends HubSpotError {
  constructor(
    message: string = 'Rate limit exceeded.',
    public readonly retryAfter?: number
  ) {
    super(message, 429, 'RATE_LIMIT');
    this.name = 'RateLimitError';
  }
}

export class NotFoundError extends HubSpotError {
  constructor(
    message: string = 'Resource not found.',
    public readonly resourceType?: string,
    public readonly resourceId?: string
  ) {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends HubSpotError {
  constructor(
    message: string = 'Validation failed.',
    public readonly errors?: Array<{ field: string; message: string }>
  ) {
    super(message, 400, 'VALIDATION');
    this.name = 'ValidationError';
  }
}

export class ConflictError extends HubSpotError {
  constructor(message: string = 'Conflict. Resource already exists or cannot be modified.') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

/**
 * Parse HubSpot API error response and throw appropriate error
 */
export function parseHubSpotError(error: any): never {
  const statusCode = error.statusCode || error.code;
  const message = error.message || error.body?.message || 'Unknown HubSpot API error';

  switch (statusCode) {
    case 401:
      throw new AuthError(message);
    case 403:
      throw new ScopeError(message);
    case 404:
      throw new NotFoundError(message);
    case 409:
      throw new ConflictError(message);
    case 429: {
      const retryAfter = error.response?.headers?.['retry-after'];
      throw new RateLimitError(message, retryAfter ? parseInt(retryAfter, 10) : undefined);
    }
    case 400:
      throw new ValidationError(message, error.body?.errors);
    default:
      throw new HubSpotError(message, statusCode, error.category);
  }
}
