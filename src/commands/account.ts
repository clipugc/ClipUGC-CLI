import type { Command } from 'commander';
import { createApiClient } from '../services/api.js';
import { deleteAccount } from '../services/user.service.js';
import { loadConfig, saveConfig } from '../utils/config.js';
import { AbortedError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { isJsonMode, printJson } from '../utils/output.js';
import { confirm as confirmPrompt, promptInput } from '../utils/prompt.js';

export interface ConfirmDeps {
  confirm: (message: string) => Promise<boolean>;
  promptInput: (message: string) => Promise<string>;
}

/**
 * Double confirmation for account deletion: a yes/No confirm followed by
 * typing the exact word DELETE. Throws AbortedError when either step fails.
 * Skipped entirely when `yes` is true (for scripting via --yes).
 */
export async function confirmAccountDeletion(
  yes: boolean,
  deps: ConfirmDeps = { confirm: confirmPrompt, promptInput },
): Promise<void> {
  if (yes) return;

  const proceed = await deps.confirm(
    'This permanently deletes your ClipUGC account and all characters/videos. Continue?',
  );
  if (!proceed) {
    throw new AbortedError('Account deletion aborted.');
  }

  const typed = await deps.promptInput('Type DELETE to confirm: ');
  if (typed !== 'DELETE') {
    throw new AbortedError('Account deletion aborted (confirmation text did not match).');
  }
}

export function registerAccountCommands(program: Command): void {
  const account = program
    .command('account')
    .description('Manage your ClipUGC account');

  account
    .command('delete')
    .description('Permanently delete your ClipUGC account and all its characters and videos (irreversible)')
    .option('--yes', 'Skip both confirmation prompts (for scripting)')
    .action(async (options: { yes?: boolean }, cmd: Command) => {
      await confirmAccountDeletion(Boolean(options.yes));

      const api = await createApiClient();
      await deleteAccount(api);

      const config = await loadConfig();
      config.apiKey = '';
      config.email = '';
      await saveConfig(config);

      if (isJsonMode(cmd)) {
        printJson({ deleted: true });
        return;
      }
      logger.success('Your ClipUGC account has been deleted and the stored API key removed.');
    });
}
