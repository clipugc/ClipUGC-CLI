import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthError, InsufficientCreditsError, PremiumRequiredError, ValidationError } from '../src/utils/errors.js';

/**
 * Each MCP tool is an adapter over the service layer, so the services are mocked and every
 * test asserts two things: the right service function was called with the right arguments
 * (the same ones the CLI command would pass), and the result is JSON text the model can use.
 */
vi.mock('../src/services/api.js', () => ({ createApiClient: vi.fn() }));
vi.mock('../src/services/characters.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/characters.service.js')>();
  return { ...actual, listCharacters: vi.fn(), createCharacter: vi.fn(), parseDnaJson: vi.fn() };
});
vi.mock('../src/services/images.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/images.service.js')>();
  return { ...actual, generateImages: vi.fn(), listImages: vi.fn() };
});
vi.mock('../src/services/videos.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/videos.service.js')>();
  return {
    ...actual,
    createImageToVideo: vi.fn(),
    createMotionControl: vi.fn(),
    mergeVideo: vi.fn(),
    checkVideoStatus: vi.fn(),
    downloadVideo: vi.fn(),
  };
});
vi.mock('../src/services/ads.service.js', () => ({ getMergedVideo: vi.fn(), downloadMergedVideo: vi.fn() }));
vi.mock('../src/services/user.service.js', () => ({ getCredits: vi.fn() }));
vi.mock('../src/services/hooks.service.js', () => ({ suggestHooks: vi.fn() }));
vi.mock('../src/services/upload.service.js', () => ({ uploadFile: vi.fn() }));

import { createApiClient } from '../src/services/api.js';
import * as characters from '../src/services/characters.service.js';
import * as images from '../src/services/images.service.js';
import * as videos from '../src/services/videos.service.js';
import * as ads from '../src/services/ads.service.js';
import * as user from '../src/services/user.service.js';
import * as hooks from '../src/services/hooks.service.js';
import * as uploads from '../src/services/upload.service.js';
import { TOOLS, TOOL_NAMES, getTool, runTool, type ToolDefinition } from '../src/mcp/tools.js';

const FAKE_API = { baseUrl: 'https://example.test/api/v2' } as never;

function tool(name: string): ToolDefinition {
  const def = getTool(name);
  if (!def) throw new Error(`tool ${name} not registered`);
  return def;
}

/** Run a tool and parse its JSON text payload. */
async function call(name: string, args: unknown): Promise<{ data: Record<string, unknown>; text: string; isError: boolean }> {
  const result = await runTool(tool(name), args);
  const text = result.content[0]?.text ?? '';
  let data: Record<string, unknown> = {};
  if (!result.isError) data = JSON.parse(text) as Record<string, unknown>;
  return { data, text, isError: Boolean(result.isError) };
}

beforeEach(() => {
  vi.mocked(createApiClient).mockResolvedValue(FAKE_API);
});

