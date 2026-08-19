import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { maskApiKey, performLogin, performLogout } from '../src/commands/auth.js';
import { assertValidConfigKey } from '../src/commands/config.js';
import { createCli } from '../src/cli.js';
import { loadConfig, saveConfig, getConfigValue } from '../src/utils/config.js';
import { AuthError, ValidationError } from '../src/utils/errors.js';

let tmpDir: string;

function envelopeResponse(envelope: unknown): Response {
  return new Response(JSON.stringify(envelope), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clipugc-auth-test-'));
  process.env.CLIPUGC_CONFIG_PATH = path.join(tmpDir, 'config.json');
  delete process.env.CLIPUGC_API_KEY;
  delete process.env.CLIPUGC_API_BASE_URL;
});

afterEach(async () => {
  delete process.env.CLIPUGC_CONFIG_PATH;
  vi.unstubAllGlobals();
  await fs.remove(tmpDir);
});

describe('maskApiKey', () => {
  it('shows the first 4 chars followed by an ellipsis', () => {
    expect(maskApiKey('tok_abcdef123')).toBe('tok_…');
  });

  it('returns empty string for an empty key', () => {
    expect(maskApiKey('')).toBe('');
  });
});

describe('performLogin', () => {
  it('validates the key against GET /user and saves apiKey + email to config', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      envelopeResponse({
        statusCode: 200,
        errorMessage: null,
        data: { id: 1, email: 'me@example.com', name: 'Mirze' },
        message: null,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const user = await performLogin('tok_valid123');

    expect(user.email).toBe('me@example.com');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/user');
    expect(init.headers.Authorization).toBe('Bearer tok_valid123');

    const config = await loadConfig();
    expect(config.apiKey).toBe('tok_valid123');
    expect(config.email).toBe('me@example.com');
  });

  it('throws AuthError with an invalid-key message on 401 and leaves config unchanged', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        envelopeResponse({ statusCode: 401, errorMessage: 'Unauthenticated', data: null, message: null }),
      ),
    );

    await expect(performLogin('tok_bad')).rejects.toSatisfy(
      (error: unknown) => error instanceof AuthError && /invalid/i.test((error as AuthError).message),
    );

    const config = await loadConfig();
    expect(config.apiKey).toBe('');
  });

  it('throws ValidationError when the key is empty (no network call)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(performLogin('')).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('performLogout', () => {
  it('clears apiKey and email and is idempotent', async () => {
    const config = await loadConfig();
    config.apiKey = 'tok_x';
    config.email = 'me@example.com';
    await saveConfig(config);

    await performLogout();
    let reloaded = await loadConfig();
    expect(reloaded.apiKey).toBe('');
    expect(reloaded.email).toBe('');

    // Second logout with nothing stored must not fail
    await performLogout();
    reloaded = await loadConfig();
    expect(reloaded.apiKey).toBe('');
  });
});

describe('config command validation', () => {
  it('assertValidConfigKey accepts known keys', () => {
    expect(() => assertValidConfigKey('apiKey')).not.toThrow();
    expect(() => assertValidConfigKey('apiBaseUrl')).not.toThrow();
    expect(() => assertValidConfigKey('email')).not.toThrow();
  });

  it('assertValidConfigKey throws ValidationError listing valid keys', () => {
    try {
      assertValidConfigKey('nope');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).message).toContain('apiBaseUrl');
      expect((error as ValidationError).message).toContain('apiKey');
    }
  });

  it('`config set` with an invalid key rejects with ValidationError via the CLI', async () => {
    const program = createCli();
    await expect(
      program.parseAsync(['config', 'set', 'bogusKey', 'x'], { from: 'user' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('`config set` + `config get` round-trip through the CLI', async () => {
    await createCli().parseAsync(['config', 'set', 'apiBaseUrl', 'http://localhost:8080/api/v1'], {
      from: 'user',
    });
    expect(await getConfigValue('apiBaseUrl')).toBe('http://localhost:8080/api/v1');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await createCli().parseAsync(['config', 'get', 'apiBaseUrl'], { from: 'user' });
    const printed = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(printed).toContain('http://localhost:8080/api/v1');
    logSpy.mockRestore();
  });
});
