import type { ApiClient } from './api.js';
import { ValidationError } from '../utils/errors.js';
import { saveUrlToFile } from '../utils/download.js';

/**
 * Stories — ongoing episodic videos of an AI character's life (`/stories` endpoints).
 *
 * Flow: create a series → draft an episode script (free) → approve it (charges credits,
 * generates scene-by-scene with native speech) → poll status → download the episode.
 */
export interface StorySeries {
  id: number | string;
  title: string;
  premise?: string;
  tone?: string | null;
  /** 480P (standard) | 768P (HD) */
  resolution?: string;
  status?: string;
  episode_count?: number;
  story_summary?: string | null;
  character?: { id?: number | string; name?: string };
  created_at?: string;
  [key: string]: unknown;
}

export interface StoryScene {
  action: string;
  dialogue?: string | null;
  location?: string | null;
}

export interface StoryEpisode {
  id: number | string;
  story_series_id?: number | string;
  episode_number?: number;
  title?: string | null;
  /** draft | script_ready | processing | stitching | completed | failed */
  status: string;
  script?: StoryScene[];
  summary?: string | null;
  scene_count?: number;
  scenes_completed?: number;
  duration_seconds?: number;
  credits_charged?: number | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  error?: string | null;
  created_at?: string;
  [key: string]: unknown;
}

export const STORY_RESOLUTIONS = ['480P', '768P'];

/** GET /stories */
export async function listStories(api: ApiClient): Promise<{ stories: StorySeries[]; raw: unknown }> {
  const raw = await api.get<{ stories?: StorySeries[] }>('/stories');
  return { stories: raw?.stories ?? [], raw };
}

/** POST /stories */
export async function createStory(
  api: ApiClient,
  input: { characterId: string; title: string; premise: string; tone?: string; resolution?: string },
): Promise<StorySeries> {
  if (input.resolution !== undefined && !STORY_RESOLUTIONS.includes(input.resolution)) {
    throw new ValidationError(`--resolution must be one of: ${STORY_RESOLUTIONS.join(', ')} (got "${input.resolution}").`);
  }
  return api.post<StorySeries>('/stories', {
    body: {
      character_id: Number(input.characterId),
      title: input.title,
      premise: input.premise,
      tone: input.tone,
      resolution: input.resolution,
    },
  });
}

/** GET /stories/{id} — the series plus all its episodes. */
export async function getStory(
  api: ApiClient,
  id: string,
): Promise<{ story: StorySeries; episodes: StoryEpisode[] }> {
  const data = await api.get<{ story: StorySeries; episodes?: StoryEpisode[] }>(
    `/stories/${encodeURIComponent(id)}`,
  );
  return { story: data.story, episodes: data.episodes ?? [] };
}

/**
 * POST /stories/{id}/episodes — draft the next episode's script. Free. Pass `direction`
 * to write the plot yourself; leave it out and the AI continues the story.
 */
export async function draftEpisode(
  api: ApiClient,
  id: string,
  opts: { minutes?: number; direction?: string } = {},
): Promise<{ episode: StoryEpisode; cost_credits?: number }> {
  if (opts.minutes !== undefined && (!Number.isInteger(opts.minutes) || opts.minutes < 1 || opts.minutes > 5)) {
    throw new ValidationError('--minutes must be an integer between 1 and 5.');
  }
  return api.post<{ episode: StoryEpisode; cost_credits?: number }>(
    `/stories/${encodeURIComponent(id)}/episodes`,
    { body: { minutes: opts.minutes, direction: opts.direction } },
  );
}

/** POST /stories/{id}/episodes/{episodeId}/approve — charges credits, starts generation. */
export async function approveEpisode(
  api: ApiClient,
  id: string,
  episodeId: string,
  scenes?: StoryScene[],
): Promise<StoryEpisode> {
  return api.post<StoryEpisode>(
    `/stories/${encodeURIComponent(id)}/episodes/${encodeURIComponent(episodeId)}/approve`,
    scenes && scenes.length > 0 ? { body: { scenes } } : undefined,
  );
}

/** GET /stories/{id}/episodes/{episodeId} — status; also nudges a lost-webhook scene along. */
export async function getEpisode(api: ApiClient, id: string, episodeId: string): Promise<StoryEpisode> {
  return api.get<StoryEpisode>(
    `/stories/${encodeURIComponent(id)}/episodes/${encodeURIComponent(episodeId)}`,
  );
}

/** Save a completed episode's video to disk (the URL is short-lived — fetch fresh first). */
export async function downloadEpisode(
  api: ApiClient,
  id: string,
  episodeId: string,
  outPath?: string,
): Promise<string> {
  const episode = await getEpisode(api, id, episodeId);
  if (episode.status !== 'completed' || !episode.video_url) {
    throw new ValidationError(`Episode ${episodeId} has no downloadable video yet (status: ${episode.status}).`);
  }
  return saveUrlToFile(episode.video_url, outPath ?? `story_${id}_episode_${episode.episode_number ?? episodeId}.mp4`);
}
