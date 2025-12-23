/**
 * Error handling and display utilities
 *
 * Provides consistent error formatting and helpful error messages
 */

import chalk from 'chalk';
import {
  HubSpotError,
  AuthError,
  ScopeError,
  RateLimitError,
  NotFoundError,
  ValidationError,
} from '../../services/errors.js';

export interface ErrorDisplayOptions {
  verbose?: boolean;
  json?: boolean;
  showStack?: boolean;
}

/**
 * Format and display an error
 */
export function displayError(error: Error, options: ErrorDisplayOptions = {}): void {
  if (options.json) {
    console.error(JSON.stringify({
      error: {
        name: error.name,
        message: error.message,
        code: (error as any).code,
        stack: options.showStack ? error.stack : undefined,
      },
    }, null, 2));
    return;
  }

  // Error header
  console.error(chalk.red.bold(`\n✗ Error: ${error.message}\n`));

  // Specific error type handling
  if (error instanceof AuthError) {
    displayAuthError(error, options);
  } else if (error instanceof ScopeError) {
    displayScopeError(error, options);
  } else if (error instanceof RateLimitError) {
    displayRateLimitError(error, options);
  } else if (error instanceof NotFoundError) {
    displayNotFoundError(error, options);
  } else if (error instanceof ValidationError) {
    displayValidationError(error, options);
  } else if (error instanceof HubSpotError) {
    displayHubSpotError(error, options);
  } else {
    displayGenericError(error, options);
  }

  // Stack trace in verbose mode
  if (options.verbose && error.stack) {
    console.error(chalk.dim('\nStack trace:'));
    console.error(chalk.dim(error.stack));
  }

  console.error(); // Empty line
}

function displayAuthError(_error: AuthError, _options: ErrorDisplayOptions): void {
  console.error(chalk.yellow('Authentication failed. Please check your access token.\n'));
  console.error(chalk.dim('Solutions:'));
  console.error(chalk.dim('  1. Verify your HubSpot access token is correct'));
  console.error(chalk.dim('  2. Check if the token has expired'));
  console.error(chalk.dim('  3. Ensure the token is set in environment or config:\n'));
  console.error(chalk.dim('     export HUBSPOT_ACCESS_TOKEN=your_token'));
  console.error(chalk.dim('     or: hubspot-audit config set hubspot.access_token "your_token"\n'));
}

function displayScopeError(_error: ScopeError, _options: ErrorDisplayOptions): void {
  console.error(chalk.yellow('Missing required API scopes.\n'));

  console.error(chalk.dim('Solutions:'));
  console.error(chalk.dim('  1. Update your Private App in HubSpot'));
  console.error(chalk.dim('  2. Add the required scopes'));
  console.error(chalk.dim('  3. Generate a new access token\n'));
}

function displayRateLimitError(error: RateLimitError, _options: ErrorDisplayOptions): void {
  console.error(chalk.yellow('Rate limit exceeded.\n'));

  if (error.retryAfter) {
    console.error(chalk.dim(`Retry after: ${error.retryAfter} seconds\n`));
  }

  console.error(chalk.dim('The tool will automatically retry with exponential backoff.'));
  console.error(chalk.dim('If this persists, consider:'));
  console.error(chalk.dim('  - Running audits during off-peak hours'));
  console.error(chalk.dim('  - Reducing batch sizes in config'));
  console.error(chalk.dim('  - Contacting HubSpot support for rate limit increases\n'));
}

function displayNotFoundError(error: NotFoundError, _options: ErrorDisplayOptions): void {
  console.error(chalk.yellow('Resource not found.\n'));

  if (error.resourceType && error.resourceId) {
    console.error(chalk.dim(`Resource: ${error.resourceType} (ID: ${error.resourceId})\n`));
  }

  console.error(chalk.dim('Solutions:'));
  console.error(chalk.dim('  - Verify the ID is correct'));
  console.error(chalk.dim('  - Check if the resource was deleted'));
  console.error(chalk.dim('  - Ensure you have access to this resource\n'));
}

function displayValidationError(error: ValidationError, _options: ErrorDisplayOptions): void {
  console.error(chalk.yellow('Validation failed.\n'));

  if (error.errors && error.errors.length > 0) {
    console.error(chalk.dim('Field errors:'));
    error.errors.forEach((fieldError) => {
      console.error(chalk.dim(`  ${fieldError.field}: ${fieldError.message}`));
    });
    console.error();
  }

  console.error(chalk.dim('Please correct the errors above and try again.\n'));
}

function displayHubSpotError(error: HubSpotError, _options: ErrorDisplayOptions): void {
  if (error.statusCode) {
    console.error(chalk.dim(`Status code: ${error.statusCode}\n`));
  }

  console.error(chalk.dim('This is a HubSpot API error.'));
  console.error(chalk.dim('Check the HubSpot API documentation for more details:\n'));
  console.error(chalk.dim('https://developers.hubspot.com/docs/api/error-handling\n'));
}

function displayGenericError(error: Error, options: ErrorDisplayOptions): void {
  console.error(chalk.dim('An unexpected error occurred.\n'));

  if (options.verbose) {
    console.error(chalk.dim('Error details:'));
    console.error(chalk.dim(`  Name: ${error.name}`));
    console.error(chalk.dim(`  Message: ${error.message}\n`));
  }

  console.error(chalk.dim('If this error persists, please report it at:'));
  console.error(chalk.dim('https://github.com/anthropics/hubspot-audit/issues\n'));
}

/**
 * Handle Ctrl+C gracefully
 */
export function setupGracefulShutdown(cleanup?: () => Promise<void>): void {
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    console.log(chalk.yellow(`\n\n⚠ Received ${signal}, shutting down gracefully...\n`));

    if (cleanup) {
      try {
        await cleanup();
      } catch (error) {
        console.error(chalk.red('Error during cleanup:'), error);
      }
    }

    console.log(chalk.dim('Goodbye!\n'));
    process.exit(130); // Standard exit code for SIGINT
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

/**
 * Format a warning message
 */
export function displayWarning(message: string, details?: string[]): void {
  console.warn(chalk.yellow(`\n⚠ Warning: ${message}\n`));

  if (details && details.length > 0) {
    details.forEach(detail => {
      console.warn(chalk.dim(`  ${detail}`));
    });
    console.warn();
  }
}

/**
 * Format an info message
 */
export function displayInfo(message: string, details?: string[]): void {
  console.log(chalk.blue(`\nℹ ${message}\n`));

  if (details && details.length > 0) {
    details.forEach(detail => {
      console.log(chalk.dim(`  ${detail}`));
    });
    console.log();
  }
}

/**
 * Format a success message
 */
export function displaySuccess(message: string, details?: string[]): void {
  console.log(chalk.green(`\n✓ ${message}\n`));

  if (details && details.length > 0) {
    details.forEach(detail => {
      console.log(chalk.dim(`  ${detail}`));
    });
    console.log();
  }
}

/**
 * Exit with appropriate code based on error type
 */
export function exitWithError(error: Error, options: ErrorDisplayOptions = {}): never {
  displayError(error, options);

  let exitCode = 1; // Default error code

  if (error instanceof AuthError || error instanceof ScopeError) {
    exitCode = 1; // Configuration/auth error
  } else if (error instanceof RateLimitError) {
    exitCode = 3; // Partial success
  } else if (error instanceof ValidationError) {
    exitCode = 1; // User error
  }

  process.exit(exitCode);
}