describe('mcp tool catalogue', () => {
  it('registers exactly the 11 documented tools, each with a description and schema', () => {
    expect(TOOLS.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
    expect(TOOLS).toHaveLength(11);
    for (const t of TOOLS) {
      expect(t.description.length, `${t.name} description`).toBeGreaterThan(40);
      expect(t.inputSchema, `${t.name} inputSchema`).toBeTypeOf('object');
    }
  });

  it('read-only tools are annotated as such', () => {
    for (const name of ['list_characters', 'list_images', 'get_video', 'get_credits', 'list_hooks']) {
      expect(tool(name).annotations.readOnlyHint, name).toBe(true);
    }
    for (const name of ['create_character', 'generate_image', 'create_clip', 'create_motion_clip', 'merge_ad']) {
      expect(tool(name).annotations.readOnlyHint, name).toBe(false);
    }
  });
});

describe('missing API key', () => {
  it('turns the AuthError from createApiClient into a clear login instruction (not a thrown error)', async () => {
    vi.mocked(createApiClient).mockRejectedValue(
      new AuthError('Not logged in. Create an API key in your ClipUGC dashboard, then run `clipugc auth login`.'),
    );
    const { isError, text } = await call('get_credits', {});
    expect(isError).toBe(true);
    expect(text).toContain('clipugc auth login');
    expect(text).toContain('CLIPUGC_API_KEY');
    expect(text).toContain('clipugc.com/dashboard');
    expect(user.getCredits).not.toHaveBeenCalled();
  });

  it('applies the same mapping when a service that builds its own client rejects with AuthError', async () => {
    vi.mocked(characters.listCharacters).mockRejectedValue(new AuthError());
    const { isError, text } = await call('list_characters', {});
    expect(isError).toBe(true);
    expect(text).toContain('clipugc auth login');
  });
});

describe('list_characters', () => {
  it('defaults to scope mine and passes search/page/per_page through', async () => {
    vi.mocked(characters.listCharacters).mockResolvedValue({
      items: [{ id: 1, display_name: 'Isabel' }],
      pagination: { current_page: 2, last_page: 3, per_page: 10, total: 25, has_more_pages: true },
      raw: {},
    });
    const { data } = await call('list_characters', { search: 'isa', page: 2, per_page: 10 });
    expect(characters.listCharacters).toHaveBeenCalledWith({ scope: 'mine', search: 'isa', page: 2, perPage: 10 });
    expect(data.items).toEqual([{ id: 1, display_name: 'Isabel' }]);
    expect((data.pagination as { total: number }).total).toBe(25);
  });

  it('accepts scope discover and rejects per_page above 50 before calling the service', async () => {
    vi.mocked(characters.listCharacters).mockResolvedValue({ items: [], raw: {} });
    await call('list_characters', { scope: 'discover' });
    expect(characters.listCharacters).toHaveBeenCalledWith(expect.objectContaining({ scope: 'discover' }));

    vi.mocked(characters.listCharacters).mockClear();
    const { isError, text } = await call('list_characters', { per_page: 51 });
    expect(isError).toBe(true);
    expect(text).toContain('per_page');
    expect(characters.listCharacters).not.toHaveBeenCalled();
  });
});

describe('create_character', () => {
  it('maps description path: public by default, private opts out, returns first look id and poll hint', async () => {
    vi.mocked(characters.createCharacter).mockResolvedValue({
      id: 42,
      reference_images: [{ id: 87, status: 'pending' }],
    });
    const { data } = await call('create_character', {
      description: 'playful italian street musician woman in her 20s',
      scene: 'golden hour bedroom selfie',
      private: true,
      make_video: true,
      motion_prompt: 'she smirks slowly',
      inspiration: ['/tmp/a.jpg'],
    });
    expect(characters.createCharacter).toHaveBeenCalledWith({
      description: 'playful italian street musician woman in her 20s',
      scene: 'golden hour bedroom selfie',
      inspirationFiles: ['/tmp/a.jpg'],
      name: undefined,
      age: undefined,
      gender: undefined,
      isPublic: false,
      dna: undefined,
      makeVideo: true,
      motionPrompt: 'she smirks slowly',
    });
    expect(data.first_look_id).toBe(87);
    expect(data.first_clip_id).toBeNull();
    expect(String(data.next)).toContain('list_images');
  });

  it('description path without private is public', async () => {
    vi.mocked(characters.createCharacter).mockResolvedValue({ id: 1 });
    await call('create_character', { description: 'a calm nordic woman in her twenties' });
    expect(characters.createCharacter).toHaveBeenCalledWith(expect.objectContaining({ isPublic: true }));
  });

  it('advanced path parses dna_json and keeps the server default visibility', async () => {
    vi.mocked(characters.parseDnaJson).mockResolvedValue({ hair_color: 'black' });
    vi.mocked(characters.createCharacter).mockResolvedValue({ id: 2, character_video: { id: 900, status: 'pending' } });
    const { data } = await call('create_character', { name: 'Mara Lind', age: 24, gender: 'female', dna_json: '{"hair_color":"black"}' });
    expect(characters.parseDnaJson).toHaveBeenCalledWith('{"hair_color":"black"}');
    expect(characters.createCharacter).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Mara Lind', age: 24, gender: 'female', isPublic: undefined, dna: { hair_color: 'black' } }),
    );
    expect(data.first_clip_id).toBe(900);
  });

  it('requires description or name', async () => {
    const { isError, text } = await call('create_character', { scene: 'x' });
    expect(isError).toBe(true);
    expect(text).toContain('description');
    expect(characters.createCharacter).not.toHaveBeenCalled();
  });
});

