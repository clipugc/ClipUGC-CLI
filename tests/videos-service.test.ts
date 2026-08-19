import { describe, it, expect, vi } from 'vitest';
import type { ApiClient } from '../src/services/api.js';
import {
  createImageToVideo,
  createMotionControl,
  extractList,
  listVideos,
  mergeVideo,
  MAX_HOOK_TEXT_LENGTH,
  MAX_PROMPT_LENGTH,
  MAX_SCENE_PROMPT_LENGTH,
} from '../src/services/videos.service.js';
import { ValidationError } from '../src/utils/errors.js';

function fakeApi(overrides: Partial<Record<'get' | 'post', ReturnType<typeof vi.fn>>> = {}) {
  const get = overrides.get ?? vi.fn().mockResolvedValue({});
  const post = overrides.post ?? vi.fn().mockResolvedValue({ id: 1, status: 'pending' });
  return { api: { get, post } as unknown as ApiClient, get, post };
}

describe('extractList', () => {
  const rows = [{ id: 1, status: 'completed' }];
  const pagination = { current_page: 1, last_page: 3, per_page: 10, total: 25, has_more_pages: true };

  it('handles a raw array', () => {
    expect(extractList(rows).items).toEqual(rows);
  });

  it.each(['videos', 'character_videos', 'merged_videos', 'items', 'data'])('handles the %s wrapper key', (key) => {
    const result = extractList({ [key]: rows, pagination });
    expect(result.items).toEqual(rows);
    expect(result.pagination).toEqual(pagination);
  });

  it('returns an empty list for unknown shapes', () => {
    expect(extractList(null).items).toEqual([]);
    expect(extractList({ nope: 1 }).items).toEqual([]);
  });
});

describe('listVideos', () => {
  it('passes page/per_page and returns items + pagination', async () => {
    const pagination = { current_page: 2, last_page: 2, per_page: 20, total: 30, has_more_pages: false };
    const { api, get } = fakeApi({
      get: vi.fn().mockResolvedValue({ videos: [{ id: 9, status: 'pending' }], pagination }),
    });

    const result = await listVideos(api, { page: 2, perPage: 20 });
    expect(get).toHaveBeenCalledWith('/character-videos', { query: { page: 2, per_page: 20 } });
    expect(result.items).toEqual([{ id: 9, status: 'pending' }]);
    expect(result.pagination).toEqual(pagination);
  });

  it('rejects per_page above the cap of 50', async () => {
    const { api } = fakeApi();
    await expect(listVideos(api, { perPage: 51 })).rejects.toThrow(ValidationError);
  });

  it('passes the ai_character_id filter', async () => {
    const { api, get } = fakeApi();
    await listVideos(api, { aiCharacterId: '12' });
    expect(get).toHaveBeenCalledWith('/character-videos', {
      query: { page: undefined, per_page: undefined, ai_character_id: '12', mergeable: undefined },
    });
  });

  it('sends mergeable=1 only when the flag is set', async () => {
    const { api, get } = fakeApi();
    await listVideos(api, { mergeable: true });
    expect(get.mock.calls[0][1].query).toMatchObject({ mergeable: 1 });

    await listVideos(api, {});
    expect(get.mock.calls[1][1].query).toMatchObject({ mergeable: undefined });
  });

  it('never sends the retired finals filter — ads are their own endpoint now', async () => {
    const { api, get } = fakeApi();
    await listVideos(api, { mergeable: true });
    expect(get.mock.calls[0][1].query).not.toHaveProperty('finals');
  });
});

