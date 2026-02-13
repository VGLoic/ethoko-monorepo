import ora, { Ora } from "ora";
import boxen from "boxen";
import { styleText } from "node:util";

export const LOG_COLORS = {
  log: "cyan",
  success: "green",
  error: "red",
  warn: "yellow",
} as const;

/**
 * CLI UI utilities for enhanced terminal output
 */

/**
 * Creates a step tracker for multi-step operations
 */
export class StepTracker {
  private currentStep: number;
  private readonly totalSteps: number;
  private spinner: Ora | undefined;
  private readonly silent: boolean;

  constructor(totalSteps: number, silent = false) {
    this.currentStep = 0;
    this.totalSteps = totalSteps;
    this.silent = silent;
  }

  /**
   * Start a new step with a spinner
   */
  start(message: string): Ora {
    this.currentStep++;
    const prefix = styleText(
      "cyan",
      `[${this.currentStep}/${this.totalSteps}]`,
    );
    this.spinner = ora({
      text: message,
      prefixText: prefix,
      stream: process.stderr,
      isSilent: this.silent,
    }).start();
    return this.spinner;
  }

  /**
   * Mark the current step as successful
   */
  succeed(message?: string): void {
    if (this.spinner) {
      this.spinner.succeed(message);
    }
  }

  /**
   * Mark the current step as failed
   */
  fail(message?: string): void {
    if (this.spinner) {
      this.spinner.fail(message);
    }
  }

  /**
   * Mark the current step as warning
   */
  warn(message?: string): void {
    if (this.spinner) {
      this.spinner.warn(message);
    }
  }

  /**
   * Stop the current spinner without success/fail
   */
  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
    }
  }
}

/**
 * Creates a simple spinner without step tracking
 */
export function createSpinner(message: string, silent = false): Ora {
  return ora({
    text: message,
    stream: process.stderr,
    isSilent: silent,
  }).start();
}

/**
 * Creates a boxed header message
 */
export function boxHeader(message: string, silent = false): void {
  if (silent) return;
  const boxed = boxen(message, {
    padding: 0,
    margin: { top: 1, bottom: 0, left: 0, right: 0 },
    borderStyle: "round",
    borderColor: "cyan",
  });
  console.error(boxed);
}

/**
 * Creates a boxed summary with multiple lines
 */
export function boxSummary(
  title: string,
  lines: string[],
  silent = false,
): void {
  if (silent) return;
  const boldTitle = styleText("bold", title);
  const content = `${boldTitle}\n\n${lines.join("\n")}`;
  const boxed = boxen(content, {
    padding: 1,
    margin: { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle: "round",
    borderColor: "cyan",
  });
  console.error(boxed);
}

/**
 * Enhanced success message
 */
export function success(message: string, silent = false): void {
  if (silent) return;
  console.error(styleText(LOG_COLORS.success, `✔ ${message}`));
}

/**
 * Enhanced error message
 */
export function error(message: string): void {
  console.error(styleText(LOG_COLORS.error, `✖ ${message}`));
}

/**
 * Enhanced warning message
 */
export function warn(message: string): void {
  console.error(styleText(LOG_COLORS.warn, `⚠ ${message}`));
}

/**
 * Enhanced info message
 */
export function info(message: string, silent = false): void {
  if (silent) return;
  console.error(styleText(LOG_COLORS.log, `ℹ ${message}`));
}