describe('generate_image', () => {
  it('passes the CLI options through and returns created ids with the poll hint', async () => {
    vi.mocked(images.generateImages).mockResolvedValue({
      raw: {},
      images: [{ id: 11, status: 'pending' }, { id: 12, status: 'pending' }],
    });
    const { data } = await call('generate_image', {
      character: '5',
      shots: 'frontal,three_quarter',
      template: 'scene_recreation',
      scene: 'bathroom mirror selfie',
      resolution: '1K',
    });
    expect(images.generateImages).toHaveBeenCalledWith('5', {
      shots: 'frontal,three_quarter',
      template: 'scene_recreation',
      scene: 'bathroom mirror selfie',
      resolution: '1K',
    });
    expect(data.images).toEqual([{ id: 11, status: 'pending' }, { id: 12, status: 'pending' }]);
    expect(String(data.next)).toContain('list_images');
  });

  it('rejects an unknown template at the schema layer', async () => {
    const { isError, text } = await call('generate_image', { character: '5', template: 'bogus' });
    expect(isError).toBe(true);
    expect(text).toContain('template');
    expect(images.generateImages).not.toHaveBeenCalled();
  });
});

describe('list_images', () => {
  it('lists looks of a character', async () => {
    vi.mocked(images.listImages).mockResolvedValue({ items: [{ id: 87, status: 'completed' }], raw: {} });
    const { data } = await call('list_images', { character: '5' });
    expect(images.listImages).toHaveBeenCalledWith('5');
    expect(data.items).toEqual([{ id: 87, status: 'completed' }]);
  });
});

describe('create_clip', () => {
  it('uses a look id directly and returns the job id plus the get_video poll hint (no waiting)', async () => {
    vi.mocked(videos.createImageToVideo).mockResolvedValue({ id: 91, status: 'pending' });
    const { data } = await call('create_clip', { image: '87', prompt: 'she smirks, lips closed', duration: 10, keep_sound: true });
    expect(videos.createImageToVideo).toHaveBeenCalledWith(FAKE_API, {
      characterReferenceImageId: '87',
      prompt: 'she smirks, lips closed',
      scenePrompt: undefined,
      duration: 10,
      keepOriginalSound: true,
    });
    expect(uploads.uploadFile).not.toHaveBeenCalled();
    expect(data.id).toBe(91);
    expect(data.status).toBe('pending');
    expect(String(data.next)).toContain('get_video');
  });

  it('uploads a photo first (purpose photo, quiet) and passes scene as scenePrompt', async () => {
    vi.mocked(uploads.uploadFile).mockResolvedValue('uploads/photo-key.png');
    vi.mocked(videos.createImageToVideo).mockResolvedValue({ id: 92, status: 'pending' });
    await call('create_clip', { photo: '/tmp/me.png', scene: 'parked car in daylight' });
    expect(uploads.uploadFile).toHaveBeenCalledWith(FAKE_API, 'photo', '/tmp/me.png', { quiet: true });
    expect(videos.createImageToVideo).toHaveBeenCalledWith(
      FAKE_API,
      expect.objectContaining({ sourceImageKey: 'uploads/photo-key.png', scenePrompt: 'parked car in daylight' }),
    );
  });

  it('requires exactly one of image or photo and only 5 or 10 seconds', async () => {
    const both = await call('create_clip', { image: '1', photo: '/tmp/x.png' });
    expect(both.isError).toBe(true);
    expect(both.text).toContain('exactly one');

    const neither = await call('create_clip', { prompt: 'hi' });
    expect(neither.isError).toBe(true);

    const badDuration = await call('create_clip', { image: '1', duration: 7 });
    expect(badDuration.isError).toBe(true);
    expect(badDuration.text).toContain('duration');
    expect(videos.createImageToVideo).not.toHaveBeenCalled();
  });

  it('surfaces insufficient credits with a get_credits hint', async () => {
    vi.mocked(videos.createImageToVideo).mockRejectedValue(new InsufficientCreditsError('Insufficient credits. Need 7, have 2.'));
    const { isError, text } = await call('create_clip', { image: '87' });
    expect(isError).toBe(true);
    expect(text).toContain('get_credits');
    expect(text).toContain('Need 7, have 2');
  });

  it('surfaces premium-required (1002) with an upgrade hint', async () => {
    vi.mocked(videos.createImageToVideo).mockRejectedValue(new PremiumRequiredError('Premium subscription required.'));
    const { isError, text } = await call('create_clip', { image: '87' });
    expect(isError).toBe(true);
    expect(text).toContain('Premium subscription required');
    expect(text).toContain('paid plan');
  });
});

