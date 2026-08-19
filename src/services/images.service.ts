/**
 * Character images (looks) service — request building, client-side validation
 * and API calls for the `clipugc images` command group.
 *
 * All validation lives here (unit-testable); command handlers stay thin.
 * Throws typed errors from utils/errors.js — never exits the process.
 */

import { createApiClient } from './api.js';
import { ValidationError } from '../utils/errors.js';
import { extractList } from './characters.service.js';

/** A character look (reference image) record. Unknown fields are preserved. */
export interface CharacterImage {
  id: number | string;
  shot_type?: string;
  status?: string;
  image_url?: string;
  url?: string;
  created_at?: string;
  [key: string]: unknown;
}

/** Payload of GET /character-images/{id}/check-status. */
export interface ImageStatusCheck {
  status: string;
  failure_reason?: string | null;
  error_message?: string | null;
  [key: string]: unknown;
}

export const SHOT_TYPES = ['frontal', 'three_quarter', 'profile', 'back'] as const;
export const TEMPLATES = ['model_digitals', 'scene_recreation', 'specific_angle'] as const;
export const RESOLUTIONS = ['0.5K', '1K', '2K', '4K'] as const;

export const DEFAULT_SHOTS: string[] = ['frontal'];
export const DEFAULT_TEMPLATE = 'model_digitals';
export const DEFAULT_RESOLUTION = '2K';

export const SCENE_MAX = 600;
export const VARIATION_SCENE_MIN = 3;
export const VARIATION_COUNT_MIN = 1;
export const VARIATION_COUNT_MAX = 4;

/** Keys the API might wrap an image list in (tolerant unwrapping). */
export const IMAGE_LIST_KEYS = ['items', 'images', 'reference_images', 'character_images', 'data'];

/**
 * Parse a comma-separated --shots value into a validated shot_types array.
 * Defaults to ['frontal'] when omitted/empty.
 */
export function parseShotTypes(input?: string): string[] {
  if (input === undefined || input.trim() === '') return [...DEFAULT_SHOTS];
  const shots = input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
  if (shots.length === 0) return [...DEFAULT_SHOTS];
  for (const shot of shots) {
    if (!(SHOT_TYPES as readonly string[]).includes(shot)) {
      throw new ValidationError(`Invalid shot type "${shot}". Allowed: ${SHOT_TYPES.join(', ')}.`);
    }
  }
  return shots;
}

export interface GenerateImagesInput {
  /** Comma-separated shot types, e.g. "frontal,three_quarter". */
  shots?: string;
  template?: string;
  scene?: string;
  resolution?: string;
}

/** Build + validate the POST /ai-characters/{id}/reference-images payload. */
export function buildGeneratePayload(input: GenerateImagesInput = {}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    shot_types: parseShotTypes(input.shots),
  };

  // Template is optional server-side (auto: scene → scene_recreation, else model_digitals).
  if (input.template !== undefined && input.template !== '') {
    if (!(TEMPLATES as readonly string[]).includes(input.template)) {
      throw new ValidationError(`Invalid template "${input.template}". Allowed: ${TEMPLATES.join(', ')}.`);
    }
    payload.template = input.template;
  }

  if (input.scene !== undefined && input.scene !== '') {
    if (input.scene.length > SCENE_MAX) {
      throw new ValidationError(`Scene prompt must be at most ${SCENE_MAX} characters (got ${input.scene.length}).`);
    }
    payload.scene_prompt = input.scene;
  }

  const resolution = input.resolution === undefined || input.resolution === '' ? DEFAULT_RESOLUTION : input.resolution;
  if (!(RESOLUTIONS as readonly string[]).includes(resolution)) {
    throw new ValidationError(`Invalid resolution "${resolution}". Allowed: ${RESOLUTIONS.join(', ')}.`);
  }
  payload.resolution = resolution;

  return payload;
}

/**
 * Normalize the create/variation response into an array of image records:
 * handles a single object with id, a bare array, or a wrapped array.
 */
export function extractCreatedImages(data: unknown): CharacterImage[] {
  if (Array.isArray(data)) return data.filter((x): x is CharacterImage => Boolean(x) && typeof x === 'object');
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (obj.id !== undefined) return [obj as CharacterImage];
    const wrapped = extractList<CharacterImage>(data, IMAGE_LIST_KEYS);
    if (wrapped.length > 0) return wrapped;
  }
  return [];
}

export interface GenerateImagesResult {
  /** Raw response data (for --json passthrough). */
  raw: unknown;
  /** Normalized created image record(s). */
  images: CharacterImage[];
}

/** POST /ai-characters/{id}/reference-images */
export async function generateImages(characterId: string, input: GenerateImagesInput = {}): Promise<GenerateImagesResult> {
  const payload = buildGeneratePayload(input);
  const api = await createApiClient();
  const raw = await api.post<unknown>(`/ai-characters/${characterId}/reference-images`, { body: payload });
  return { raw, images: extractCreatedImages(raw) };
}

