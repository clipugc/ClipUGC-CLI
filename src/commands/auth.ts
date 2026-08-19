import type { Command } from 'commander';
import { createApiClient } from '../services/api.js';
import { getUser, type UserProfile } from '../services/user.service.js';
import { getConfigPath, loadConfig, resolveApiBaseUrl, resolveApiKey, saveConfig } from '../utils/config.js';
import { AuthError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { isJsonMode, printJson } from '../utils/output.js';
import { promptSecret } from '../utils/prompt.js';

const DASHBOARD_URL = 'https://clipugc.com/dashboard';

/** Mask an API key for display: first 4 chars + ellipsis. */
export function maskApiKey(apiKey: string): string {
  if (!apiKey) return '';
  return `${apiKey.slice(0, 4)}…`;
}

/**
 * Validate an API key against GET /user and persist apiKey + email in config.
 * Throws AuthError (with a key-specific message) when the key is rejected.
 */
export async function performLogin(apiKey: string): Promise<UserProfile> {
  if (!apiKey) {
    throw new ValidationError(`No API key provided. Create one in your ClipUGC dashboard at ${DASHBOARD_URL}.`);
  }

  const api = await createApiClient({ apiKey });

  let user: UserProfile;
  try {
    user = await getUser(api);
  } catch (error) {
    if (error instanceof AuthError) {
      throw new AuthError(
        `That API key is invalid or has been revoked. Create a new one in your ClipUGC dashboard at ${DASHBOARD_URL} and try again.`,
      );
    }
    throw error;
  }

  const config = await loadConfig();
  config.apiKey = apiKey;
  config.email = typeof user.email === 'string' ? user.email : '';
  await saveConfig(config);

  return user;
}

/** Remove the stored apiKey + email from the config file. Idempotent. */
export async function performLogout(): Promise<void> {
  const config = await loadConfig();
  config.apiKey = '';
  config.email = '';
  await saveConfig(config);
}

/** Print a user profile as key/value lines, skipping null/empty fields. */
export function printUserProfile(user: UserProfile): void {
  for (const [key, value] of Object.entries(user)) {
    if (value === null || value === undefined || value === '') continue;
    const rendered = typeof value === 'object' ? JSON.stringify(value) : String(value);
    logger.kv(key, rendered);
  }
}

export function registerAuthCommands(program: Command): void {
  const auth = program
    .command('auth')
    .description('Log in and out of ClipUGC and inspect authentication status');

  auth
    .command('login')
    .description(`Log in with an API key (create one in your ClipUGC dashboard at ${DASHBOARD_URL})`)
    .option('--api-key <key>', 'API key from your ClipUGC dashboard (prompted securely if omitted)')
    .action(async (options: { apiKey?: string }, cmd: Command) => {
      const json = isJsonMode(cmd);

      let apiKey = options.apiKey;
      if (!apiKey) {
        if (!json) {
          logger.info(`Create an API key in the ClipUGC dashboard at ${DASHBOARD_URL}`);
        }
        apiKey = await promptSecret('API key: ');
      }

      const user = await performLogin(apiKey);
      const email = typeof user.email === 'string' && user.email ? user.email : null;

      if (json) {
        printJson({ authenticated: true, email });
        return;
      }
      logger.success(`Logged in as ${email ?? 'unknown user'}`);
      logger.hint('Try: clipugc characters list');
    });

  auth
    .command('status')
    .description('Show the config file, API base URL, and whether the stored API key is valid')
    .action(async (_options: Record<string, never>, cmd: Command) => {
      const json = isJsonMode(cmd);
      const config = await loadConfig();
      const apiBaseUrl = await resolveApiBaseUrl();
      const apiKey = await resolveApiKey();

      if (!apiKey) {
        if (json) {
          printJson({ authenticated: false, email: null, apiBaseUrl });
          return;
        }
        logger.kv('Config file', getConfigPath());
        logger.kv('API base URL', apiBaseUrl);
        logger.kv('API key', null);
        logger.info('Not logged in. Run `clipugc auth login`.');
        return;
      }

      let authenticated = false;
      let email: string | null = config.email || null;
      try {
        const api = await createApiClient({ apiKey });
        const user = await getUser(api);
        authenticated = true;
        if (typeof user.email === 'string' && user.email) email = user.email;
      } catch (error) {
        if (!(error instanceof AuthError)) throw error;
      }

      if (json) {
        printJson({ authenticated, email: authenticated ? email : null, apiBaseUrl });
        return;
      }

      logger.kv('Config file', getConfigPath());
      logger.kv('API base URL', apiBaseUrl);
      logger.kv('API key', maskApiKey(apiKey));
      if (authenticated) {
        logger.success(`authenticated as ${email ?? 'unknown user'}`);
      } else {
        logger.warn('key invalid — run `clipugc auth login` with a fresh key');
      }
    });

  auth
    .command('logout')
    .description('Remove the stored API key from the config file')
    .action(async (_options: Record<string, never>, cmd: Command) => {
      await performLogout();
      if (isJsonMode(cmd)) {
        printJson({ loggedOut: true });
        return;
      }
      logger.success(`Logged out. API key removed from ${getConfigPath()}`);
    });

  program
    .command('whoami')
    .description('Show the profile of the authenticated user')
    .action(async (_options: Record<string, never>, cmd: Command) => {
      const api = await createApiClient();
      const user = await getUser(api);
      if (isJsonMode(cmd)) {
        printJson(user);
        return;
      }
      printUserProfile(user);
    });
}