describe('create_motion_clip', () => {
  it('uploads the driver video and calls motion control with its key', async () => {
    vi.mocked(uploads.uploadFile).mockResolvedValue('uploads/driver.mp4');
    vi.mocked(videos.createMotionControl).mockResolvedValue({ id: 93, status: 'pending' });
    const { data } = await call('create_motion_clip', { image: '87', driver: '/tmp/drive.mp4', prompt: 'wave', keep_sound: false });
    expect(uploads.uploadFile).toHaveBeenCalledWith(FAKE_API, 'driver_video', '/tmp/drive.mp4', { quiet: true });
    expect(videos.createMotionControl).toHaveBeenCalledWith(FAKE_API, {
      characterReferenceImageId: '87',
      referenceVideoKey: 'uploads/driver.mp4',
      prompt: 'wave',
      keepOriginalSound: false,
    });
    expect(data.id).toBe(93);
  });

  it('requires the driver argument', async () => {
    const { isError, text } = await call('create_motion_clip', { image: '87' });
    expect(isError).toBe(true);
    expect(text).toContain('driver');
    expect(videos.createMotionControl).not.toHaveBeenCalled();
  });
});

describe('merge_ad', () => {
  it('uploads app video (and music), merges, and returns the AD id with the kind:"ad" poll hint', async () => {
    vi.mocked(uploads.uploadFile).mockResolvedValueOnce('uploads/app.mp4').mockResolvedValueOnce('uploads/music.mp3');
    vi.mocked(videos.mergeVideo).mockResolvedValue({ id: 91, status: 'completed', merge_status: 'processing', merged_video_id: 121 });
    const { data } = await call('merge_ad', { video: '91', app_video: '/tmp/app.mp4', hook: 'nobody talks about this app', music: '/tmp/m.mp3' });
    expect(uploads.uploadFile).toHaveBeenNthCalledWith(1, FAKE_API, 'app_video', '/tmp/app.mp4', { quiet: true });
    expect(uploads.uploadFile).toHaveBeenNthCalledWith(2, FAKE_API, 'music', '/tmp/m.mp3', { quiet: true });
    expect(videos.mergeVideo).toHaveBeenCalledWith(FAKE_API, '91', {
      appVideoKey: 'uploads/app.mp4',
      hookText: 'nobody talks about this app',
      musicKey: 'uploads/music.mp3',
    });
    expect(data.merged_video_id).toBe(121);
    expect(data.clip_id).toBe(91);
    expect(String(data.next)).toContain('"kind": "ad"');
  });

  it('rejects a hook over 150 chars before uploading anything', async () => {
    const { isError, text } = await call('merge_ad', { video: '91', app_video: '/tmp/app.mp4', hook: 'x'.repeat(151) });
    expect(isError).toBe(true);
    expect(text).toContain('hook');
    expect(uploads.uploadFile).not.toHaveBeenCalled();
  });
});

