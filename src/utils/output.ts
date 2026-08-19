import chalk from 'chalk';
import type { Command } from 'commander';
import type { Pagination } from '../types/index.js';

/** True when the global --json flag is set (for scripting). */
export function isJsonMode(command: Command): boolean {
  return Boolean(command.optsWithGlobals().json);
}

/** Print raw JSON data (the `data` part of the envelope) for --json mode. */
export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export interface Column<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

/** Render a simple aligned text table for humans. */
export function printTable<T>(rows: T[], columns: Column<T>[]): void {
  if (rows.length === 0) {
    console.log(chalk.dim('  (no results)'));
    return;
  }

  const cells: string[][] = rows.map((row) =>
    columns.map((col) => {
      const v = col.value(row);
      return v === null || v === undefined || v === '' ? '—' : String(v);
    }),
  );

  const widths = columns.map((col, i) =>
    Math.max(col.header.length, ...cells.map((r) => r[i].length)),
  );

  const headerLine = columns.map((col, i) => col.header.padEnd(widths[i])).join('  ');
  console.log(chalk.bold(headerLine));
  console.log(chalk.dim(widths.map((w) => '-'.repeat(w)).join('  ')));
  for (const row of cells) {
    console.log(row.map((cell, i) => cell.padEnd(widths[i])).join('  '));
  }
}

/** Print a "page X of Y (N total)" footer for paginated lists. */
export function printPagination(pagination: Pagination | undefined): void {
  if (!pagination) return;
  const { current_page, last_page, total } = pagination;
  let line = `page ${current_page} of ${last_page} (${total} total)`;
  if (pagination.has_more_pages) line += ' — use --page to see more';
  console.log(chalk.dim(line));
}

/** Colorize a pending|processing|completed|failed status. */
export function formatStatus(status: string): string {
  switch (status) {
    case 'completed':
      return chalk.green(status);
    case 'failed':
      return chalk.red(status);
    case 'processing':
      return chalk.yellow(status);
    case 'pending':
      return chalk.gray(status);
    default:
      return status;
  }
}
