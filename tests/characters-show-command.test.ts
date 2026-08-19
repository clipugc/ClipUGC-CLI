import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { createCli } from '../src/cli.js';
import { loadConfig, saveConfig } from '../src/utils/config.js';

let tmpDir: string;

function envelopeResponse(envelope: unknown): Response {
  return new Response(JSON.stringify(envelope), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clipugc-charshow-test-'));
  process.env.CLIPUGC_CONFIG_PATH = path.join(tmpDir, 'config.json');
  delete process.env.CLIPUGC_API_KEY;
  delete process.env.CLIPUGC_API_BASE_URL;
  const config = await loadConfig();
  config.apiKey = 'tok_show';
  config.email = 'me@example.com';
  await saveConfig(config);
});

afterEach(async () => {
  delete process.env.CLIPUGC_CONFIG_PATH;
  vi.unstubAllGlobals();
  await fs.remove(tmpDir);
});

describe('characters show — dna: null tolerance', () => {
  it('skips a null dna field and a null preview_clip.clip_url without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        envelopeResponse({
          statusCode: 200,
          errorMessage: null,
          data: {
            id: 7,
            full_name: 'Isabel Romero',
            age: 26,
            // Server now serializes an empty appearance DNA as null (was []).
            dna: null,
            // A locked public row keeps the thumbnail but nulls the clip URL.
            preview_clip: { clip_url: null, clip_thumbnail_url: 'https://cdn.example/thumb.jpg' },
          },
          message: null,
        }),
      ),
    );
    const lines: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      lines.push(args.join(' '));
    });

    await expect(
      createCli().parseAsync(['characters', 'show', '7'], { from: 'user' }),
    ).resolves.toBeDefined();

    const out = lines.join('\n');
    expect(out).toContain('Isabel Romero');
    // dna is null → not rendered at all
    expect(out).not.toContain('dna');
    // clip_url is null → the preview_clip line is not printed, but the thumbnail is kept
    expect(out).not.toContain('preview_clip');
    expect(out).toContain('thumb.jpg');
    logSpy.mockRestore();
  });
});
