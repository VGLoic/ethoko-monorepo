import { styleText } from "node:util";
import * as clackPrompts from "@clack/prompts";

export const LOG_COLORS = {
  log: "cyan",
  success: "green",
  error: "red",
  warn: "yellow",
} as const;

/**
 * CLI UI utilities for enhanced terminal output
 */

export function createSpinner(message: string, silent = false): Spinner {
  if (silent) {
    return {
      succeed: () => {},
      warn: () => {},
      fail: () => {},
      stop: () => {},
    };
  }
  const spinner = clackPrompts.spinner({ output: process.stderr });
  spinner.start(message);
  return {
    succeed: (msg: string) => spinner.stop(msg),
    warn: (msg: string) => spinner.error(msg),
    fail: (msg: string) => spinner.cancel(msg),
    stop: () => spinner.clear(),
  };
}

interface Spinner {
  // Displays a success message and stops the spinner
  succeed: (message: string) => void;
  // Displays a warning message and stops the spinner
  warn: (message: string) => void;
  // Displays an error message and stops the spinner
  fail: (message: string) => void;
  // Stops the spinner without displaying a message, can be used with {succeed, warn, fail} afterwards to display a message
  stop: () => void;
}

/**
 * Creates a boxed header message
 */
export function boxHeader(message: string, silent = false): void {
  if (silent) return;
  clackPrompts.box(message, undefined, {
    width: "auto",
    rounded: true,
    contentAlign: "center",
    output: process.stderr,
  });
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
  clackPrompts.box(lines.join("\n"), title, {
    width: "auto",
    rounded: true,
    contentAlign: "left",
    titleAlign: "center",
    titlePadding: 1,
    contentPadding: 2,
    output: process.stderr,
  });
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

export const prompts = {
  select: clackPrompts.select,
  isCancel: clackPrompts.isCancel,
  cancel: clackPrompts.cancel,
  intro: clackPrompts.intro,
  outro: clackPrompts.outro,
  confirm: clackPrompts.confirm,
  text: clackPrompts.text,
  note: clackPrompts.note,
  password: clackPrompts.password,
};
