/**
 * Execution lock mechanism
 * Epic 8: Prevents concurrent executions
 */

import { mkdir, readFile, writeFile, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ExecutionLock');

export interface ExecutionLockData {
  portal_id: string;
  acquired_at: Date;
  expires_at: Date;
  execution_id: string;
}

export class ExecutionLockError extends Error {
  constructor(
    message: string,
    public readonly lockData?: ExecutionLockData
  ) {
    super(message);
    this.name = 'ExecutionLockError';
  }
}

/**
 * File-based execution lock to prevent concurrent executions on the same portal
 */
export class ExecutionLock {
  private lockFilePath: string;
  private lockData: ExecutionLockData | null = null;

  /**
   * Default lock expiry: 1 hour
   */
  static readonly DEFAULT_EXPIRY_MS = 60 * 60 * 1000;

  /**
   * Lock file location relative to audit reports directory
   */
  static readonly LOCK_FILE_NAME = '.execution-lock';

  constructor(
    reportsDir: string = './audit-reports',
    private readonly portalId: string,
    private readonly expiryMs: number = ExecutionLock.DEFAULT_EXPIRY_MS
  ) {
    this.lockFilePath = join(reportsDir, ExecutionLock.LOCK_FILE_NAME);
  }

  /**
   * Acquire the execution lock
   * Throws ExecutionLockError if lock is already held by another execution
   */
  async acquire(executionId: string): Promise<void> {
    logger.info({ executionId, portalId: this.portalId }, 'Acquiring execution lock');

    // Ensure reports directory exists
    await mkdir(dirname(this.lockFilePath), { recursive: true });

    // Check for existing lock
    const existingLock = await this.readLockFile();
    if (existingLock) {
      // Check if lock is expired
      if (new Date(existingLock.expires_at) > new Date()) {
        // Lock is still valid
        logger.warn(
          { existingLock },
          'Execution lock already held'
        );
        throw new ExecutionLockError(
          `Execution already in progress: ${existingLock.execution_id} (started at ${existingLock.acquired_at})`,
          existingLock
        );
      } else {
        // Lock is expired, clean it up
        logger.info({ existingLock }, 'Cleaning up expired lock');
        await this.releaseLockFile();
      }
    }

    // Acquire new lock
    const now = new Date();
    this.lockData = {
      portal_id: this.portalId,
      acquired_at: now,
      expires_at: new Date(now.getTime() + this.expiryMs),
      execution_id: executionId,
    };

    await this.writeLockFile(this.lockData);
    logger.info({ lockData: this.lockData }, 'Execution lock acquired');
  }

  /**
   * Release the execution lock
   */
  async release(): Promise<void> {
    if (!this.lockData) {
      logger.warn('Attempted to release lock that was not acquired');
      return;
    }

    logger.info({ executionId: this.lockData.execution_id }, 'Releasing execution lock');

    try {
      await this.releaseLockFile();
      this.lockData = null;
    } catch (error) {
      logger.error({ error }, 'Failed to release execution lock');
      throw error;
    }
  }

  /**
   * Check if a lock is currently held
   */
  async isLocked(): Promise<boolean> {
    const lock = await this.readLockFile();
    if (!lock) {
      return false;
    }

    // Check if lock is expired
    return new Date(lock.expires_at) > new Date();
  }

  /**
   * Get current lock data if any
   */
  async getCurrentLock(): Promise<ExecutionLockData | null> {
    return await this.readLockFile();
  }

  /**
   * Read lock file
   */
  private async readLockFile(): Promise<ExecutionLockData | null> {
    try {
      const content = await readFile(this.lockFilePath, 'utf-8');
      const data = JSON.parse(content);

      // Convert date strings back to Date objects
      return {
        ...data,
        acquired_at: new Date(data.acquired_at),
        expires_at: new Date(data.expires_at),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Lock file doesn't exist
        return null;
      }
      throw error;
    }
  }

  /**
   * Write lock file
   */
  private async writeLockFile(data: ExecutionLockData): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    await writeFile(this.lockFilePath, content, 'utf-8');
  }

  /**
   * Delete lock file
   */
  private async releaseLockFile(): Promise<void> {
    try {
      await rm(this.lockFilePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, that's fine
    }
  }

  /**
   * Force release a lock (use with caution!)
   * Useful for cleaning up stale locks
   */
  static async forceRelease(reportsDir: string = './audit-reports'): Promise<void> {
    const lockFilePath = join(reportsDir, ExecutionLock.LOCK_FILE_NAME);
    try {
      await rm(lockFilePath);
      logger.info('Force released execution lock');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
