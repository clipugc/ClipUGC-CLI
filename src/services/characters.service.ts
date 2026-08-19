/**
 * AI characters service — request building, client-side validation and API
 * calls for the `clipugc characters` command group.
 *
 * All validation lives here (unit-testable); command handlers stay thin.
 * Throws typed errors from utils/errors.js — never exits the process.
 */

import fs from 'fs-extra';
import type { Pagination } from '../types/index.js';
import { createApiClient } from './api.js';
import { ValidationError } from '../utils/errors.js';

/** An AI character record. Unknown/extra API fields are preserved. */
export interface AiCharacter {
  id: number | string;
  full_name?: string;
  /** Server-resolved presentation name (preferred over full_name when present). */
  display_name?: string;
  age?: number;
  gender?: string;
  is_public?: boolean;
  /** feed scope only: true when this public character is not yet unlocked. */
  is_locked?: boolean;
  status?: string;
  video_count?: number;
  picture_count?: number;
  /** Nullable media object with clip url/thumbnail fields. */
  preview_clip?: {
    clip_url?: string;
    url?: string;
    clip_thumbnail_url?: string;
    thumbnail_url?: string;
    [key: string]: unknown;
  } | null;
  /** Staged first clip returned by create with make_video=true (nullable). */
  character_video?: { id: number | string; status?: string; [key: string]: unknown } | null;
  created_at?: string;
  [key: string]: unknown;
}

export const MAX_PER_PAGE = 50;

export const NAME_MIN = 2;
export const NAME_MAX = 120;
export const AGE_MIN = 18;
export const AGE_MAX = 99;

/** Keys the API might wrap a character list in (tolerant unwrapping). */
export const CHARACTER_LIST_KEYS = ['items', 'ai_characters', 'characters', 'data'];

/**
 * Tolerant list extraction: the API sometimes returns the array directly,
 * sometimes wrapped (data.items, data.ai_characters, ...). Tries known keys
 * then falls back to an empty list.
 */
export function extractList<T>(data: unknown, keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

/** Pull the pagination block out of a list response, when present. */
export function extractPagination(data: unknown): Pagination | undefined {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const pagination = (data as Record<string, unknown>).pagination;
    if (pagination && typeof pagination === 'object') return pagination as Pagination;
  }
  return undefined;
}

/**
 * Tolerant single-record extraction: response data may be the record itself
 * or wrapped under a known key (e.g. data.ai_character).
 */
export function extractRecord<T extends { id?: unknown }>(data: unknown, keys: string[]): T {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    if (obj.id !== undefined) return obj as T;
    for (const key of keys) {
      const nested = obj[key];
      if (
        nested &&
        typeof nested === 'object' &&
        !Array.isArray(nested) &&
        (nested as Record<string, unknown>).id !== undefined
      ) {
        return nested as T;
      }
    }
  }
  return data as T;
}

/** Clamp per_page into [1, MAX_PER_PAGE]. Returns undefined when not given. */
export function clampPerPage(perPage: number | undefined): number | undefined {
  if (perPage === undefined) return undefined;
  return Math.min(Math.max(perPage, 1), MAX_PER_PAGE);
}

/**
 * Presentation name for a character: prefer the server's display_name, fall
 * back to full_name (ignoring the "Unnamed" placeholder), then to a client
 * default of "AI Influencer #<id>".
 */
export function getDisplayName(character: AiCharacter): string {
  const display = character.display_name;
  if (typeof display === 'string' && display.trim() !== '') return display;
  const fullName = character.full_name ?? (typeof character.name === 'string' ? character.name : undefined);
  if (typeof fullName === 'string' && fullName.trim() !== '' && fullName.trim() !== 'Unnamed') return fullName;
  return `AI Influencer #${character.id}`;
}

/** Try known field names for a character's selected look id. */
export function getSelectedLookId(character: AiCharacter): string | number | undefined {
  const direct =
    character.selected_image_id ??
    character.selected_character_image_id ??
    character.selected_reference_image_id ??
    character.selected_look_id;
  if (typeof direct === 'number' || typeof direct === 'string') return direct;
  const nested = character.selected_image ?? character.selected_look;
  if (nested && typeof nested === 'object') {
    const id = (nested as Record<string, unknown>).id;
    if (typeof id === 'number' || typeof id === 'string') return id;
  }
  return undefined;
}

