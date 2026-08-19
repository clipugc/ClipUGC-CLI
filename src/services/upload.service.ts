import path from 'node:path';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ora from 'ora';
import type { ApiClient } from './api.js';
import { NetworkError, ValidationError } from '../utils/errors.js';

const execFileAsync = promisify(execFile);

/** What the uploaded file will be used for — determines allowed extensions. */
export type UploadPurpose = 'driver_video' | 'app_video' | 'music' | 'photo';

/** Allowed file extensions (lowercase, no dot) per upload purpose. */
export const ALLOWED_EXTENSIONS: Record<UploadPurpose, readonly string[]> = {
  driver_video: ['mp4', 'mov'],
  app_video: ['mp4', 'mov'],
  music: ['mp3', 'wav', 'm4a'],
  photo: ['png', 'jpg', 'jpeg', 'webp'],
};

/** Driver videos must stay small enough for motion-control processing. */
export const MAX_DRIVER_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_DRIVER_VIDEO_SECONDS = 30;

/** Response of POST /uploads/presign. */
export interface PresignedUpload {
  key: string;
  upload_url: string;
  method: string;
  headers?: Record<string, string>;
  expires_at?: string;
  [key: string]: unknown;
}

/**
 * Pure validation: the file's extension must be allowed for the purpose
 * (case-insensitive). Returns the lowercase extension without the dot.
 */
export function validateExtension(purpose: UploadPurpose, filePath: string): string {
  const ext = path.extname(filePath).replace(/^\./, '').toLowerCase();
  const allowed = ALLOWED_EXTENSIONS[purpose];
  if (!ext || !allowed.includes(ext)) {
    throw new ValidationError(
      `Unsupported file type ".${ext || '?'}" for ${purpose.replace('_', ' ')} uploads. ` +
        `Allowed: ${allowed.map((e) => `.${e}`).join(', ')}.`,
    );
  }
  return ext;
}

/** Pure validation: driver video file size must be at most 50 MB. */
export function validateDriverVideoSize(sizeBytes: number): void {
  if (sizeBytes > MAX_DRIVER_VIDEO_BYTES) {
    const mb = (sizeBytes / (1024 * 1024)).toFixed(1);
    throw new ValidationError(
      `Driver video is ${mb} MB, but the maximum is 50 MB. Compress or trim the video and try again.`,
    );
  }
}

/** Pure validation: driver video duration must be at most 30 seconds. */
export function validateDriverVideoDuration(durationSeconds: number): void {
  if (durationSeconds > MAX_DRIVER_VIDEO_SECONDS) {
    throw new ValidationError(
      `Driver video is ${Math.round(durationSeconds)}s long, but the maximum is ${MAX_DRIVER_VIDEO_SECONDS}s. ` +
        'Trim the video (e.g. with ffmpeg or any editor) and try again.',
    );
  }
}

/**
 * Probe a media file's duration in seconds via ffprobe.
 * Returns null when ffprobe is not installed or fails — callers skip the
 * duration check in that case (the server enforces it anyway).
 */
export async function probeDurationSeconds(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'csv=p=0',
      filePath,
    ]);
    const duration = Number.parseFloat(stdout.trim());
    return Number.isFinite(duration) ? duration : null;
  } catch {
    return null; // ffprobe missing or unreadable file — skip silently
  }
}

export interface UploadOptions {
  /** Suppress the spinner (used in --json mode); the upload still runs. */
  quiet?: boolean;
  /** Duration probe override (tests inject this to avoid invoking ffprobe). */
  probe?: (filePath: string) => Promise<number | null>;
}

/**
 * Upload a local file for the given purpose:
 * 1. validate existence + extension (+ size/duration for driver videos),
 * 2. POST /uploads/presign to get a direct-to-storage URL,
 * 3. PUT the raw bytes to that URL (not the API envelope),
 * and return the storage `key` to reference in follow-up API calls.
 */
export async function uploadFile(
  api: ApiClient,
  purpose: UploadPurpose,
  filePath: string,
  opts: UploadOptions = {},
): Promise<string> {
  const extension = validateExtension(purpose, filePath);

  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    throw new ValidationError(`File not found: ${filePath}`);
  }
  if (!stat.isFile()) {
    throw new ValidationError(`Not a file: ${filePath}`);
  }

  if (purpose === 'driver_video') {
    validateDriverVideoSize(stat.size);
    const probe = opts.probe ?? probeDurationSeconds;
    const duration = await probe(filePath);
    if (duration !== null) {
      validateDriverVideoDuration(duration);
    }
  }

  const basename = path.basename(filePath);
  const sizeMb = (stat.size / (1024 * 1024)).toFixed(1);
  const spinner = opts.quiet ? null : ora(`Uploading ${basename} (${sizeMb} MB)`).start();

  try {
    const presign = await api.post<PresignedUpload>('/uploads/presign', {
      body: { purpose, extension },
    });

    const body = await fs.readFile(filePath);

    let response: Response;
    try {
      response = await fetch(presign.upload_url, {
        method: presign.method || 'PUT',
        headers: presign.headers ?? {},
        body,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new NetworkError(`Upload of ${basename} failed: ${reason}`);
    }

    if (!response.ok) {
      let snippet = '';
      try {
        snippet = (await response.text()).slice(0, 200);
      } catch {
        // ignore unreadable body
      }
      throw new NetworkError(
        `Upload of ${basename} failed (HTTP ${response.status})${snippet ? `: ${snippet}` : ''}`,
      );
    }

    spinner?.succeed(`Uploaded ${basename}`);
    return presign.key;
  } catch (err) {
    if (spinner?.isSpinning) spinner.fail(`Upload of ${basename} failed`);
    throw err;
  }
}
