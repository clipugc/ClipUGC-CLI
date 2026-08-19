import { Command } from 'commander';
import { getVersion } from './version.js';
import { registerAuthCommands } from './commands/auth.js';
import { registerConfigCommands } from './commands/config.js';
import { registerCreditsCommands } from './commands/credits.js';
import { registerAccountCommands } from './commands/account.js';
import { registerCharactersCommands } from './commands/characters.js';
import { registerImagesCommands } from './commands/images.js';
import { registerAdsCommands } from './commands/ads.js';
import { registerVideosCommands } from './commands/videos.js';
import { registerHooksCommands } from './commands/hooks.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name('clipugc')
    .description(
      'ClipUGC CLI — create AI characters, generate looks, and produce UGC-style videos for your mobile app.\n' +
      'Get an API key from your dashboard at https://clipugc.com, then run `clipugc auth login`.',
    )
    .version(getVersion(), '-v, --version', 'Print the CLI version')
    .option('--json', 'Output raw JSON (for scripting)')
    .showHelpAfterError('(add --help for usage)')
    .showSuggestionAfterError(true);

  registerAuthCommands(program);
  registerConfigCommands(program);
  registerCreditsCommands(program);
  registerAccountCommands(program);
  registerCharactersCommands(program);
  registerImagesCommands(program);
  registerVideosCommands(program);
  registerAdsCommands(program);
  registerHooksCommands(program);

  return program;
}
