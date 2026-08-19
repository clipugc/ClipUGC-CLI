import type { ApiClient } from './api.js';
import type { Paginated, Pagination } from '../types/index.js';
import { ApiError, ValidationError } from '../utils/errors.js';
import { saveUrlToFile } from '../utils/download.js';

export const MAX_PROMPT_LENGTH = 1500;
export const MAX_SCENE_PROMPT_LENGTH = 600;
export const MAX_HOOK_TEXT_LENGTH = 150;
export const MAX_PER_PAGE = 50;
export const ALLOWED_DURATIONS = [5, 10] as const;

/** A character video as returned by /character-videos endpoints. */
export interface CharacterVideo {
  id: number | string;
  status: string;
  kind?: string;
  type?: string;
  prompt?: string | null;
  scene_prompt?: string | null;
  duration?: number;
  is_merged?: boolean;
  /** processing | completed | failed | null (never merged). */
  merge_status?: string | null;
  /**
   * Id of the ad rendered from this clip in /merged-videos (null when never merged). Returned by
   * the merge endpoint — the handle for everything after the merge. NOT this clip's `id`.
   */
  merged_video_id?: number | string | null;
  created_at?: string;
  [key: string]: unknown;
}

/** Payload of GET /character-videos/{id}/check-status. */
export interface VideoStatusCheck {
  status: string;
  failure_reason?: string | null;
  error_message?: string | null;
  [key: string]: unknown;
}

export interface ImageToVideoInput {
  /** Exactly one of characterReferenceImageId / sourceImageKey is required. */
  characterReferenceImageId?: string;
  sourceImageKey?: string;
  prompt?: string;
  /** Extra scene description — turns the clip into a scene-staged clip (9 credits). */
  scenePrompt?: string;
  /** 5 or 10 seconds (default 5). A 5s clip costs 7 credits, a 10s clip 13. */
  duration?: number;
  keepOriginalSound?: boolean;
}

export interface MotionControlInput extends Omit<ImageToVideoInput, 'scenePrompt' | 'duration'> {
  /** Storage key of the uploaded driver video (purpose driver_video). */
  referenceVideoKey: string;
  scenePrompt?: string;
  duration?: number;
}

export interface MergeInput {
  /** Storage key of the uploaded app screen recording (purpose app_video). */
  appVideoKey: string;
  /** Hook text overlaid on the final video (required, max 150 chars). */
  hookText: string;
  /** Optional storage key of background music (purpose music). */
  musicKey?: string;
}

/**
 * Tolerant list extractor: the API may return the array raw or wrapped under
 * a known key. Pagination, when present, lives at data.pagination.
 */
export function extractList<T>(data: unknown): Paginated<T> {
  if (Array.isArray(data)) {
    return { items: data as T[] };
  }
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const pagination = (record.pagination as Pagination | undefined) ?? undefined;
    for (const key of ['videos', 'character_videos', 'merged_videos', 'items', 'data', 'results']) {
      if (Array.isArray(record[key])) {
        return { items: record[key] as T[], pagination };
      }
    }
  }
  return { items: [] };
}

function validatePrompts(prompt?: string, scenePrompt?: string): void {
  if (prompt !== undefined && prompt.length > MAX_PROMPT_LENGTH) {
    throw new ValidationError(`--prompt is too long (${prompt.length} chars, max ${MAX_PROMPT_LENGTH}).`);
  }
  if (scenePrompt !== undefined && scenePrompt.length > MAX_SCENE_PROMPT_LENGTH) {
    throw new ValidationError(`--scene is too long (${scenePrompt.length} chars, max ${MAX_SCENE_PROMPT_LENGTH}).`);
  }
}

function validateDuration(duration: number): void {
  if (!ALLOWED_DURATIONS.includes(duration as 5 | 10)) {
    throw new ValidationError(`--duration must be 5 or 10 (got ${duration}).`);
  }
}

function validateImageSource(input: { characterReferenceImageId?: string; sourceImageKey?: string }): void {
  const hasLook = Boolean(input.characterReferenceImageId);
  const hasKey = Boolean(input.sourceImageKey);
  if (hasLook === hasKey) {
    throw new ValidationError(
      'Provide exactly one image source: --image <lookId> (a generated character look) or --photo <file> (your own photo).',
    );
  }
}

function baseVideoPayload(input: ImageToVideoInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (input.characterReferenceImageId) payload.character_reference_image_id = input.characterReferenceImageId;
  if (input.sourceImageKey) payload.source_image_key = input.sourceImageKey;
  if (input.prompt !== undefined && input.prompt !== '') payload.prompt = input.prompt;
  if (input.scenePrompt !== undefined && input.scenePrompt !== '') payload.scene_prompt = input.scenePrompt;
  if (input.keepOriginalSound !== undefined) payload.keep_original_sound = input.keepOriginalSound;
  return payload;
}

export interface ListVideosOptions {
  page?: number;
  perPage?: number;
  /** Only videos of this AI character (ai_character_id filter). */
  aiCharacterId?: string;
  /** Only completed, unmerged clips — ready for `videos merge` (mergeable=1). */
  mergeable?: boolean;
}

