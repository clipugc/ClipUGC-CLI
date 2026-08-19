import fs from 'node:fs/promises';
import path from 'node:path';
import ora from 'ora';
import { NetworkError } from './errors.js';

/**
 * Fetch a (usually presigned) URL and write the bytes to `dest`, creating missing parent
 * directories so `-o` can target workspace paths like
 * `clipugc/influencers/<id>/ads/…` directly. Returns the destination path.
 */
export async function saveUrlToFile(url: string, dest: string, quiet = false): Promise<string> {
  const spinner = quiet ? null : ora(`Downloading to ${dest}`).start();

  try {
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
    const bytes = Buffer.from(await response.arrayBuffer());
    const dir = path.dirname(dest);
    if (dir && dir !== '.') await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(dest, bytes);
    spinner?.succeed(`Saved ${dest} (${(bytes.length / (1024 * 1024)).toFixed(1)} MB)`);
    return dest;
  } catch (err) {
    if (spinner?.isSpinning) spinner.fail(`Download to ${dest} failed`);
    throw err;
  }
}