describe('get_video', () => {
  it('polls a clip via check-status by default and tells the model what to do next', async () => {
    vi.mocked(videos.checkVideoStatus).mockResolvedValue({ status: 'completed' });
    const { data } = await call('get_video', { id: '91' });
    expect(videos.checkVideoStatus).toHaveBeenCalledWith(FAKE_API, '91');
    expect(ads.getMergedVideo).not.toHaveBeenCalled();
    expect(data.kind).toBe('clip');
    expect(data.status).toBe('completed');
    expect(String(data.next)).toContain('download_video');
  });

  it('reports a failed clip with its reason', async () => {
    vi.mocked(videos.checkVideoStatus).mockResolvedValue({ status: 'failed', failure_reason: 'provider timeout' });
    const { data } = await call('get_video', { id: '91' });
    expect(String(data.next)).toContain('provider timeout');
  });

  it('polls a merged ad when kind is "ad"', async () => {
    vi.mocked(ads.getMergedVideo).mockResolvedValue({ id: 121, status: 'processing' });
    const { data } = await call('get_video', { id: '121', kind: 'ad' });
    expect(ads.getMergedVideo).toHaveBeenCalledWith(FAKE_API, '121');
    expect(videos.checkVideoStatus).not.toHaveBeenCalled();
    expect(data.kind).toBe('ad');
    expect(data.status).toBe('processing');
  });
});

describe('download_video', () => {
  it('downloads a clip quietly to the requested path and returns an absolute path', async () => {
    vi.mocked(videos.downloadVideo).mockResolvedValue('/tmp/out/clip.mp4');
    const { data } = await call('download_video', { id: '91', output: '/tmp/out/clip.mp4' });
    expect(videos.downloadVideo).toHaveBeenCalledWith(FAKE_API, '91', { output: '/tmp/out/clip.mp4', quiet: true });
    expect(data.output).toBe('/tmp/out/clip.mp4');
    expect(data.kind).toBe('clip');
  });

  it('downloads an ad via the merged-videos service when kind is "ad"', async () => {
    vi.mocked(ads.downloadMergedVideo).mockResolvedValue('clipugc-ad-121.mp4');
    const { data } = await call('download_video', { id: '121', kind: 'ad' });
    expect(ads.downloadMergedVideo).toHaveBeenCalledWith(FAKE_API, '121', { output: undefined, quiet: true });
    expect(videos.downloadVideo).not.toHaveBeenCalled();
    expect(String(data.output).endsWith('clipugc-ad-121.mp4')).toBe(true);
  });
});

describe('get_credits', () => {
  it('returns balance and live costs', async () => {
    vi.mocked(user.getCredits).mockResolvedValue({ balance: 42, costs: { image: 2, clip: 7, clip_10s: 13, merge: 0 } });
    const { data } = await call('get_credits', {});
    expect(user.getCredits).toHaveBeenCalledWith(FAKE_API);
    expect(data.balance).toBe(42);
    expect((data.costs as Record<string, number>).clip_10s).toBe(13);
  });
});

describe('list_hooks', () => {
  it('passes context to the hooks service and returns the list', async () => {
    vi.mocked(hooks.suggestHooks).mockResolvedValue({ hooks: ['nobody talks about this app', 'why did nobody tell me'], raw: {} });
    const { data } = await call('list_hooks', { context: 'habit tracker' });
    expect(hooks.suggestHooks).toHaveBeenCalledWith(FAKE_API, 'habit tracker');
    expect(data.hooks).toHaveLength(2);
  });
});

describe('error mapping', () => {
  it('reports service validation errors as isError text with the error name', async () => {
    vi.mocked(images.listImages).mockRejectedValue(new ValidationError('Character not found.'));
    const { isError, text } = await call('list_images', { character: '404' });
    expect(isError).toBe(true);
    expect(text).toBe('ValidationError: Character not found.');
  });
});
