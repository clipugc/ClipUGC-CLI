import type { Command } from 'commander';
import chalk from 'chalk';
import { createApiClient } from '../services/api.js';
import { suggestHooks } from '../services/hooks.service.js';
import { isJsonMode, printJson } from '../utils/output.js';
import { logger } from '../utils/logger.js';

export function registerHooksCommands(program: Command): void {
  const hooks = program
    .command('hooks')
    .description('AI-generated hook text ideas for your UGC videos');

  hooks
    .command('suggest')
    .description('Suggest hook texts (short attention-grabbing overlays) for your app')
    .option('--context <text>', 'Describe your app for tailored hooks, e.g. "my app is a habit tracker"')
    .action(async (opts: { context?: string }, cmd: Command) => {
      const json = isJsonMode(cmd);
      const api = await createApiClient();
      const { hooks: suggestions, raw } = await suggestHooks(api, opts.context);
      if (json) {
        printJson(raw);
        return;
      }
      if (suggestions.length === 0) {
        logger.info('No hook suggestions returned. Try again with --context "describe your app".');
        return;
      }
      for (const [index, hook] of suggestions.entries()) {
        logger.plain(`${chalk.cyan(String(index + 1).padStart(2))}. ${hook}`);
      }
      logger.hint('Use one with `clipugc videos merge <videoId> --app-video <file> --hook "..."`');
    });
}
