import type { ApiClient } from './api.js';
import type { Pagination } from '../types/index.js';
import { extractList, MAX_PER_PAGE } from './videos.service.js';
import { ApiError, ValidationError } from '../utils/errors.js';
import { saveUrlToFile } from '../utils/download.js';

/**
 * A finished UGC ad (clip + app recording + hook), as returned by the /merged-videos endpoints.
 *
 * `id` is a MERGED-VIDEO id and lives in a different id space from a clip id: it addresses
 * `/merged-videos/{id}`, never `/character-videos/{id}`. The clip the ad was rendered from is
 * `character_video_id` (null once that clip has been deleted).
 */
export interface MergedVideo {
  id: number | string;
  uuid?: string;
  /** The clip this ad was rendered from — null once that clip is deleted. */
  character_video_id?: number | string | null;
  ai_character_id?: number | string | null;
  /** pending | processing | completed | failed — this IS the merge lifecycle. */
  status: string;
  hook_text?: string | null;
  has_watermark?: boolean;
  credits_charged?: number;
  /** Server verdict: a failed ad is only re-composable while the app recording is still stored. */
  can_retry?: boolean;
  media?: {
    merged_url?: string | null;
    merged_thumbnail_url?: string | null;
    has_merged?: boolean;
    source_clip_url?: string | null;
  };
  created_at?: string;
  [key: string]: unknown;
}

export interface ListMergedVideosOptions {
  page?: number;
  perPage?: number;
  /** Server-side status filter: pending | processing | completed | failed. */
  status?: string;
}

const AD_STATUSES = ['pending', 'processing', 'completed', 'failed'];

/** GET /merged-videos — paginated list of the viewer's own finished ads. */
export async function listMergedVideos(
  api: ApiClient,
  opts: ListMergedVideosOptions = {},
): Promise<{ items: MergedVideo[]; pagination?: Pagination; raw: unknown }> {
  if (opts.perPage !== undefined && (!Number.isInteger(opts.perPage) || opts.perPage < 1 || opts.perPage > MAX_PER_PAGE)) {
    throw new ValidationError(`--per-page must be an integer between 1 and ${MAX_PER_PAGE}.`);
  }
  if (opts.page !== undefined && (!Number.isInteger(opts.page) || opts.page < 1)) {
    throw new ValidationError('--page must be a positive integer.');
  }
  if (opts.status !== undefined && !AD_STATUSES.includes(opts.status)) {
    throw new ValidationError(`--status must be one of: ${AD_STATUSES.join(', ')} (got "${opts.status}").`);
  }
  const raw = await api.get<unknown>('/merged-videos', {
    query: {
      page: opts.page,
      per_page: opts.perPage,
      status: opts.status,
    },
  });
  const { items, pagination } = extractList<MergedVideo>(raw);
  return { items, pagination, raw };
}

/** GET /merged-videos/{id}. Also the poll call — there is no check-status route for ads. */
export async function getMergedVideo(api: ApiClient, id: string): Promise<MergedVideo> {
  return api.get<MergedVideo>(`/merged-videos/${encodeURIComponent(id)}`);
}

/** POST /merged-videos/{id}/retry — re-renders a failed ad. Merging is free, so this costs nothing. */
export async function retryMergedVideo(api: ApiClient, id: string): Promise<MergedVideo> {
  return api.post<MergedVideo>(`/merged-videos/${encodeURIComponent(id)}/retry`);
}

/** DELETE /merged-videos/{id} — removes the ad only; the source clip stays on the profile. */
export async function deleteMergedVideo(
  api: ApiClient,
  id: string,
): Promise<{ data: unknown; message: string | null }> {
  const result = await api.request<unknown>('DELETE', `/merged-videos/${encodeURIComponent(id)}`);
  return { data: result.data, message: result.message };
}

/**
 * GET /merged-videos/{id}/download → data.download_url, then fetch that URL and write the bytes
 * to disk. Returns the destination path.
 */
export async function downloadMergedVideo(
  api: ApiClient,
  id: string,
  opts: { output?: string; quiet?: boolean } = {},
): Promise<string> {
  const data = await api.get<{ download_url?: string }>(`/merged-videos/${encodeURIComponent(id)}/download`);
  const url = data?.download_url;
  if (!url) {
    throw new ApiError(
      `The API did not return a download URL for ad ${id}. Has the merge finished? Check \`clipugc ads show ${id}\`.`,
    );
  }
  return saveUrlToFile(url, opts.output || `clipugc-ad-${id}.mp4`, Boolean(opts.quiet));
}
