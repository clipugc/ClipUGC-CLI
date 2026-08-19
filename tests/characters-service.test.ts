import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CHARACTER_LIST_KEYS,
  buildCreateCharacterPayload,
  clampPerPage,
  createCharacter,
  extractList,
  extractPagination,
  extractRecord,
  getDisplayName,
  listCharacters,
  renameCharacter,
  setCharacterVisibility,
} from '../src/services/characters.service.js';

const BASE = 'https://example.test/api/v1';

function envelopeResponse(data: unknown, statusCode = 200): Response {
  return new Response(JSON.stringify({ statusCode, errorMessage: null, data, message: null }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('characters service', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    process.env.CLIPUGC_API_KEY = 'test-key';
    process.env.CLIPUGC_API_BASE_URL = BASE;
  });

  afterEach(() => {
    delete process.env.CLIPUGC_API_KEY;
    delete process.env.CLIPUGC_API_BASE_URL;
    vi.unstubAllGlobals();
  });

  describe('listCharacters query building', () => {
    it('defaults scope to mine and omits empty params', async () => {
      fetchMock.mockResolvedValue(envelopeResponse([]));
      await listCharacters();
      const url = new URL(String(fetchMock.mock.calls[0][0]));
      expect(url.pathname).toBe('/api/v1/ai-characters');
      expect(url.searchParams.get('scope')).toBe('mine');
      expect(url.searchParams.has('search')).toBe(false);
      expect(url.searchParams.has('page')).toBe(false);
      expect(url.searchParams.has('per_page')).toBe(false);
    });

    it('puts scope/search/page/per_page in the URL', async () => {
      fetchMock.mockResolvedValue(envelopeResponse([]));
      await listCharacters({ scope: 'discover', search: 'emma', page: 3, perPage: 25 });
      const url = new URL(String(fetchMock.mock.calls[0][0]));
      expect(url.searchParams.get('scope')).toBe('discover');
      expect(url.searchParams.get('search')).toBe('emma');
      expect(url.searchParams.get('page')).toBe('3');
      expect(url.searchParams.get('per_page')).toBe('25');
    });

    it('passes the feed scope through (own first, then public in unlock order)', async () => {
      fetchMock.mockResolvedValue(envelopeResponse([]));
      await listCharacters({ scope: 'feed' });
      const url = new URL(String(fetchMock.mock.calls[0][0]));
      expect(url.searchParams.get('scope')).toBe('feed');
    });

    it('preserves is_locked on feed rows', async () => {
      fetchMock.mockResolvedValue(
        envelopeResponse({ ai_characters: [{ id: 1, is_locked: false }, { id: 2, is_locked: true }] }),
      );
      const result = await listCharacters({ scope: 'feed' });
      expect(result.items.map((c) => c.is_locked)).toEqual([false, true]);
    });

    it('clamps per_page above 50 down to 50', async () => {
      fetchMock.mockResolvedValue(envelopeResponse([]));
      await listCharacters({ perPage: 200 });
      const url = new URL(String(fetchMock.mock.calls[0][0]));
      expect(url.searchParams.get('per_page')).toBe('50');
    });

    it('returns items and pagination from a wrapped response', async () => {
      const pagination = { current_page: 1, last_page: 2, per_page: 20, total: 30, has_more_pages: true };
      fetchMock.mockResolvedValue(
        envelopeResponse({ ai_characters: [{ id: 1, full_name: 'Emma Stone' }], pagination }),
      );
      const result = await listCharacters();
      expect(result.items).toEqual([{ id: 1, full_name: 'Emma Stone' }]);
      expect(result.pagination).toEqual(pagination);
    });
  });

  describe('clampPerPage', () => {
    it('passes through values within range', () => {
      expect(clampPerPage(10)).toBe(10);
      expect(clampPerPage(50)).toBe(50);
    });
    it('clamps out-of-range values', () => {
      expect(clampPerPage(51)).toBe(50);
      expect(clampPerPage(0)).toBe(1);
    });
    it('returns undefined when not given', () => {
      expect(clampPerPage(undefined)).toBeUndefined();
    });
  });

  describe('buildCreateCharacterPayload merging', () => {
    it('merges dna-json first, explicit flags override', () => {
      const payload = buildCreateCharacterPayload({
        name: 'Emma Stone',
        dna: { hair_color: 'red', vibe: 'quirky', nationality: 'US' },
        appearance: { hair_color: 'black', eye_color: 'green', skin_tone: undefined },
      });
      expect(payload.hair_color).toBe('black'); // flag overrides dna
      expect(payload.vibe).toBe('quirky'); // dna kept
      expect(payload.nationality).toBe('US');
      expect(payload.eye_color).toBe('green');
      expect(payload).not.toHaveProperty('skin_tone'); // undefined flags dropped
      expect(payload.full_name).toBe('Emma Stone');
    });

    it('core fields override dna-json values of the same name', () => {
      const payload = buildCreateCharacterPayload({
        name: 'Real Name',
        age: 30,
        gender: 'female',
        isPublic: true,
        dna: { full_name: 'DNA Name', age: 55, is_public: false },
      });
      expect(payload.full_name).toBe('Real Name');
      expect(payload.age).toBe(30);
      expect(payload.gender).toBe('female');
      expect(payload.is_public).toBe(true);
    });

    it('omits optional fields that were not provided', () => {
      const payload = buildCreateCharacterPayload({ name: 'Jo Doe' });
      expect(payload).toEqual({ full_name: 'Jo Doe' });
    });
  });

  describe('createCharacter', () => {
    it('POSTs the built payload and unwraps the created record', async () => {
      fetchMock.mockResolvedValue(envelopeResponse({ id: 42, full_name: 'Emma Stone' }, 201));
      const character = await createCharacter({ name: 'Emma Stone', age: 28 });
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/ai-characters`);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({ full_name: 'Emma Stone', age: 28 });
      expect(character.id).toBe(42);
    });

    it('unwraps a wrapped created record (data.ai_character)', async () => {
      fetchMock.mockResolvedValue(envelopeResponse({ ai_character: { id: 7, full_name: 'Jo Doe' } }, 201));
      const character = await createCharacter({ name: 'Jo Doe' });
      expect(character.id).toBe(7);
    });

    it('sends make_video/motion_prompt and surfaces the staged character_video', async () => {
      fetchMock.mockResolvedValue(
        envelopeResponse({ id: 43, character_video: { id: 91, status: 'pending' } }, 201),
      );
      const character = await createCharacter({
        description: 'playful italian street musician woman',
        makeVideo: true,
        motionPrompt: 'strums a guitar and smiles',
      });
      const [, init] = fetchMock.mock.calls[0];
      expect(JSON.parse(init.body)).toEqual({
        description: 'playful italian street musician woman',
        make_video: true,
        motion_prompt: 'strums a guitar and smiles',
      });
      expect(character.character_video).toEqual({ id: 91, status: 'pending' });
    });

    it('tolerates servers that do not return character_video yet', async () => {
      fetchMock.mockResolvedValue(envelopeResponse({ id: 44 }, 201));
      const character = await createCharacter({
        description: 'playful italian street musician woman',
        makeVideo: true,
      });
      expect(character.character_video).toBeUndefined();
    });
  });

  describe('getDisplayName', () => {
    it('prefers display_name over full_name', () => {
      expect(getDisplayName({ id: 1, display_name: 'Bella', full_name: 'Isabella Romero' })).toBe('Bella');
    });

    it('falls back to full_name, then the legacy name field', () => {
      expect(getDisplayName({ id: 1, full_name: 'Isabella Romero' })).toBe('Isabella Romero');
      expect(getDisplayName({ id: 1, name: 'Legacy Name' })).toBe('Legacy Name');
    });

    it('ignores the "Unnamed" placeholder and empty names', () => {
      expect(getDisplayName({ id: 6, full_name: 'Unnamed' })).toBe('AI Influencer #6');
      expect(getDisplayName({ id: 6, display_name: '  ', full_name: '' })).toBe('AI Influencer #6');
    });

    it('falls back to AI Influencer #<id> when no name is present', () => {
      expect(getDisplayName({ id: 9 })).toBe('AI Influencer #9');
    });
  });

  describe('rename / visibility', () => {
    it('renameCharacter PATCHes full_name', async () => {
      fetchMock.mockResolvedValue(envelopeResponse({ id: 5, full_name: 'New Name' }));
      await renameCharacter('5', 'New Name');
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/ai-characters/5`);
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body)).toEqual({ full_name: 'New Name' });
    });

    it('setCharacterVisibility PATCHes is_public', async () => {
      fetchMock.mockResolvedValue(envelopeResponse({ id: 5, is_public: true }));
      await setCharacterVisibility('5', true);
      const [, init] = fetchMock.mock.calls[0];
      expect(JSON.parse(init.body)).toEqual({ is_public: true });
    });
  });

  describe('extractList tolerance', () => {
    it('accepts a bare array', () => {
      expect(extractList([{ id: 1 }], CHARACTER_LIST_KEYS)).toEqual([{ id: 1 }]);
    });
    it('accepts data.items', () => {
      expect(extractList({ items: [{ id: 2 }] }, CHARACTER_LIST_KEYS)).toEqual([{ id: 2 }]);
    });
    it('accepts data.ai_characters', () => {
      expect(extractList({ ai_characters: [{ id: 3 }] }, CHARACTER_LIST_KEYS)).toEqual([{ id: 3 }]);
    });
    it('tries keys in order', () => {
      expect(extractList({ characters: [{ id: 9 }], other: 1 }, CHARACTER_LIST_KEYS)).toEqual([{ id: 9 }]);
    });
    it('falls back to empty for unknown shapes', () => {
      expect(extractList({ nope: true }, CHARACTER_LIST_KEYS)).toEqual([]);
      expect(extractList(null, CHARACTER_LIST_KEYS)).toEqual([]);
      expect(extractList('str', CHARACTER_LIST_KEYS)).toEqual([]);
    });
  });

  describe('extractPagination / extractRecord', () => {
    it('extracts data.pagination when present', () => {
      const pagination = { current_page: 1, last_page: 1, per_page: 20, total: 3, has_more_pages: false };
      expect(extractPagination({ items: [], pagination })).toEqual(pagination);
      expect(extractPagination([])).toBeUndefined();
      expect(extractPagination({ items: [] })).toBeUndefined();
    });

    it('extractRecord returns the object itself when it has an id', () => {
      expect(extractRecord({ id: 1 }, ['ai_character'])).toEqual({ id: 1 });
    });

    it('extractRecord unwraps known keys', () => {
      expect(extractRecord({ ai_character: { id: 2 } }, ['ai_character'])).toEqual({ id: 2 });
    });
  });
});