describe('createImageToVideo', () => {
  it('requires exactly one of characterReferenceImageId / sourceImageKey', async () => {
    const { api, post } = fakeApi();
    await expect(createImageToVideo(api, {})).rejects.toThrow(ValidationError);
    await expect(
      createImageToVideo(api, { characterReferenceImageId: '5', sourceImageKey: 'uploads/a.png' }),
    ).rejects.toThrow(ValidationError);
    expect(post).not.toHaveBeenCalled();
  });

  it('sends the snake_case payload with a look reference', async () => {
    const { api, post } = fakeApi();
    await createImageToVideo(api, {
      characterReferenceImageId: '42',
      prompt: 'Talk about the app',
      scenePrompt: 'cozy cafe',
      duration: 10,
      keepOriginalSound: true,
    });
    expect(post).toHaveBeenCalledWith('/character-videos/image-to-video', {
      body: {
        character_reference_image_id: '42',
        prompt: 'Talk about the app',
        scene_prompt: 'cozy cafe',
        duration: 10,
        keep_original_sound: true,
      },
    });
  });

  it('sends source_image_key and defaults duration to 5, omitting unset fields', async () => {
    const { api, post } = fakeApi();
    await createImageToVideo(api, { sourceImageKey: 'uploads/photo/x.png' });
    expect(post).toHaveBeenCalledWith('/character-videos/image-to-video', {
      body: { source_image_key: 'uploads/photo/x.png', duration: 5 },
    });
  });

  it('rejects durations other than 5 or 10', async () => {
    const { api } = fakeApi();
    await expect(
      createImageToVideo(api, { characterReferenceImageId: '1', duration: 7 }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects over-long prompt and scene prompt', async () => {
    const { api } = fakeApi();
    await expect(
      createImageToVideo(api, {
        characterReferenceImageId: '1',
        prompt: 'x'.repeat(MAX_PROMPT_LENGTH + 1),
      }),
    ).rejects.toThrow(ValidationError);
    await expect(
      createImageToVideo(api, {
        characterReferenceImageId: '1',
        scenePrompt: 'x'.repeat(MAX_SCENE_PROMPT_LENGTH + 1),
      }),
    ).rejects.toThrow(ValidationError);
  });
});

describe('createMotionControl', () => {
  it('requires a reference video key', async () => {
    const { api } = fakeApi();
    await expect(
      createMotionControl(api, { characterReferenceImageId: '1', referenceVideoKey: '' }),
    ).rejects.toThrow(ValidationError);
  });

  it('sends the payload with reference_video_key', async () => {
    const { api, post } = fakeApi();
    await createMotionControl(api, {
      sourceImageKey: 'uploads/photo/y.png',
      referenceVideoKey: 'uploads/driver_video/d.mp4',
      keepOriginalSound: false,
    });
    expect(post).toHaveBeenCalledWith('/character-videos/motion-control', {
      body: {
        source_image_key: 'uploads/photo/y.png',
        keep_original_sound: false,
        reference_video_key: 'uploads/driver_video/d.mp4',
      },
    });
  });

  it('applies the image-source XOR rule too', async () => {
    const { api } = fakeApi();
    await expect(
      createMotionControl(api, { referenceVideoKey: 'uploads/driver_video/d.mp4' }),
    ).rejects.toThrow(ValidationError);
  });
});

describe('mergeVideo', () => {
  it('requires hook text and rejects over-long hooks', async () => {
    const { api } = fakeApi();
    await expect(mergeVideo(api, '3', { appVideoKey: 'uploads/app_video/a.mp4', hookText: '' })).rejects.toThrow(
      ValidationError,
    );
    await expect(
      mergeVideo(api, '3', {
        appVideoKey: 'uploads/app_video/a.mp4',
        hookText: 'x'.repeat(MAX_HOOK_TEXT_LENGTH + 1),
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('accepts a hook of exactly 150 chars and sends the payload with optional music', async () => {
    const { api, post } = fakeApi();
    const hook = 'h'.repeat(MAX_HOOK_TEXT_LENGTH);
    await mergeVideo(api, '3', {
      appVideoKey: 'uploads/app_video/a.mp4',
      hookText: hook,
      musicKey: 'uploads/music/m.mp3',
    });
    expect(post).toHaveBeenCalledWith('/character-videos/3/merge', {
      body: {
        app_video_key: 'uploads/app_video/a.mp4',
        hook_text: hook,
        music_key: 'uploads/music/m.mp3',
      },
    });
  });

  it('omits music_key when not provided', async () => {
    const { api, post } = fakeApi();
    await mergeVideo(api, '3', { appVideoKey: 'uploads/app_video/a.mp4', hookText: 'Try this now' });
    expect(post).toHaveBeenCalledWith('/character-videos/3/merge', {
      body: { app_video_key: 'uploads/app_video/a.mp4', hook_text: 'Try this now' },
    });
  });
});
