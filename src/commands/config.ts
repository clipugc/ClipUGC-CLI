import type { Command } from 'commander';
import type { ClipUgcConfig } from '../types/index.js';
import {
  getConfigKeys,
  getConfigPath,
  getConfigValue,
  isValidConfigKey,
  loadConfig,
  setConfigValue,
} from '../utils/config.js';
import { ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { isJsonMode, printJson } from '../utils/output.js';
import { maskApiKey } from './auth.js';

/** Validate a config key or throw a ValidationError listing the valid keys. */
export function assertValidConfigKey(key: string): asserts key is keyof ClipUgcConfig {
  if (!isValidConfigKey(key)) {
    throw new ValidationError(`Unknown config key "${key}". Valid keys: ${getConfigKeys().join(', ')}`);
  }
}

/** Mask secret values (apiKey) for display; other values pass through. */
function displayValue(key: keyof ClipUgcConfig, value: string): string {
  return key === 'apiKey' ? maskApiKey(value) : value;
}

export function registerConfigCommands(program: Command): void {
  const config = program
    .command('config')
    .description(`Manage CLI configuration (keys: ${getConfigKeys().join(', ')})`);

  config
    .command('list')
    .description('Show all configuration values (apiKey is masked)')
    .action(async (_options: Record<string, never>, cmd: Command) => {
      const values = await loadConfig();
      const masked = Object.fromEntries(
        getConfigKeys().map((key) => [key, displayValue(key, values[key])]),
      );
      if (isJsonMode(cmd)) {
        printJson(masked);
        return;
      }
      for (const key of getConfigKeys()) {
        logger.kv(key, masked[key]);
      }
    });

  config
    .command('get <key>')
    .description(`Print a single configuration value (keys: ${getConfigKeys().join(', ')})`)
    .action(async (key: string, _options: Record<string, never>, cmd: Command) => {
      assertValidConfigKey(key);
      const value = await getConfigValue(key);
      if (isJsonMode(cmd)) {
        printJson({ key, value });
        return;
      }
      logger.plain(value);
    });

  config
    .command('set <key> <value>')
    .description(`Set a configuration value (keys: ${getConfigKeys().join(', ')})`)
    .action(async (key: string, value: string, _options: Record<string, never>, cmd: Command) => {
      assertValidConfigKey(key);
      await setConfigValue(key, value);
      if (isJsonMode(cmd)) {
        printJson({ key, value: displayValue(key, value) });
        return;
      }
      logger.success(`Set ${key} = ${displayValue(key, value)}`);
    });

  config
    .command('path')
    .description('Print the path of the config file')
    .action(async (_options: Record<string, never>, cmd: Command) => {
      if (isJsonMode(cmd)) {
        printJson({ path: getConfigPath() });
        return;
      }
      logger.plain(getConfigPath());
    });
}
