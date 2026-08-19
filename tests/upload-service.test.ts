import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import type { ApiClient } from '../src/services/api.js';
import {
  MAX_DRIVER_VIDEO_BYTES,
  uploadFile,
  validateDriverVideoDuration,
  validateDriverVideoSize,
  validateExtension,
} from '../src/services/upload.service.js';
import { NetworkError, ValidationError } from '../src/utils/errors.js';

const PRESIGN = {
  key: 'uploads/photo/abc123.png',
  upload_url: 'https://storage.test/bucket/abc123.png?sig=xyz',
  method: 'PUT',
  headers: { 'Content-Type': 'image/png', 'x-amz-acl': 'private' },
  expires_at: '2026-07-18T12:00:00Z',
};

function fakeApi(post = vi.fn()): { api: ApiClient; post: ReturnType<typeof vi.fn> } {
  return { api: { post } as unknown as ApiClient, post };
}

async function makeTempFile(name: string, content = 'file-bytes'): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'clipugc-upload-test-'));
  const file = path.join(dir, name);
  await fs.writeFile(file, content);
  return file;
}

describe('validateExtension', () => {
  it('accepts allowed extensions per purpose (case-insensitive)', () => {
    expect(validateExtension('photo', '/tmp/selfie.PNG')).toBe('png');
    expect(validateExtension('photo', 'pic.webp')).toBe('webp');
    expect(validateExtension('driver_video', 'clip.MOV')).toBe('mov');
    expect(validateExtension('app_video', 'screen.mp4')).toBe('mp4');
    expect(validateExtension('music', 'track.m4a')).toBe('m4a');
  });

  it('rejects disallowed extensions with ValidationError', () => {
    expect(() => validateExtension('photo', 'doc.gif')).toThrow(ValidationError);
    expect(() => validateExtension('driver_video', 'clip.avi')).toThrow(ValidationError);
    expect(() => validateExtension('music', 'song.flac')).toThrow(ValidationError);
    expect(() => validateExtension('app_video', 'noextension')).toThrow(ValidationError);
  });

  it('lists the allowed extensions in the error message', () => {
    expect(() => validateExtension('music', 'song.ogg')).toThrow(/\.mp3, \.wav, \.m4a/);
  });
});

describe('driver video constraints', () => {
  it('accepts sizes up to 50MB and rejects larger', () => {
    expect(() => validateDriverVideoSize(MAX_DRIVER_VIDEO_BYTES)).not.toThrow();
    expect(() => validateDriverVideoSize(MAX_DRIVER_VIDEO_BYTES + 1)).toThrow(ValidationError);
  });

  it('accepts durations up to 30s and rejects longer, telling the user to trim', () => {
    expect(() => validateDriverVideoDuration(30)).not.toThrow();
    expect(() => validateDriverVideoDuration(30.9)).toThrow(ValidationError);
    expect(() => validateDriverVideoDuration(45)).toThrow(/[Tt]rim/);
  });
});

describe('uploadFile', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('presigns then PUTs the raw bytes with the presigned headers and returns the key', async () => {
    const file = await makeTempFile('selfie.png', 'png-bytes');
    const { api, post } = fakeApi(vi.fn().mockResolvedValue(PRESIGN));
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));

    const key = await uploadFile(api, 'photo', file, { quiet: true });

    expect(key).toBe(PRESIGN.key);
    expect(post).toHaveBeenCalledWith('/uploads/presign', {
      body: { purpose: 'photo', extension: 'png' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(PRESIGN.upload_url);
    expect(init.method).toBe('PUT');
    expect(init.headers).toEqual(PRESIGN.headers);
    expect(Buffer.from(init.body).toString()).toBe('png-bytes');
  });

  it('rejects a bad extension before presigning', async () => {
    const { api, post } = fakeApi();
    await expect(uploadFile(api, 'photo', '/tmp/whatever.exe', { quiet: true })).rejects.toThrow(
      ValidationError,
    );
    expect(post).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a missing file with ValidationError', async () => {
    const { api, post } = fakeApi();
    await expect(
      uploadFile(api, 'photo', '/definitely/not/there/selfie.png', { quiet: true }),
    ).rejects.toThrow(ValidationError);
    expect(post).not.toHaveBeenCalled();
  });

  it('throws NetworkError with status and body snippet when the PUT fails', async () => {
    const file = await makeTempFile('screen.mp4');
    const { api } = fakeApi(vi.fn().mockResolvedValue(PRESIGN));
    fetchMock.mockResolvedValue(new Response('<Error>AccessDenied</Error>', { status: 403 }));

    const err = await uploadFile(api, 'app_video', file, { quiet: true }).catch((e) => e);
    expect(err).toBeInstanceOf(NetworkError);
    expect(err.message).toContain('403');
    expect(err.message).toContain('AccessDenied');
  });

  it('throws NetworkError when the PUT transport fails', async () => {
    const file = await makeTempFile('screen.mp4');
    const { api } = fakeApi(vi.fn().mockResolvedValue(PRESIGN));
    fetchMock.mockRejectedValue(new TypeError('socket hang up'));

    await expect(uploadFile(api, 'app_video', file, { quiet: true })).rejects.toThrow(NetworkError);
  });

  it('rejects driver videos longer than 30s using the injected probe (no real ffprobe)', async () => {
    const file = await makeTempFile('driver.mp4');
    const { api, post } = fakeApi();
    const probe = vi.fn().mockResolvedValue(42);

    await expect(
      uploadFile(api, 'driver_video', file, { quiet: true, probe }),
    ).rejects.toThrow(ValidationError);
    expect(probe).toHaveBeenCalledWith(file);
    expect(post).not.toHaveBeenCalled();
  });

  it('skips the duration check when the probe cannot determine a duration', async () => {
    const file = await makeTempFile('driver.mp4');
    const { api } = fakeApi(vi.fn().mockResolvedValue(PRESIGN));
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));

    const key = await uploadFile(api, 'driver_video', file, {
      quiet: true,
      probe: vi.fn().mockResolvedValue(null),
    });
    expect(key).toBe(PRESIGN.key);
  });
});
