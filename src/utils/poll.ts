import ora from 'ora';
import chalk from 'chalk';
import { ApiError } from './errors.js';
import type { ResourceStatus } from '../types/index.js';

export interface PollOptions {
  /** Interval between checks in ms (default 6000). */
  intervalMs?: number;
  /** Give up after this many ms (default 20 minutes). */
  timeoutMs?: number;
  /** Spinner label, e.g. "Generating image". */
  label?: string;
  /** Suppress spinner (for --json mode); still polls. */
  quiet?: boolean;
}

export interface StatusCheck {
  status: ResourceStatus | string;
  /** Optional server-side failure explanation. */
  failure_reason?: string | null;
  error_message?: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Payload shape for merge polling: a merged ad's own `status` IS the merge lifecycle. */
export interface MergeStatusCheck {
  /** pending | processing | completed | failed. */
  status?: string | null;
  [key: string]: unknown;
}

/**
 * Poll a merged ad (`GET /merged-videos/{id}`) until its merge finishes. Ads are their own
 * resource, so unlike a clip — whose `status` stays "completed" while a merge renders — the ad's
 * `status` is the merge lifecycle itself. Throws ApiError on merge failure/timeout.
 */
export async function waitForMerge<T extends MergeStatusCheck>(
  check: () => Promise<T>,
  options: PollOptions = {},
): Promise<T> {
  const intervalMs = options.intervalMs ?? 6000;
  const timeoutMs = options.timeoutMs ?? 20 * 60 * 1000;
  const label = options.label ?? 'Merging video';
  const start = Date.now();
  const spinner = options.quiet ? null : ora(`${label}...`).start();

  try {
    for (;;) {
      const result = await check();
      const elapsed = Math.round((Date.now() - start) / 1000);
      const merged = result.status === 'completed';
      const failed = result.status === 'failed';

      if (merged) {
        spinner?.succeed(`${label} completed in ${formatElapsed(elapsed)}`);
        return result;
      }
      if (failed) {
        spinner?.fail(`${label} failed.`);
        throw new ApiError(`${label} failed. Retry with \`clipugc ads retry\` — merging is free.`);
      }
      if (Date.now() - start > timeoutMs) {
        spinner?.fail(`${label} timed out after ${formatElapsed(elapsed)} — it may still finish server-side.`);
        throw new ApiError(`${label} timed out. Check \`clipugc ads show <adId>\` later.`);
      }
      if (spinner) {
        spinner.text = `${label}... ${chalk.dim(`(${result.status ?? 'processing'}, ${formatElapsed(elapsed)} elapsed)`)}`;
      }
      await sleep(intervalMs);
    }
  } catch (err) {
    if (spinner?.isSpinning) spinner.stop();
    throw err;
  }
}

/**
 * Poll `check()` until the resource reaches completed/failed.
 * Shows an ora spinner with elapsed time. Throws ApiError on failed/timeout.
 * Returns the final check payload on completion.
 */
export async function waitForCompletion<T extends StatusCheck>(
  check: () => Promise<T>,
  options: PollOptions = {},
): Promise<T> {
  const intervalMs = options.intervalMs ?? 6000;
  const timeoutMs = options.timeoutMs ?? 20 * 60 * 1000;
  const label = options.label ?? 'Processing';
  const start = Date.now();

  const spinner = options.quiet ? null : ora(`${label}...`).start();

  try {
    // Poll loop
    for (;;) {
      const result = await check();
      const elapsed = Math.round((Date.now() - start) / 1000);

      if (result.status === 'completed') {
        spinner?.succeed(`${label} completed in ${formatElapsed(elapsed)}`);
        return result;
      }
      if (result.status === 'failed') {
        const reason = result.failure_reason || result.error_message || 'no reason given';
        spinner?.fail(`${label} failed (${reason})`);
        throw new ApiError(`${label} failed: ${reason}`);
      }

      if (Date.now() - start > timeoutMs) {
        spinner?.fail(`${label} timed out after ${formatElapsed(elapsed)} — it may still finish server-side.`);
        throw new ApiError(`${label} timed out after ${formatElapsed(elapsed)}. Check status later.`);
      }

      if (spinner) {
        spinner.text = `${label}... ${chalk.dim(`(${result.status}, ${formatElapsed(elapsed)} elapsed)`)}`;
      }
      await sleep(intervalMs);
    }
  } catch (err) {
    if (spinner?.isSpinning) spinner.stop();
    throw err;
  }
}

function formatElapsed(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${s}s`;
}