export interface ListCharactersOptions {
  scope?: 'mine' | 'discover' | 'feed';
  search?: string;
  page?: number;
  perPage?: number;
}

export interface CharacterListResult {
  items: AiCharacter[];
  pagination?: Pagination;
  /** Raw response data (for --json passthrough). */
  raw: unknown;
}

/** GET /ai-characters */
export async function listCharacters(options: ListCharactersOptions = {}): Promise<CharacterListResult> {
  const api = await createApiClient();
  const raw = await api.get<unknown>('/ai-characters', {
    query: {
      scope: options.scope ?? 'mine',
      search: options.search,
      page: options.page,
      per_page: clampPerPage(options.perPage),
    },
  });
  return {
    items: extractList<AiCharacter>(raw, CHARACTER_LIST_KEYS),
    pagination: extractPagination(raw),
    raw,
  };
}

export interface CreateCharacterInput {
  /** Full name (required, 2-120 chars). */
  /** Free-text description (primary path, like the web builder). 10-1000 chars. */
  description?: string;
  /** Optional scene/pose for the auto-generated first look. ≤600 chars. */
  scene?: string;
  /** Optional inspiration image file paths (≤6), uploaded multipart. */
  inspirationFiles?: string[];
  /** Full name (advanced/structured path; ignored when description is set). */
  name?: string;
  age?: number;
  gender?: string;
  isPublic?: boolean;
  /** DNA fields from --dna-json (lowest precedence). */
  dna?: Record<string, unknown>;
  /** Appearance fields from explicit flags, already snake_cased (override dna). */
  appearance?: Record<string, string | undefined>;
  /** Also stage the character's first video clip (make_video, default false). */
  makeVideo?: boolean;
  /** Optional motion prompt for the staged first clip (requires makeVideo). */
  motionPrompt?: string;
}

export const DESCRIPTION_MIN = 10;
export const DESCRIPTION_MAX = 1000;
export const CREATE_SCENE_MAX = 600;
export const INSPIRATION_MAX = 6;

/** Validate the character name (2-120 chars). Returns the trimmed name. */
export function validateCharacterName(name: string | undefined): string {
  const trimmed = (name ?? '').trim();
  if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) {
    throw new ValidationError(
      `Character name must be ${NAME_MIN}-${NAME_MAX} characters (got ${trimmed.length}). Pass it with --name "Full Name".`,
    );
  }
  return trimmed;
}

/** Validate the character age (integer 18-99). */
export function validateCharacterAge(age: number): number {
  if (!Number.isInteger(age) || age < AGE_MIN || age > AGE_MAX) {
    throw new ValidationError(
      `Character age must be an integer between ${AGE_MIN} and ${AGE_MAX} (got ${age}).`,
    );
  }
  return age;
}

/**
 * Apply the make_video / motion_prompt create options to a payload.
 * make_video defaults to false server-side, so it is only sent when true.
 */
function applyMakeVideo(payload: Record<string, unknown>, input: CreateCharacterInput): void {
  const motion = input.motionPrompt?.trim();
  if (motion && !input.makeVideo) {
    throw new ValidationError('--motion-prompt only applies when staging a first clip — add --make-video.');
  }
  if (input.makeVideo) {
    payload.make_video = true;
    if (motion) payload.motion_prompt = motion;
  }
}

/**
 * Build the POST /ai-characters payload.
 * Merge order: dna-json fields first, explicit flags override.
 */
