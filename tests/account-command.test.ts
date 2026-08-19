import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { confirmAccountDeletion } from '../src/commands/account.js';
import { createCli } from '../src/cli.js';
import { loadConfig, saveConfig } from '../src/utils/config.js';
import { AbortedError } from '../src/utils/errors.js';

let tmpDir: string;

function envelopeResponse(envelope: unknown): Response {
  return new Response(JSON.stringify(envelope), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clipugc-account-test-'));
  process.env.CLIPUGC_CONFIG_PATH = path.join(tmpDir, 'config.json');
  delete process.env.CLIPUGC_API_KEY;
  delete process.env.CLIPUGC_API_BASE_URL;
});

afterEach(async () => {
  delete process.env.CLIPUGC_CONFIG_PATH;
  vi.unstubAllGlobals();
  await fs.remove(tmpDir);
});

describe('confirmAccountDeletion', () => {
  it('skips all prompts when yes is true', async () => {
    const deps = { confirm: vi.fn(), promptInput: vi.fn() };
    await expect(confirmAccountDeletion(true, deps)).resolves.toBeUndefined();
    expect(deps.confirm).not.toHaveBeenCalled();
    expect(deps.promptInput).not.toHaveBeenCalled();
  });

  it('throws AbortedError when the first confirm is declined', async () => {
    const deps = {
      confirm: vi.fn().mockResolvedValue(false),
      promptInput: vi.fn(),
    };
    await expect(confirmAccountDeletion(false, deps)).rejects.toBeInstanceOf(AbortedError);
    expect(deps.promptInput).not.toHaveBeenCalled();
  });

  it('throws AbortedError when the typed confirmation is not exactly DELETE', async () => {
    const deps = {
      confirm: vi.fn().mockResolvedValue(true),
      promptInput: vi.fn().mockResolvedValue('delete'),
    };
    await expect(confirmAccountDeletion(false, deps)).rejects.toBeInstanceOf(AbortedError);
  });

  it('resolves when confirmed and DELETE is typed exactly', async () => {
    const deps = {
      confirm: vi.fn().mockResolvedValue(true),
      promptInput: vi.fn().mockResolvedValue('DELETE'),
    };
    await expect(confirmAccountDeletion(false, deps)).resolves.toBeUndefined();
    expect(deps.confirm).toHaveBeenCalledOnce();
    expect(deps.promptInput).toHaveBeenCalledOnce();
  });
});

describe('account delete --yes (CLI)', () => {
  it('calls DELETE /user with the stored key and clears the apiKey from config', async () => {
    const config = await loadConfig();
    config.apiKey = 'tok_delete_me';
    config.email = 'me@example.com';
    await saveConfig(config);

    const fetchMock = vi.fn().mockResolvedValue(
      envelopeResponse({ statusCode: 200, errorMessage: null, data: null, message: 'Account deleted' }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await createCli().parseAsync(['account', 'delete', '--yes'], { from: 'user' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/user');
    expect(init.method).toBe('DELETE');
    expect(init.headers.Authorization).toBe('Bearer tok_delete_me');

    const reloaded = await loadConfig();
    expect(reloaded.apiKey).toBe('');
    expect(reloaded.email).toBe('');
    logSpy.mockRestore();
  });

  it('propagates API errors without clearing the config', async () => {
    const config = await loadConfig();
    config.apiKey = 'tok_keep';
    await saveConfig(config);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        envelopeResponse({ statusCode: 401, errorMessage: 'Unauthenticated', data: null, message: null }),
      ),
    );

    await expect(
      createCli().parseAsync(['account', 'delete', '--yes'], { from: 'user' }),
    ).rejects.toThrow();

    const reloaded = await loadConfig();
    expect(reloaded.apiKey).toBe('tok_keep');
  });
});