/** GET /ai-characters/{id}/reference-images */
export async function listImages(characterId: string): Promise<{ items: CharacterImage[]; raw: unknown }> {
  const api = await createApiClient();
  const raw = await api.get<unknown>(`/ai-characters/${characterId}/reference-images`);
  return { items: extractList<CharacterImage>(raw, IMAGE_LIST_KEYS), raw };
}

/** GET /character-images/{id} */
export async function getImage(id: string): Promise<CharacterImage> {
  const api = await createApiClient();
  const data = await api.get<unknown>(`/character-images/${id}`);
  const images = extractCreatedImages(data);
  return images[0] ?? (data as CharacterImage);
}

/** GET /character-images/{id}/check-status — returned as-is (poll payload). */
export async function checkImageStatus(id: string): Promise<ImageStatusCheck> {
  const api = await createApiClient();
  return api.get<ImageStatusCheck>(`/character-images/${id}/check-status`);
}

/**
 * Download a look's image to disk. The API serves signed temporary URLs on the
 * image record (media.image_url), so we fetch the record first, then the bytes.
 */
export async function downloadImage(id: string, opts: { output?: string; quiet?: boolean } = {}): Promise<string> {
  const image = await getImage(id);
  const url = findImageUrl(image);
  if (!url) {
    throw new ValidationError(`Look ${id} has no image yet — check \`clipugc images status ${id}\`.`);
  }

  const extension = /\.(png|jpe?g|webp)(\?|$)/i.exec(url)?.[1]?.toLowerCase() ?? 'png';
  const dest = opts.output || `clipugc-look-${id}.${extension}`;

  const { NetworkError } = await import('../utils/errors.js');
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new NetworkError(`Download failed: ${reason}`);
  }
  if (!response.ok) {
    throw new NetworkError(`Download failed (HTTP ${response.status}). The link may have expired — try again.`);
  }

  const fs = (await import('fs-extra')).default;
  // outputFile creates missing parent directories, so -o can target
  // workspace paths like clipugc/influencers/<id>/pictures/… directly.
  await fs.outputFile(dest, Buffer.from(await response.arrayBuffer()));
  return dest;
}

export interface VariationInput {
  scene: string;
  count?: number;
  beforeAfter?: boolean;
}

/** Build + validate the POST /character-images/{id}/variation payload. */
export function buildVariationPayload(input: VariationInput): Record<string, unknown> {
  const scene = (input.scene ?? '').trim();
  if (scene.length < VARIATION_SCENE_MIN || scene.length > SCENE_MAX) {
    throw new ValidationError(
      `Variation scene prompt must be ${VARIATION_SCENE_MIN}-${SCENE_MAX} characters (got ${scene.length}).`,
    );
  }

  const payload: Record<string, unknown> = { scene_prompt: scene };

  if (input.count !== undefined) {
    if (!Number.isInteger(input.count) || input.count < VARIATION_COUNT_MIN || input.count > VARIATION_COUNT_MAX) {
      throw new ValidationError(
        `--count must be an integer between ${VARIATION_COUNT_MIN} and ${VARIATION_COUNT_MAX} (got ${input.count}).`,
      );
    }
    payload.count = input.count;
  }

  if (input.beforeAfter !== undefined) payload.before_after = input.beforeAfter;

  return payload;
}

/** POST /character-images/{id}/variation */
export async function createVariation(id: string, input: VariationInput): Promise<GenerateImagesResult> {
  const payload = buildVariationPayload(input);
  const api = await createApiClient();
  const raw = await api.post<unknown>(`/character-images/${id}/variation`, { body: payload });
  return { raw, images: extractCreatedImages(raw) };
}

/** POST /character-images/{id}/retry */
export async function retryImage(id: string): Promise<unknown> {
  const api = await createApiClient();
  return api.post<unknown>(`/character-images/${id}/retry`);
}

/** DELETE /character-images/{id} */
export async function deleteImage(id: string): Promise<unknown> {
  const api = await createApiClient();
  return api.delete<unknown>(`/character-images/${id}`);
}

/** Best-effort URL lookup on an image/status record (field name varies). */
export function findImageUrl(record: Record<string, unknown>): string | undefined {
  const candidates = [record.image_url, record.url, record.file_url, record.public_url];
  for (const c of candidates) {
    if (typeof c === 'string' && c !== '') return c;
  }
  for (const key of ['media', 'image']) {
    const nested = record[key];
    if (nested && typeof nested === 'object') {
      const url = (nested as Record<string, unknown>).image_url ?? (nested as Record<string, unknown>).url;
      if (typeof url === 'string' && url !== '') return url;
    }
  }
  return undefined;
}