export function buildCreateCharacterPayload(input: CreateCharacterInput): Record<string, unknown> {
  // Primary path (matches the web builder): one free-text description; the server
  // extracts the DNA and generates the first look in the same action.
  if (input.description !== undefined && input.description.trim() !== '') {
    const description = input.description.trim();
    if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
      throw new ValidationError(
        `Description must be ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} characters (got ${description.length}).`,
      );
    }

    const payload: Record<string, unknown> = { description };

    if (input.scene !== undefined && input.scene.trim() !== '') {
      const scene = input.scene.trim();
      if (scene.length > CREATE_SCENE_MAX) {
        throw new ValidationError(`Scene prompt must be at most ${CREATE_SCENE_MAX} characters (got ${scene.length}).`);
      }
      payload.scene_prompt = scene;
    }

    if (input.isPublic !== undefined) payload.is_public = input.isPublic;
    applyMakeVideo(payload, input);

    return payload;
  }

  // Advanced/structured path (raw DNA fields).
  const fullName = validateCharacterName(input.name);
  if (input.age !== undefined) validateCharacterAge(input.age);

  const payload: Record<string, unknown> = { ...(input.dna ?? {}) };
  for (const [key, value] of Object.entries(input.appearance ?? {})) {
    if (value !== undefined && value !== '') payload[key] = value;
  }

  payload.full_name = fullName;
  if (input.age !== undefined) payload.age = input.age;
  if (input.gender !== undefined && input.gender !== '') payload.gender = input.gender;
  if (input.isPublic !== undefined) payload.is_public = input.isPublic;
  applyMakeVideo(payload, input);

  return payload;
}

/**
 * Parse the --dna-json value: inline JSON when it starts with '{',
 * otherwise a path to a JSON file. Must be a JSON object.
 */
export async function parseDnaJson(value: string): Promise<Record<string, unknown>> {
  let parsed: unknown;
  if (value.trimStart().startsWith('{')) {
    try {
      parsed = JSON.parse(value);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new ValidationError(`--dna-json is not valid JSON: ${reason}`);
    }
  } else {
    try {
      parsed = await fs.readJson(value);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new ValidationError(`Could not read --dna-json file "${value}": ${reason}`);
    }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ValidationError('--dna-json must be a JSON object of DNA fields, e.g. {"hair_color": "black"}.');
  }
  return parsed as Record<string, unknown>;
}

/** POST /ai-characters */
export async function createCharacter(input: CreateCharacterInput): Promise<AiCharacter> {
  const payload = buildCreateCharacterPayload(input);
  const api = await createApiClient();

  const files = input.inspirationFiles ?? [];
  if (files.length > 0) {
    if (files.length > INSPIRATION_MAX) {
      throw new ValidationError(`At most ${INSPIRATION_MAX} inspiration images are allowed (got ${files.length}).`);
    }

    const form = new FormData();
    for (const [key, value] of Object.entries(payload)) {
      form.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
    }
    for (const file of files) {
      if (!(await fs.pathExists(file))) {
        throw new ValidationError(`Inspiration image not found: ${file}`);
      }
      const bytes = await fs.readFile(file);
      const name = file.split('/').pop() ?? 'inspiration.jpg';
      form.append('inspiration_images[]', new Blob([bytes]), name);
    }

    const data = await api.postForm<unknown>('/ai-characters', form);
    return extractRecord<AiCharacter>(data, ['ai_character', 'character']);
  }

  const data = await api.post<unknown>('/ai-characters', { body: payload });
  return extractRecord<AiCharacter>(data, ['ai_character', 'character']);
}

/** GET /ai-characters/{id} */
export async function getCharacter(id: string): Promise<AiCharacter> {
  const api = await createApiClient();
  const data = await api.get<unknown>(`/ai-characters/${id}`);
  return extractRecord<AiCharacter>(data, ['ai_character', 'character']);
}

/** PATCH /ai-characters/{id} — rename (validates 2-120 chars). */
export async function renameCharacter(id: string, name: string): Promise<AiCharacter> {
  const fullName = validateCharacterName(name);
  const api = await createApiClient();
  const data = await api.patch<unknown>(`/ai-characters/${id}`, { body: { full_name: fullName } });
  return extractRecord<AiCharacter>(data, ['ai_character', 'character']);
}

/** PATCH /ai-characters/{id} — publish/unpublish. */
export async function setCharacterVisibility(id: string, isPublic: boolean): Promise<AiCharacter> {
  const api = await createApiClient();
  const data = await api.patch<unknown>(`/ai-characters/${id}`, { body: { is_public: isPublic } });
  return extractRecord<AiCharacter>(data, ['ai_character', 'character']);
}

/** DELETE /ai-characters/{id} */
export async function deleteCharacter(id: string): Promise<unknown> {
  const api = await createApiClient();
  return api.delete<unknown>(`/ai-characters/${id}`);
}