/** GET /character-videos — paginated list of CLIPS. Finished ads live in ads.service. */
export async function listVideos(
  api: ApiClient,
  opts: ListVideosOptions = {},
): Promise<{ items: CharacterVideo[]; pagination?: Pagination; raw: unknown }> {
  if (opts.perPage !== undefined && (!Number.isInteger(opts.perPage) || opts.perPage < 1 || opts.perPage > MAX_PER_PAGE)) {
    throw new ValidationError(`--per-page must be an integer between 1 and ${MAX_PER_PAGE}.`);
  }
  if (opts.page !== undefined && (!Number.isInteger(opts.page) || opts.page < 1)) {
    throw new ValidationError('--page must be a positive integer.');
  }
  const raw = await api.get<unknown>('/character-videos', {
    query: {
      page: opts.page,
      per_page: opts.perPage,
      ai_character_id: opts.aiCharacterId,
      mergeable: opts.mergeable ? 1 : undefined,
    },
  });
  const { items, pagination } = extractList<CharacterVideo>(raw);
  return { items, pagination, raw };
}

/** POST /character-videos/image-to-video — animate a still image into a talking clip. */
export async function createImageToVideo(api: ApiClient, input: ImageToVideoInput): Promise<CharacterVideo> {
  validateImageSource(input);
  validatePrompts(input.prompt, input.scenePrompt);
  const duration = input.duration ?? 5;
  validateDuration(duration);

  const payload = baseVideoPayload(input);
  payload.duration = duration;
  return api.post<CharacterVideo>('/character-videos/image-to-video', { body: payload });
}

/** POST /character-videos/motion-control — drive the character with a reference video. */
export async function createMotionControl(api: ApiClient, input: MotionControlInput): Promise<CharacterVideo> {
  validateImageSource(input);
  if (!input.referenceVideoKey) {
    throw new ValidationError('A driver video is required (--driver <videoFile>).');
  }
  validatePrompts(input.prompt, input.scenePrompt);

  const payload = baseVideoPayload(input);
  payload.reference_video_key = input.referenceVideoKey;
  if (input.duration !== undefined) {
    validateDuration(input.duration);
    payload.duration = input.duration;
  }
  return api.post<CharacterVideo>('/character-videos/motion-control', { body: payload });
}

/** POST /character-videos/{id}/merge — merge app recording + hook text (+ music) into the final UGC video. */
export async function mergeVideo(api: ApiClient, id: string, input: MergeInput): Promise<CharacterVideo> {
  if (!input.appVideoKey) {
    throw new ValidationError('An app screen recording is required (--app-video <file>).');
  }
  if (!input.hookText || input.hookText.trim() === '') {
    throw new ValidationError('Hook text is required (--hook "your hook text").');
  }
  if (input.hookText.length > MAX_HOOK_TEXT_LENGTH) {
    throw new ValidationError(
      `--hook is too long (${input.hookText.length} chars, max ${MAX_HOOK_TEXT_LENGTH}).`,
    );
  }

  const payload: Record<string, unknown> = {
    app_video_key: input.appVideoKey,
    hook_text: input.hookText,
  };
  if (input.musicKey) payload.music_key = input.musicKey;
  return api.post<CharacterVideo>(`/character-videos/${encodeURIComponent(id)}/merge`, { body: payload });
}

/** POST /character-videos/{id}/retry. */
export async function retryVideo(api: ApiClient, id: string): Promise<CharacterVideo> {
  return api.post<CharacterVideo>(`/character-videos/${encodeURIComponent(id)}/retry`);
}

/** GET /character-videos/{id}. */
export async function getVideo(api: ApiClient, id: string): Promise<CharacterVideo> {
  return api.get<CharacterVideo>(`/character-videos/${encodeURIComponent(id)}`);
}

/** GET /character-videos/{id}/check-status. */
export async function checkVideoStatus(api: ApiClient, id: string): Promise<VideoStatusCheck> {
  return api.get<VideoStatusCheck>(`/character-videos/${encodeURIComponent(id)}/check-status`);
}

/** DELETE /character-videos/{id}. Returns the envelope message when present. */
export async function deleteVideo(api: ApiClient, id: string): Promise<{ data: unknown; message: string | null }> {
  const result = await api.request<unknown>('DELETE', `/character-videos/${encodeURIComponent(id)}`);
  return { data: result.data, message: result.message };
}

/**
 * GET /character-videos/{id}/download → data.download_url, then fetch that URL
 * and write the bytes to disk. Returns the destination path.
 */
export async function downloadVideo(
  api: ApiClient,
  id: string,
  opts: { output?: string; quiet?: boolean } = {},
): Promise<string> {
  const data = await api.get<{ download_url?: string }>(`/character-videos/${encodeURIComponent(id)}/download`);
  const url = data?.download_url;
  if (!url) {
    throw new ApiError('The API did not return a download URL. Is the video completed? Check `clipugc videos status`.');
  }
  return saveUrlToFile(url, opts.output || `clipugc-video-${id}.mp4`, Boolean(opts.quiet));
}
