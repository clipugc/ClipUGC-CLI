import chalk from 'chalk';

export const logger = {
  success(message: string): void {
    console.log(chalk.green('✔ ') + message);
  },

  info(message: string): void {
    console.log(chalk.gray('- ') + message);
  },

  warn(message: string): void {
    console.log(chalk.yellow('! ') + message);
  },

  error(message: string): void {
    console.error(chalk.red('✖ ') + message);
  },

  plain(message: string): void {
    console.log(message);
  },

  /** Dim helper hint, e.g. next-command suggestions. */
  hint(message: string): void {
    console.log(chalk.dim(message));
  },

  /** Key/value detail line used in `show` commands. */
  kv(key: string, value: string | number | boolean | null | undefined): void {
    const v = value === null || value === undefined || value === '' ? chalk.dim('—') : String(value);
    console.log(`  ${chalk.cyan(key.padEnd(18))} ${v}`);
  },
};
