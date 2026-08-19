import type { Command } from 'commander';
import { createApiClient, type ApiClient } from '../services/api.js';
import {
  checkVideoStatus,
  createImageToVideo,
  createMotionControl,
  deleteVideo,
  downloadVideo,
  getVideo,
  listVideos,
  mergeVideo,
  retryVideo,
  type CharacterVideo,
  type VideoStatusCheck,
} from '../services/videos.service.js';
import { getMergedVideo, listMergedVideos } from '../services/ads.service.js';
import { AD_COLUMNS } from './ads.js';
import { uploadFile } from '../services/upload.service.js';
import { formatStatus, isJsonMode, printJson, printPagination, printTable } from '../utils/output.js';
import { waitForCompletion, waitForMerge } from '../utils/poll.js';
import { confirm } from '../utils/prompt.js';
import { AbortedError, ApiError, ValidationError } from '../utils/errors.js';
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

/**
 * Resolve the --image/--photo pair into the API image source.
 * Exactly one must be given; --photo is uploaded first (purpose: photo).
 */
async function resolveImageSource(
  api: ApiClient,
  opts: { image?: string; photo?: string },
  quiet: boolean,
): Promise<{ characterReferenceImageId?: string; sourceImageKey?: string }> {
  const hasImage = Boolean(opts.image);
  const hasPhoto = Boolean(opts.photo);
  if (hasImage === hasPhoto) {
    throw new ValidationError(
      'Provide exactly one image source: --image <lookId> (a generated character look) or --photo <file> (your own photo).',
    );
  }
  if (hasImage) {
    return { characterReferenceImageId: opts.image };
  }
  const sourceImageKey = await uploadFile(api, 'photo', opts.photo!, { quiet });
  return { sourceImageKey };
}

/**
 * Human label for a CLIP's merge state — the lifecycle of the ad rendered from it, which the clip
 * resource still mirrors so the clip list can show "already used". The ad itself lives under
 * `clipugc ads`.
 */
function mergedLabel(v: CharacterVideo): string {
  const ms = typeof v.merge_status === 'string' ? v.merge_status : undefined;
  if (ms) return ms; // processing | completed | failed
  const media = v.media as { has_merged?: boolean } | undefined;
  if (v.is_merged === true || media?.has_merged === true) return 'completed';
  return '—';
}

/** Shared post-create flow: --wait polling or a status hint. */
async function finishCreate(
  api: ApiClient,
  video: CharacterVideo,
  opts: { wait?: boolean },
  json: boolean,
  label: string,
): Promise<void> {
  const id = String(video.id);
  if (opts.wait) {
    const finalStatus = await waitForCompletion(
      () => checkVideoStatus(api, id) as Promise<VideoStatusCheck & { status: string }>,
      { label, quiet: json },
    );
    if (json) {
      printJson(finalStatus);
      return;
    }
    logger.hint(`Download it with \`clipugc videos download ${id}\``);
    return;
  }

  if (json) {
    printJson(video);
    return;
  }
  logger.success(`Video queued (id: ${id}, status: ${formatStatus(video.status ?? 'pending')}).`);
  logger.hint(`Check progress with \`clipugc videos status ${id}\` (or re-run with --wait).`);
}

