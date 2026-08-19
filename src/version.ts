import { createRequire } from 'node:module';

/**
 * Version is single-sourced from package.json, read at runtime.
 * From dist/version.js (or src/version.ts via tsx), ../package.json is the
 * package root's package.json.
 */
const require = createRequire(import.meta.url);

export function getVersion(): string {
  const pkg = require('../package.json') as { version: string };
  return pkg.version;
}
