import { describe, it, expect, vi } from 'vitest';
import type { ApiClient } from '../src/services/api.js';
import {
  deleteMergedVideo,
  downloadMergedVideo,
  getMergedVideo,
  listMergedVideos,
  retryMergedVideo,
} from '../src/services/ads.service.js';
import { ApiError, ValidationError } from '../src/utils/errors.js';

function fakeApi(
  overrides: Partial<Record<'get' | 'post' | 'request', ReturnType<typeof vi.fn>>> = {},
) {
  const get = overrides.get ?? vi.fn().mockResolvedValue({});
  const post = overrides.post ?? vi.fn().mockResolvedValue({ id: 121, status: 'pending' });
  const request = overrides.request ?? vi.fn().mockResolvedValue({ data: null, message: 'Merged video deleted' });
  return { api: { get, post, request } as unknown as ApiClient, get, post, request };
}

describe('listMergedVideos', () => {
  it('reads the native /merged-videos endpoint and unwraps merged_videos', async () => {
    const pagination = { current_page: 1, last_page: 1, per_page: 20, total: 1, has_more_pages: false };
    const ad = { id: 121, character_video_id: 21, status: 'completed', hook_text: 'this app fixed my mornings' };
    const { api, get } = fakeApi({ get: vi.fn().mockResolvedValue({ merged_videos: [ad], pagination }) });

    const result = await listMergedVideos(api, { page: 1, perPage: 20 });

    expect(get).toHaveBeenCalledWith('/merged-videos', {
      query: { page: 1, per_page: 20, status: undefined },
    });
    expect(result.items).toEqual([ad]);
    expect(result.pagination).toEqual(pagination);
    // The ad id and the clip it came from are different ids.
    expect(result.items[0].id).not.toBe(result.items[0].character_video_id);
  });

  it('sends the status filter only when given', async () => {
    const { api, get } = fakeApi();
    await listMergedVideos(api, { status: 'processing' });
    expect(get.mock.calls[0][1].query).toMatchObject({ status: 'processing' });

    await listMergedVideos(api, {});
    expect(get.mock.calls[1][1].query).toMatchObject({ status: undefined });
  });

  it('rejects an unknown status', async () => {
    const { api, get } = fakeApi();
    await expect(listMergedVideos(api, { status: 'merging' })).rejects.toThrow(ValidationError);
    expect(get).not.toHaveBeenCalled();
  });

  it('rejects per_page above the cap of 50', async () => {
    const { api } = fakeApi();
    await expect(listMergedVideos(api, { perPage: 51 })).rejects.toThrow(ValidationError);
  });
});

describe('merged-video item routes', () => {
  it('getMergedVideo addresses /merged-videos/{id}', async () => {
    const { api, get } = fakeApi({ get: vi.fn().mockResolvedValue({ id: 121, status: 'processing' }) });
    await getMergedVideo(api, '121');
    expect(get).toHaveBeenCalledWith('/merged-videos/121');
  });

  it('retryMergedVideo posts to /merged-videos/{id}/retry', async () => {
    const { api, post } = fakeApi();
    await retryMergedVideo(api, '121');
    expect(post).toHaveBeenCalledWith('/merged-videos/121/retry');
  });

  it('deleteMergedVideo deletes /merged-videos/{id} and returns the envelope message', async () => {
    const { api, request } = fakeApi();
    const result = await deleteMergedVideo(api, '121');
    expect(request).toHaveBeenCalledWith('DELETE', '/merged-videos/121');
    expect(result.message).toBe('Merged video deleted');
  });

  it('downloadMergedVideo resolves the signed URL from /merged-videos/{id}/download', async () => {
    const { api, get } = fakeApi({ get: vi.fn().mockResolvedValue({ download_url: 'https://cdn.test/ad.mp4' }) });
    const fetchMock = vi.fn().mockResolvedValue(new Response(Buffer.from('ad-bytes'), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      const dest = await downloadMergedVideo(api, '121', { output: '/dev/null', quiet: true });
      expect(get).toHaveBeenCalledWith('/merged-videos/121/download');
      expect(dest).toBe('/dev/null');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('downloadMergedVideo fails clearly when the ad has nothing to download yet', async () => {
    const { api } = fakeApi({ get: vi.fn().mockResolvedValue({}) });
    await expect(downloadMergedVideo(api, '121', { quiet: true })).rejects.toThrow(ApiError);
  });
});
