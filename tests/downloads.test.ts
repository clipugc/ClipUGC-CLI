import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import type { ApiClient } from '../src/services/api.js';
import { downloadVideo } from '../src/services/videos.service.js';
import { downloadImage } from '../src/services/images.service.js';

const BASE = 'https://example.test/api/v1';

function envelopeResponse(data: unknown, statusCode = 200): Response {
  return new Response(JSON.stringify({ statusCode, errorMessage: null, data, message: null }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function bytesResponse(bytes: string): Response {
  return new Response(Buffer.from(bytes), { status: 200 });
}

describe('download output paths', () => {
  let dir: string;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'clipugc-dl-'));
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    process.env.CLIPUGC_API_KEY = 'test-key';
    process.env.CLIPUGC_API_BASE_URL = BASE;
  });

  afterEach(async () => {
    delete process.env.CLIPUGC_API_KEY;
    delete process.env.CLIPUGC_API_BASE_URL;
    vi.unstubAllGlobals();
    await fs.remove(dir);
  });

  it('downloadVideo creates missing parent directories for -o workspace paths', async () => {
    const get = vi.fn().mockResolvedValue({ download_url: 'https://cdn.test/v.mp4' });
    const api = { get } as unknown as ApiClient;
    fetchMock.mockResolvedValue(bytesResponse('video-bytes'));

    const dest = path.join(dir, 'clipugc', 'influencers', '12-isabella-romero', 'clips', '91-i2v-5s.mp4');
    const written = await downloadVideo(api, '91', { output: dest, quiet: true });

    expect(written).toBe(dest);
    expect(await fs.readFile(dest, 'utf8')).toBe('video-bytes');
  });

  it('downloadImage creates missing parent directories for -o workspace paths', async () => {
    fetchMock
      .mockResolvedValueOnce(envelopeResponse({ id: 87, image_url: 'https://cdn.test/look.png' }))
      .mockResolvedValueOnce(bytesResponse('image-bytes'));

    const dest = path.join(dir, 'clipugc', 'influencers', '12-isabella-romero', 'pictures', '87-cafe-selfie.png');
    const written = await downloadImage('87', { output: dest, quiet: true });

    expect(written).toBe(dest);
    expect(await fs.readFile(dest, 'utf8')).toBe('image-bytes');
  });
});
