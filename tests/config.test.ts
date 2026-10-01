import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import {
  loadConfig,
  saveConfig,
  setConfigValue,
  getConfigValue,
  isValidConfigKey,
  getConfigPath,
  resolveApiKey,
  resolveApiBaseUrl,
  DEFAULT_API_BASE_URL,
  LEGACY_DEFAULT_API_BASE_URL,
} from '../src/utils/config.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clipugc-test-'));
  process.env.CLIPUGC_CONFIG_PATH = path.join(tmpDir, 'config.json');
  delete process.env.CLIPUGC_API_KEY;
  delete process.env.CLIPUGC_API_BASE_URL;
});

afterEach(async () => {
  delete process.env.CLIPUGC_CONFIG_PATH;
  delete process.env.CLIPUGC_API_KEY;
  delete process.env.CLIPUGC_API_BASE_URL;
  await fs.remove(tmpDir);
});

describe('config', () => {
  it('returns defaults when no config file exists', async () => {
    const config = await loadConfig();
    expect(config.apiBaseUrl).toBe(DEFAULT_API_BASE_URL);
    expect(config.apiKey).toBe('');
  });

  it('defaults to the /api/v2 base URL', () => {
    expect(DEFAULT_API_BASE_URL).toBe('https://clipugc.com/api/v2');
  });

  it('moves a config saved with the old /api/v1 default to /api/v2', async () => {
    await fs.writeJson(getConfigPath(), { apiBaseUrl: LEGACY_DEFAULT_API_BASE_URL, apiKey: 'tok_old', email: 'me@example.com' });
    expect((await loadConfig()).apiBaseUrl).toBe(DEFAULT_API_BASE_URL);
    expect((await loadConfig()).apiKey).toBe('tok_old');

    await fs.writeJson(getConfigPath(), { apiBaseUrl: `${LEGACY_DEFAULT_API_BASE_URL}/`, apiKey: 'tok_old' });
    expect((await loadConfig()).apiBaseUrl).toBe(DEFAULT_API_BASE_URL);
  });

  it('leaves a custom base URL alone, even on /api/v1', async () => {
    await fs.writeJson(getConfigPath(), { apiBaseUrl: 'http://localhost:8090/api/v1', apiKey: '' });
    expect((await loadConfig()).apiBaseUrl).toBe('http://localhost:8090/api/v1');
  });

  it('round-trips save and load', async () => {
    const config = await loadConfig();
    config.apiKey = 'tok_abc';
    config.email = 'me@example.com';
    await saveConfig(config);

    const reloaded = await loadConfig();
    expect(reloaded.apiKey).toBe('tok_abc');
    expect(reloaded.email).toBe('me@example.com');
    expect(reloaded.apiBaseUrl).toBe(DEFAULT_API_BASE_URL);
  });

  it('set/get individual values', async () => {
    await setConfigValue('apiBaseUrl', 'http://localhost:8080/api/v1');
    expect(await getConfigValue('apiBaseUrl')).toBe('http://localhost:8080/api/v1');
  });

  it('falls back to defaults on corrupt config file', async () => {
    await fs.outputFile(getConfigPath(), '{not json');
    const config = await loadConfig();
    expect(config.apiBaseUrl).toBe(DEFAULT_API_BASE_URL);
  });

  it('validates config keys', () => {
    expect(isValidConfigKey('apiBaseUrl')).toBe(true);
    expect(isValidConfigKey('apiKey')).toBe(true);
    expect(isValidConfigKey('nope')).toBe(false);
  });

  it('env vars override config values', async () => {
    await setConfigValue('apiKey', 'from-config');
    await setConfigValue('apiBaseUrl', 'http://from-config/api/v1');
    process.env.CLIPUGC_API_KEY = 'from-env';
    process.env.CLIPUGC_API_BASE_URL = 'http://from-env/api/v1';
    expect(await resolveApiKey()).toBe('from-env');
    expect(await resolveApiBaseUrl()).toBe('http://from-env/api/v1');
  });

  it('resolves from config when env not set', async () => {
    await setConfigValue('apiKey', 'from-config');
    expect(await resolveApiKey()).toBe('from-config');
  });
});
