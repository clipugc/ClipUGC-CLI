import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ValidationError } from '../src/utils/errors.js';
import {
  buildGeneratePayload,
  buildVariationPayload,
  checkImageStatus,
  createVariation,
  extractCreatedImages,
  findImageUrl,
  generateImages,
  listImages,
  parseShotTypes,
} from '../src/services/images.service.js';

const BASE = 'https://example.test/api/v1';

function envelopeResponse(data: unknown, statusCode = 200): Response {
  return new Response(JSON.stringify({ statusCode, errorMessage: null, data, message: null }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('images service', () => {
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

  describe('parseShotTypes', () => {
    it('defaults to frontal when omitted or empty', () => {
      expect(parseShotTypes()).toEqual(['frontal']);
      expect(parseShotTypes('')).toEqual(['frontal']);
      expect(parseShotTypes('  ')).toEqual(['frontal']);
    });

    it('parses comma-separated values with whitespace', () => {
      expect(parseShotTypes('frontal, three_quarter,profile')).toEqual(['frontal', 'three_quarter', 'profile']);
    });

    it('rejects unknown shot types', () => {
      expect(() => parseShotTypes('frontal,sideways')).toThrow(ValidationError);
      expect(() => parseShotTypes('frontal,sideways')).toThrow(/sideways/);
    });
  });

  describe('buildGeneratePayload', () => {
    it('applies defaults: shot_types [frontal], resolution 2K', () => {
      expect(buildGeneratePayload({})).toEqual({ shot_types: ['frontal'], resolution: '2K' });
    });

    it('builds a full payload', () => {
      expect(
        buildGeneratePayload({
          shots: 'frontal,back',
          template: 'scene_recreation',
          scene: 'on a beach at sunset',
          resolution: '2K',
        }),
      ).toEqual({
        shot_types: ['frontal', 'back'],
        template: 'scene_recreation',
        scene_prompt: 'on a beach at sunset',
        resolution: '2K',
      });
    });

    it('rejects an unknown template', () => {
      expect(() => buildGeneratePayload({ template: 'fancy' })).toThrow(ValidationError);
    });

    it('rejects a scene over 600 chars', () => {
      expect(() => buildGeneratePayload({ scene: 'x'.repeat(601) })).toThrow(ValidationError);
      expect(buildGeneratePayload({ scene: 'x'.repeat(600) }).scene_prompt).toBe('x'.repeat(600));
    });

    it('rejects an unknown resolution', () => {
      expect(() => buildGeneratePayload({ resolution: '8K' })).toThrow(ValidationError);
    });
  });

  describe('generateImages', () => {
    it('POSTs shot_types array to the reference-images endpoint', async () => {
      fetchMock.mockResolvedValue(envelopeResponse({ id: 11, status: 'pending' }, 201));
      const result = await generateImages('42', { shots: 'frontal,profile' });
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/ai-characters/42/reference-images`);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({ shot_types: ['frontal', 'profile'], resolution: '2K' });
      expect(result.images).toEqual([{ id: 11, status: 'pending' }]);
    });

    it('handles an array response', async () => {
      fetchMock.mockResolvedValue(envelopeResponse([{ id: 1 }, { id: 2 }], 201));
      const result = await generateImages('42');
      expect(result.images.map((i) => i.id)).toEqual([1, 2]);
    });
  });

  describe('buildVariationPayload validation', () => {
    it('requires scene of 3-600 chars', () => {
      expect(() => buildVariationPayload({ scene: 'ab' })).toThrow(ValidationError);
      expect(() => buildVariationPayload({ scene: 'x'.repeat(601) })).toThrow(ValidationError);
      expect(buildVariationPayload({ scene: 'abc' })).toEqual({ scene_prompt: 'abc' });
    });

    it('validates count range 1-4', () => {
      expect(() => buildVariationPayload({ scene: 'a cafe', count: 0 })).toThrow(ValidationError);
      expect(() => buildVariationPayload({ scene: 'a cafe', count: 5 })).toThrow(ValidationError);
      expect(() => buildVariationPayload({ scene: 'a cafe', count: 1.5 })).toThrow(ValidationError);
      expect(buildVariationPayload({ scene: 'a cafe', count: 4 }).count).toBe(4);
    });

    it('includes before_after when set', () => {
      expect(buildVariationPayload({ scene: 'a cafe', beforeAfter: true }).before_after).toBe(true);
      expect(buildVariationPayload({ scene: 'a cafe' })).not.toHaveProperty('before_after');
    });
  });

  describe('createVariation', () => {
    it('POSTs the validated payload', async () => {
      fetchMock.mockResolvedValue(envelopeResponse({ id: 99 }, 201));
      await createVariation('7', { scene: 'in the gym', count: 2, beforeAfter: true });
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/character-images/7/variation`);
      expect(JSON.parse(init.body)).toEqual({ scene_prompt: 'in the gym', count: 2, before_after: true });
    });
  });

  describe('checkImageStatus', () => {
    it('GETs check-status and returns the payload untouched', async () => {
      const payload = { status: 'processing', progress: 40 };
      fetchMock.mockResolvedValue(envelopeResponse(payload));
      const check = await checkImageStatus('12');
      expect(String(fetchMock.mock.calls[0][0])).toBe(`${BASE}/character-images/12/check-status`);
      expect(check).toEqual(payload);
    });
  });

  describe('listImages', () => {
    it('GETs reference-images and unwraps wrapped lists', async () => {
      fetchMock.mockResolvedValue(envelopeResponse({ images: [{ id: 1, shot_type: 'frontal' }] }));
      const { items } = await listImages('42');
      expect(String(fetchMock.mock.calls[0][0])).toBe(`${BASE}/ai-characters/42/reference-images`);
      expect(items).toEqual([{ id: 1, shot_type: 'frontal' }]);
    });
  });

  describe('extractCreatedImages tolerance', () => {
    it('wraps a single object with id into an array', () => {
      expect(extractCreatedImages({ id: 5 })).toEqual([{ id: 5 }]);
    });
    it('passes arrays through', () => {
      expect(extractCreatedImages([{ id: 1 }, { id: 2 }])).toEqual([{ id: 1 }, { id: 2 }]);
    });
    it('unwraps wrapped arrays (images / reference_images / items)', () => {
      expect(extractCreatedImages({ images: [{ id: 3 }] })).toEqual([{ id: 3 }]);
      expect(extractCreatedImages({ reference_images: [{ id: 4 }] })).toEqual([{ id: 4 }]);
      expect(extractCreatedImages({ items: [{ id: 6 }] })).toEqual([{ id: 6 }]);
    });
    it('falls back to empty for unknown shapes', () => {
      expect(extractCreatedImages(null)).toEqual([]);
      expect(extractCreatedImages({ ok: true })).toEqual([]);
    });
  });

  describe('findImageUrl', () => {
    it('tries known url field names', () => {
      expect(findImageUrl({ image_url: 'https://a/img.png' })).toBe('https://a/img.png');
      expect(findImageUrl({ url: 'https://b/img.png' })).toBe('https://b/img.png');
      expect(findImageUrl({ image: { url: 'https://c/img.png' } })).toBe('https://c/img.png');
      expect(findImageUrl({ status: 'pending' })).toBeUndefined();
    });
  });
});
