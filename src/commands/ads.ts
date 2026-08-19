import type { Command } from 'commander';
import { createApiClient } from '../services/api.js';
import {
  deleteMergedVideo,
  downloadMergedVideo,
  getMergedVideo,
  listMergedVideos,
  retryMergedVideo,
  type MergedVideo,
} from '../services/ads.service.js';
import { formatStatus, isJsonMode, printJson, printPagination, printTable } from '../utils/output.js';
import { waitForMerge } from '../utils/poll.js';
import { confirm } from '../utils/prompt.js';
import { AbortedError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

function parsePositiveInt(flag: string) {
  return (value: string): number => {
    const n = Number.parseInt(value, 10);
    if (!Number.isInteger(n) || String(n) !== value.trim() || n < 1) {
      throw new ValidationError(`${flag} must be a positive integer (got "${value}").`);
    }
    return n;
  };
}

/** Shared table shape for a list of ads. */
export const AD_COLUMNS = [
  { header: 'AD ID', value: (a: MergedVideo) => a.id },
  { header: 'Status', value: (a: MergedVideo) => formatStatus(a.status ?? '') },
  { header: 'Hook', value: (a: MergedVideo) => truncate(a.hook_text) },
  { header: 'Clip', value: (a: MergedVideo) => a.character_video_id },
  { header: 'Created', value: (a: MergedVideo) => a.created_at },
];

function truncate(text: string | null | undefined, max = 40): string | undefined {
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * `clipugc ads` — finished UGC ads (`/merged-videos`), the resource a merge produces.
 *
 * An AD ID is NOT a clip id: `ads download 121` and `videos download 121` address different
 * things. `videos merge <clipId>` reports the ad id it created; `videos list --finals` lists ads.
 */
export function registerAdsCommands(program: Command): void {
  const ads = program
    .command('ads')
    .description('Manage your finished UGC ads (the output of `videos merge`)');

  ads
    .command('list')
    .description('List your finished UGC ads')
    .option('--status <status>', 'Filter by merge status: pending, processing, completed, failed')
    .option('--page <n>', 'Page number', parsePositiveInt('--page'))
    .option('--per-page <n>', 'Results per page (max 50)', parsePositiveInt('--per-page'))
    .action(async (opts: { status?: string; page?: number; perPage?: number }, cmd: Command) => {
      const json = isJsonMode(cmd);
      const api = await createApiClient();
      const { items, pagination, raw } = await listMergedVideos(api, {
        page: opts.page,
        perPage: opts.perPage,
        status: opts.status,
      });
      if (json) {
        printJson(raw);
        return;
      }
      printTable(items, AD_COLUMNS);
      printPagination(pagination);
    });

  ads
    .command('show <adId>')
    .description('Show details of a finished UGC ad')
    .action(async (adId: string, cmd: Command) => {
      const json = isJsonMode(cmd);
      const api = await createApiClient();
      const ad = await getMergedVideo(api, adId);
      if (json) {
        printJson(ad);
        return;
      }
      logger.plain(`Ad ${ad.id}`);
      logger.kv('status', formatStatus(ad.status ?? ''));
      for (const [key, value] of Object.entries(ad)) {
        if (key === 'id' || key === 'status') continue;
        if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
          logger.kv(key, value as string | number | boolean | null);
        }
      }
      if (ad.status === 'completed') {
        logger.hint(`Download it with \`clipugc ads download ${ad.id}\``);
      }
      if (ad.status === 'failed') {
        if (ad.can_retry) {
          logger.hint(`Re-render it with \`clipugc ads retry ${ad.id}\` — merging is free`);
        } else {
          logger.warn('This ad cannot be re-rendered — its app recording is no longer stored. Run `clipugc videos merge` again.');
        }
      }
    });

  ads
    .command('download <adId>')
    .description('Download a finished UGC ad to disk')
    .option('-o, --output <file>', 'Destination file (default: clipugc-ad-<adId>.mp4)')
    .action(async (adId: string, opts: { output?: string }, cmd: Command) => {
      const json = isJsonMode(cmd);
      const api = await createApiClient();
      const dest = await downloadMergedVideo(api, adId, { output: opts.output, quiet: json });
      if (json) {
        printJson({ merged_video_id: adId, output: dest });
      }
    });

  ads
    .command('retry <adId>')
    .description('Re-render a failed UGC ad. Merging is free')
    .option('--wait', 'Wait until the merge completes')
    .action(async (adId: string, opts: { wait?: boolean }, cmd: Command) => {
      const json = isJsonMode(cmd);
      const api = await createApiClient();
      const ad = await retryMergedVideo(api, adId);

      if (opts.wait) {
        const final = await waitForMerge(() => getMergedVideo(api, adId), { label: 'Merging ad', quiet: json });
        if (json) {
          printJson(final);
        } else {
          logger.hint(`Download the finished ad with \`clipugc ads download ${adId}\``);
        }
        return;
      }
      if (json) {
        printJson(ad);
        return;
      }
      logger.success(`Re-render queued (ad ${adId}).`);
      logger.hint(`Check it with \`clipugc ads show ${adId}\` — or re-run with --wait.`);
    });

  ads
    .command('delete <adId>')
    .description('Delete a finished UGC ad. The clip it was made from stays on the influencer profile')
    .option('-y, --yes', 'Skip the confirmation prompt')
    .action(async (adId: string, opts: { yes?: boolean }, cmd: Command) => {
      const json = isJsonMode(cmd);
      if (!opts.yes) {
        const ok = await confirm(
          `Delete ad ${adId}? This removes only the finished ad — the source clip stays. This cannot be undone.`,
        );
        if (!ok) throw new AbortedError();
      }
      const api = await createApiClient();
      const { data, message } = await deleteMergedVideo(api, adId);
      if (json) {
        printJson(data);
        return;
      }
      logger.success(message ?? `Ad ${adId} deleted.`);
    });
}
