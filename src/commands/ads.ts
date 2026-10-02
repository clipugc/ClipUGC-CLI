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

/** Shared table shape for a list of finished videos. */
export const AD_COLUMNS = [
  { header: 'VIDEO ID', value: (a: MergedVideo) => a.id },
  { header: 'Status', value: (a: MergedVideo) => formatStatus(a.status ?? '') },
  { header: 'Hook', value: (a: MergedVideo) => truncate(a.hook_text) },
  { header: 'Clip', value: (a: MergedVideo) => a.character_video_id },
  { header: 'Created', value: (a: MergedVideo) => a.created_at },
];

function truncate(text: string | null | undefined, max = 40): string | undefined {
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Primary name of the finished-video command group. */
export const FINISHED_COMMAND = 'finished';

/** Pre-1.3.1 name of the same group. Still registered (hidden) so existing scripts keep working. */
export const LEGACY_FINISHED_COMMAND = 'ads';

/**
 * `clipugc finished`: finished UGC videos (`/merged-videos`), what `videos merge` produces.
 *
 * A finished video id is NOT a clip id: `finished download 121` and `videos download 121`
 * address different things. `videos merge <clipId>` reports the id it created;
 * `videos list --finals` lists finished videos too.
 *
 * The same subcommands are also registered under the hidden `ads` name for backward
 * compatibility. JSON output is identical under both names.
 */
export function registerAdsCommands(program: Command): void {
  addFinishedCommands(
    program.command(FINISHED_COMMAND).description('Manage your finished UGC videos (what `videos merge` makes)'),
  );
  addFinishedCommands(
    program
      .command(LEGACY_FINISHED_COMMAND, { hidden: true })
      .description('Old name for `clipugc finished`, kept so existing scripts keep working'),
  );
}

function addFinishedCommands(group: Command): void {
  group
    .command('list')
    .description('List your finished UGC videos')
    .option('--status <status>', 'Filter by status: pending, processing, completed, failed')
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

  group
    .command('show <videoId>')
    .alias('get')
    .description('Show details of a finished UGC video')
    .action(async (videoId: string, _opts: Record<string, unknown>, cmd: Command) => {
      const json = isJsonMode(cmd);
      const api = await createApiClient();
      const video = await getMergedVideo(api, videoId);
      if (json) {
        printJson(video);
        return;
      }
      logger.plain(`Finished video ${video.id}`);
      logger.kv('status', formatStatus(video.status ?? ''));
      for (const [key, value] of Object.entries(video)) {
        if (key === 'id' || key === 'status') continue;
        if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
          logger.kv(key, value as string | number | boolean | null);
        }
      }
      if (video.status === 'completed') {
        logger.hint(`Download it with \`clipugc finished download ${video.id}\``);
      }
      if (video.status === 'failed') {
        if (video.can_retry) {
          logger.hint(`Render it again with \`clipugc finished retry ${video.id}\`. It is free.`);
        } else {
          logger.warn('This video cannot be rendered again because its app recording is no longer stored. Run `clipugc videos merge` again.');
        }
      }
    });

  group
    .command('download <videoId>')
    .description('Download a finished UGC video to disk')
    .option('-o, --output <file>', 'Destination file (default: clipugc-finished-<videoId>.mp4)')
    .action(async (videoId: string, opts: { output?: string }, cmd: Command) => {
      const json = isJsonMode(cmd);
      const api = await createApiClient();
      const dest = await downloadMergedVideo(api, videoId, { output: opts.output, quiet: json });
      if (json) {
        printJson({ merged_video_id: videoId, output: dest });
      }
    });

  group
    .command('retry <videoId>')
    .description('Render a failed finished video again. Free')
    .option('--wait', 'Wait until the video is ready')
    .action(async (videoId: string, opts: { wait?: boolean }, cmd: Command) => {
      const json = isJsonMode(cmd);
      const api = await createApiClient();
      const video = await retryMergedVideo(api, videoId);

      if (opts.wait) {
        const final = await waitForMerge(() => getMergedVideo(api, videoId), { label: 'Rendering video', quiet: json });
        if (json) {
          printJson(final);
        } else {
          logger.hint(`Download it with \`clipugc finished download ${videoId}\``);
        }
        return;
      }
      if (json) {
        printJson(video);
        return;
      }
      logger.success(`Render queued (finished video ${videoId}).`);
      logger.hint(`Check it with \`clipugc finished show ${videoId}\`, or re-run with --wait.`);
    });

  group
    .command('delete <videoId>')
    .description('Delete a finished UGC video. The clip it was made from stays on the influencer profile')
    .option('-y, --yes', 'Skip the confirmation prompt')
    .action(async (videoId: string, opts: { yes?: boolean }, cmd: Command) => {
      const json = isJsonMode(cmd);
      if (!opts.yes) {
        const ok = await confirm(
          `Delete finished video ${videoId}? Only the finished video goes; the source clip stays. This cannot be undone.`,
        );
        if (!ok) throw new AbortedError();
      }
      const api = await createApiClient();
      const { data, message } = await deleteMergedVideo(api, videoId);
      if (json) {
        printJson(data);
        return;
      }
      logger.success(message ?? `Finished video ${videoId} deleted.`);
    });
}