export function registerVideosCommands(program: Command): void {
  const videos = program
    .command('videos')
    .description('Create, manage, and download UGC character videos');

  videos
    .command('list')
    .description('List your character videos (clips). --finals lists finished ads instead')
    .option('--character <id>', 'Only videos of this AI character')
    .option('--mergeable', 'Only completed, unmerged clips (ready for `videos merge`)')
    .option('--finals', 'List finished UGC ads instead of clips (same as `clipugc ads list`)')
    .option('--page <n>', 'Page number', parsePositiveInt('--page'))
    .option('--per-page <n>', 'Results per page (max 50)', parsePositiveInt('--per-page'))
    .action(async (opts: { character?: string; mergeable?: boolean; finals?: boolean; page?: number; perPage?: number }, cmd: Command) => {
      const json = isJsonMode(cmd);
      const api = await createApiClient();

      // Ads are a separate resource, so --finals is not a filter on the clip list any more: it
      // switches to /merged-videos. The ids it prints are AD ids — feed them to `clipugc ads`.
      if (opts.finals) {
        if (opts.mergeable) {
          throw new ValidationError('--mergeable and --finals are mutually exclusive — pick one.');
        }
        if (opts.character) {
          throw new ValidationError('--character filters clips, not ads. Drop it, or drop --finals.');
        }
        const ads = await listMergedVideos(api, { page: opts.page, perPage: opts.perPage });
        if (json) {
          printJson(ads.raw);
          return;
        }
        printTable(ads.items, AD_COLUMNS);
        printPagination(ads.pagination);
        return;
      }

      const { items, pagination, raw } = await listVideos(api, {
        page: opts.page,
        perPage: opts.perPage,
        aiCharacterId: opts.character,
        mergeable: opts.mergeable,
      });
      if (json) {
        printJson(raw);
        return;
      }
      printTable(items, [
        { header: 'ID', value: (v) => v.id },
        { header: 'Status', value: (v) => formatStatus(v.status ?? '') },
        { header: 'Merged', value: (v) => mergedLabel(v) },
        { header: 'Type', value: (v) => v.kind ?? v.type },
        { header: 'Created', value: (v) => v.created_at },
      ]);
      printPagination(pagination);
    });

  videos
    .command('create')
    .description('Generate a character video from an image (image-to-video). Costs 7 credits (5s) or 13 (10s); a --scene staged clip adds the image cost (9 at 5s, 15 at 10s)')
    .option('--image <lookId>', 'ID of a generated character look/reference image')
    .option('--photo <file>', 'Path to your own photo (png/jpg/jpeg/webp) — uploaded first')
    .option('--prompt <text>', 'What the character should say/do (max 1500 chars)')
    .option('--scene <text>', 'Extra scene description, max 600 chars (scene-staged clip: 9 credits at 5s, 15 at 10s)')
    .option('--duration <seconds>', 'Video duration: 5 or 10 (default 5). 5s = 7 credits, 10s = 13', parsePositiveInt('--duration'))
    .option('--keep-sound', 'Keep the original sound')
    .option('--wait', 'Wait until generation completes')
    .action(
      async (
        opts: {
          image?: string;
          photo?: string;
          prompt?: string;
          scene?: string;
          duration?: number;
          keepSound?: boolean;
          wait?: boolean;
        },
        cmd: Command,
      ) => {
        const json = isJsonMode(cmd);
        const api = await createApiClient();
        const source = await resolveImageSource(api, opts, json);
        const video = await createImageToVideo(api, {
          ...source,
          prompt: opts.prompt,
          scenePrompt: opts.scene,
          duration: opts.duration,
          keepOriginalSound: opts.keepSound,
        });
        await finishCreate(api, video, opts, json, 'Generating video');
      },
    );

  videos
    .command('motion')
    .description('Generate a character video driven by a reference video (motion control). Costs 3 credits per second of driver video (rounded up, capped at 30s)')
    .option('--image <lookId>', 'ID of a generated character look/reference image')
    .option('--photo <file>', 'Path to your own photo (png/jpg/jpeg/webp) — uploaded first')
    .requiredOption('--driver <videoFile>', 'Driver video (mp4/mov, max 50 MB and 30s) whose motion is applied')
    .option('--prompt <text>', 'What the character should say/do (max 1500 chars)')
    .option('--keep-sound', "Keep the driver video's original sound")
    .option('--wait', 'Wait until generation completes')
    .action(
      async (
        opts: {
          image?: string;
          photo?: string;
          driver: string;
          prompt?: string;
          keepSound?: boolean;
          wait?: boolean;
        },
        cmd: Command,
      ) => {
        const json = isJsonMode(cmd);
        const api = await createApiClient();
        const source = await resolveImageSource(api, opts, json);
        const referenceVideoKey = await uploadFile(api, 'driver_video', opts.driver, { quiet: json });
        const video = await createMotionControl(api, {
          ...source,
          referenceVideoKey,
          prompt: opts.prompt,
          keepOriginalSound: opts.keepSound,
        });
        await finishCreate(api, video, opts, json, 'Generating video');
      },
    );

  videos
    .command('merge <videoId>')
    .description(
      'Merge your app screen recording with the character clip into a final UGC video, with a hook text overlay (and optional background music). Free',
    )
    .requiredOption('--app-video <file>', 'App screen recording (mp4/mov) — uploaded first')
    .requiredOption('--hook <text>', 'Hook text overlay (max 150 chars)')
    .option('--music <file>', 'Background music (mp3/wav/m4a) — uploaded first')
    .option('--wait', 'Wait until the merge completes')
    .action(
      async (
        videoId: string,
        opts: { appVideo: string; hook: string; music?: string; wait?: boolean },
        cmd: Command,
      ) => {
        const json = isJsonMode(cmd);
        const api = await createApiClient();
        const appVideoKey = await uploadFile(api, 'app_video', opts.appVideo, { quiet: json });
        const musicKey = opts.music ? await uploadFile(api, 'music', opts.music, { quiet: json }) : undefined;
        const video = await mergeVideo(api, videoId, { appVideoKey, hookText: opts.hook, musicKey });
        // The merge response is the SOURCE CLIP carrying the new ad's id. That ad id — not the
        // clip id we posted to — is the handle for status, download and delete.
        const adId = video.merged_video_id == null ? undefined : String(video.merged_video_id);

        if (opts.wait) {
          if (!adId) {
            throw new ApiError(
              'The merge was accepted but the API did not return a merged_video_id, so --wait has nothing to poll. Find the ad with `clipugc ads list`.',
            );
          }
          const final = await waitForMerge(() => getMergedVideo(api, adId), { label: 'Merging ad', quiet: json });
          if (json) {
            printJson(final);
          } else {
            logger.hint(`Download the finished ad with \`clipugc ads download ${adId}\``);
          }
          return;
        }

        if (json) {
          printJson(video);
          return;
        }
        logger.success(`Merge queued${adId ? ` (ad ${adId}, from clip ${videoId})` : ''}. It renders in the background.`);
        logger.hint(
          adId
            ? `Wait for it with \`clipugc ads show ${adId}\` — or re-run with --wait.`
            : 'Find it with `clipugc ads list` — or re-run with --wait.',
        );
      },
    );

  videos
    .command('show <id>')
    .description('Show details of a character video')
    .action(async (id: string, cmd: Command) => {
      const json = isJsonMode(cmd);
      const api = await createApiClient();
      const video = await getVideo(api, id);
      if (json) {
        printJson(video);
        return;
      }
      logger.plain(`Video ${video.id}`);
      logger.kv('status', formatStatus(video.status ?? ''));
      for (const [key, value] of Object.entries(video)) {
        if (key === 'id' || key === 'status') continue;
        if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
          logger.kv(key, value as string | number | boolean | null);
        }
      }
      if (video.status === 'completed') {
        logger.hint(`Download the clip with \`clipugc videos download ${video.id}\``);
      }
      if (video.merged_video_id != null) {
        logger.hint(`The ad made from this clip is \`clipugc ads show ${video.merged_video_id}\``);
      }
    });

  videos
    .command('status <id>')
    .description('Check the processing status of a character video')
    .action(async (id: string, cmd: Command) => {
      const json = isJsonMode(cmd);
      const api = await createApiClient();
      const check = await checkVideoStatus(api, id);
      if (json) {
        printJson(check);
        return;
      }
      logger.plain(`Status: ${formatStatus(check.status ?? 'unknown')}`);
      const mergeStatus = typeof check.merge_status === 'string' ? check.merge_status : undefined;
      const media = check.media as { has_merged?: boolean } | undefined;
      if (mergeStatus || media?.has_merged) {
        logger.kv('Merge', mergeStatus ?? (media?.has_merged ? 'completed' : '—'));
      }
      if (check.status === 'failed') {
        const reason = check.failure_reason || check.error_message;
        if (reason) logger.warn(String(reason));
        logger.hint(`Retry with \`clipugc videos retry ${id}\``);
      }
      if (mergeStatus === 'failed') {
        logger.warn('The merge failed. Re-render it with `clipugc ads retry <adId>` — merging is free.');
      }
      const adId = check.merged_video_id;
      if (adId != null) {
        logger.hint(`Ad made from this clip: \`clipugc ads show ${String(adId)}\``);
      }
      if (check.status === 'completed') {
        logger.hint(`Download it with \`clipugc videos download ${id}\``);
      }
    });

  videos
    .command('download <id>')
    .description('Download a completed character video to disk')
    .option('-o, --output <file>', 'Destination file (default: clipugc-video-<id>.mp4)')
    .action(async (id: string, opts: { output?: string }, cmd: Command) => {
      const json = isJsonMode(cmd);
      const api = await createApiClient();
      const dest = await downloadVideo(api, id, { output: opts.output, quiet: json });
      if (json) {
        printJson({ id, output: dest });
      }
    });

  videos
    .command('retry <id>')
    .description('Retry a failed character video')
    .option('--wait', 'Wait until generation completes')
    .action(async (id: string, opts: { wait?: boolean }, cmd: Command) => {
      const json = isJsonMode(cmd);
      const api = await createApiClient();
      const video = await retryVideo(api, id);
      await finishCreate(api, { ...video, id: video.id ?? id }, opts, json, 'Generating video');
    });

  videos
    .command('delete <id>')
    .description('Delete a character video')
    .option('-y, --yes', 'Skip the confirmation prompt')
    .action(async (id: string, opts: { yes?: boolean }, cmd: Command) => {
      const json = isJsonMode(cmd);
      if (!opts.yes) {
        const ok = await confirm(`Delete video ${id}? This cannot be undone.`);
        if (!ok) throw new AbortedError();
      }
      const api = await createApiClient();
      const { data, message } = await deleteVideo(api, id);
      if (json) {
        printJson(data);
        return;
      }
      logger.success(message ?? `Video ${id} deleted.`);
    });
}
