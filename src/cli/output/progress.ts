/**
 * Progress display utilities using Ora
 *
 * Provides spinners and progress indicators for long-running operations
 */

import ora, { Ora } from 'ora';
import chalk from 'chalk';

export interface ProgressOptions {
  text: string;
  spinner?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'cyan' | 'magenta';
}

/**
 * Create and start a progress spinner
 */
export function startProgress(options: ProgressOptions): Ora {
  return ora({
    text: options.text,
    spinner: options.spinner as any,
    color: options.color,
  }).start();
}

/**
 * Update progress text
 */
export function updateProgress(spinner: Ora, text: string): void {
  spinner.text = text;
}

/**
 * Complete progress with success
 */
export function succeedProgress(spinner: Ora, text?: string): void {
  if (text) {
    spinner.succeed(text);
  } else {
    spinner.succeed();
  }
}

/**
 * Complete progress with failure
 */
export function failProgress(spinner: Ora, text?: string): void {
  if (text) {
    spinner.fail(text);
  } else {
    spinner.fail();
  }
}

/**
 * Complete progress with warning
 */
export function warnProgress(spinner: Ora, text?: string): void {
  if (text) {
    spinner.warn(text);
  } else {
    spinner.warn();
  }
}

/**
 * Complete progress with info
 */
export function infoProgress(spinner: Ora, text?: string): void {
  if (text) {
    spinner.info(text);
  } else {
    spinner.info();
  }
}

/**
 * Stop progress without any symbol
 */
export function stopProgress(spinner: Ora): void {
  spinner.stop();
}

/**
 * Progress tracker for multiple steps
 */
export class ProgressTracker {
  private spinner: Ora | null = null;
  private steps: string[] = [];
  private currentStep: number = 0;
  private startTime: number = 0;

  constructor(steps: string[]) {
    this.steps = steps;
  }

  /**
   * Start tracking progress
   */
  start(): void {
    this.startTime = Date.now();
    this.currentStep = 0;
    this.spinner = startProgress({
      text: this.getCurrentStepText(),
      color: 'cyan',
    });
  }

  /**
   * Move to next step
   */
  next(customText?: string): void {
    if (!this.spinner) {
      throw new Error('Progress not started');
    }

    if (this.currentStep < this.steps.length) {
      succeedProgress(this.spinner, this.steps[this.currentStep]);
      this.currentStep++;

      if (this.currentStep < this.steps.length) {
        this.spinner = startProgress({
          text: customText || this.getCurrentStepText(),
          color: 'cyan',
        });
      }
    }
  }

  /**
   * Fail current step
   */
  fail(error: string): void {
    if (!this.spinner) {
      throw new Error('Progress not started');
    }

    failProgress(this.spinner, `${this.steps[this.currentStep]}: ${error}`);
  }

  /**
   * Complete all remaining steps successfully
   */
  complete(): void {
    if (!this.spinner) {
      throw new Error('Progress not started');
    }

    while (this.currentStep < this.steps.length) {
      succeedProgress(this.spinner, this.steps[this.currentStep]);
      this.currentStep++;

      if (this.currentStep < this.steps.length) {
        this.spinner = startProgress({
          text: this.getCurrentStepText(),
          color: 'cyan',
        });
      }
    }

    const duration = Date.now() - this.startTime;
    const durationText = duration > 1000
      ? `${(duration / 1000).toFixed(1)}s`
      : `${duration}ms`;

    console.log(chalk.dim(`\nCompleted in ${durationText}\n`));
  }

  /**
   * Update current step text
   */
  updateText(text: string): void {
    if (!this.spinner) {
      throw new Error('Progress not started');
    }

    updateProgress(this.spinner, text);
  }

  private getCurrentStepText(): string {
    return `[${this.currentStep + 1}/${this.steps.length}] ${this.steps[this.currentStep]}`;
  }
}

/**
 * Simple progress bar for known item counts
 */
export class ProgressBar {
  private total: number;
  private current: number = 0;
  private label: string;
  private spinner: Ora | null = null;
  private lastUpdate: number = 0;
  private updateInterval: number = 100; // ms

  constructor(total: number, label: string) {
    this.total = total;
    this.label = label;
  }

  /**
   * Start the progress bar
   */
  start(): void {
    this.current = 0;
    this.lastUpdate = Date.now();
    this.spinner = startProgress({
      text: this.getText(),
      color: 'cyan',
    });
  }

  /**
   * Increment progress
   */
  increment(count: number = 1): void {
    this.current += count;

    // Throttle updates to avoid flickering
    const now = Date.now();
    if (now - this.lastUpdate >= this.updateInterval || this.current >= this.total) {
      if (this.spinner) {
        updateProgress(this.spinner, this.getText());
        this.lastUpdate = now;
      }
    }
  }

  /**
   * Complete the progress bar
   */
  complete(): void {
    if (this.spinner) {
      this.current = this.total;
      succeedProgress(this.spinner, this.getText());
    }
  }

  /**
   * Fail the progress bar
   */
  fail(error?: string): void {
    if (this.spinner) {
      failProgress(this.spinner, error || this.getText());
    }
  }

  private getText(): string {
    const percentage = Math.round((this.current / this.total) * 100);
    return `${this.label}: ${this.current}/${this.total} (${percentage}%)`;
  }
}
