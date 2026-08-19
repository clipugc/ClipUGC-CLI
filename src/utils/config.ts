import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import type { ClipUgcConfig } from '../types/index.js';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'clipugc');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export const DEFAULT_API_BASE_URL = 'https://clipugc.com/api/v1';

const DEFAULT_CONFIG: ClipUgcConfig = {
  apiBaseUrl: DEFAULT_API_BASE_URL,
  apiKey: '',
  email: '',
};

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigPath(): string {
  return process.env.CLIPUGC_CONFIG_PATH ?? CONFIG_FILE;
}

export function getDefaultConfig(): ClipUgcConfig {
  return { ...DEFAULT_CONFIG };
}

export async function loadConfig(): Promise<ClipUgcConfig> {
  try {
    const file = getConfigPath();
    if (await fs.pathExists(file)) {
      const raw = await fs.readJson(file);
      return { ...DEFAULT_CONFIG, ...raw };
    }
  } catch {
    // Corrupt or unreadable config — fall back to defaults
  }
  return { ...DEFAULT_CONFIG };
}

export async function saveConfig(config: ClipUgcConfig): Promise<void> {
  const file = getConfigPath();
  await fs.ensureDir(path.dirname(file));
  await fs.writeJson(file, config, { spaces: 2 });
}

export async function getConfigValue(key: keyof ClipUgcConfig): Promise<string> {
  const config = await loadConfig();
  return config[key];
}

export async function setConfigValue(key: keyof ClipUgcConfig, value: string): Promise<void> {
  const config = await loadConfig();
  config[key] = value;
  await saveConfig(config);
}

export function isValidConfigKey(key: string): key is keyof ClipUgcConfig {
  return key in DEFAULT_CONFIG;
}

export function getConfigKeys(): (keyof ClipUgcConfig)[] {
  return Object.keys(DEFAULT_CONFIG) as (keyof ClipUgcConfig)[];
}

/**
 * Resolve the effective API key: env var CLIPUGC_API_KEY wins, else config file.
 * Returns empty string when not set.
 */
export async function resolveApiKey(): Promise<string> {
  return process.env.CLIPUGC_API_KEY || (await loadConfig()).apiKey || '';
}

/** Resolve the effective API base URL: env CLIPUGC_API_BASE_URL wins, else config. */
export async function resolveApiBaseUrl(): Promise<string> {
  return process.env.CLIPUGC_API_BASE_URL || (await loadConfig()).apiBaseUrl || DEFAULT_API_BASE_URL;
}
