#!/usr/bin/env node

import { createCli } from './cli.js';
import { CliError, EXIT_CODES } from './utils/errors.js';
import { logger } from './utils/logger.js';

process.on('SIGINT', () => {
  console.log('\n');
  process.exit(130);
});

const program = createCli();

program.parseAsync(process.argv).catch((error: unknown) => {
  if (error instanceof CliError) {
    if (error.exitCode === EXIT_CODES.OK) {
      // e.g. user aborted a confirmation — informational, not a failure
      logger.info(error.message);
      process.exit(0);
    }
    logger.error(error.message);
    process.exit(error.exitCode);
  }

  const message = error instanceof Error ? error.message : String(error);
  logger.error(message);
  process.exit(EXIT_CODES.GENERIC);
});
