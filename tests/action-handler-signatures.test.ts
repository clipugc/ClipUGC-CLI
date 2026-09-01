import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Commander passes (...args, options, command) to an action handler. A command
 * declaring one argument therefore hands the OPTIONS object to a two-parameter
 * handler's second slot, not the Command. Any handler that then calls a Command
 * method crashes on every single invocation:
 *
 *   clipugc videos status 79
 *   ✖ command.optsWithGlobals is not a function
 *
 * `videos status`, `videos show` and `ads show` all shipped broken this way,
 * because the mistake type-checks: the parameter is annotated `Command` and
 * TypeScript believes it.
 *
 * So this is checked at the source level. A handler whose last parameter is
 * named `cmd` must have one more parameter than the command declares arguments.
 */
const COMMANDS_DIR = new URL('../src/commands/', import.meta.url).pathname;

/** `.command('status <id>')` → 1, `.command('list')` → 0, `<a> [b]` → 2. */
function declaredArgumentCount(commandLiteral: string): number {
  return (commandLiteral.match(/[<[][^>\]]+[>\]]/g) ?? []).length;
}

function parameterNames(paramList: string): string[] {
  if (paramList.trim() === '') {
    return [];
  }

  // Split on top-level commas only: parameter types contain commas of their own,
  // e.g. `opts: { page?: number; perPage?: number }` or `Record<string, unknown>`.
  const names: string[] = [];
  let depth = 0;
  let current = '';

  for (const char of paramList) {
    if ('({[<'.includes(char)) depth++;
    if (')}]>'.includes(char)) depth--;

    if (char === ',' && depth === 0) {
      names.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  names.push(current);

  return names.map((p) => p.trim().split(':')[0].trim()).filter(Boolean);
}

describe('commander action handler signatures', () => {
  const files = readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.ts'));

  it('finds command files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file}: every handler taking the Command has a slot for options`, () => {
      const source = readFileSync(join(COMMANDS_DIR, file), 'utf8');

      // Each `.command('<literal>')` followed (eventually) by its `.action(...)`.
      const pattern = /\.command\(\s*'([^']+)'[\s\S]*?\.action\(\s*async\s*\(([^)]*)\)/g;
      const offenders: string[] = [];

      for (const match of source.matchAll(pattern)) {
        const [, literal, paramList] = match;
        const params = parameterNames(paramList);

        if (params.at(-1) !== 'cmd') {
          continue;
        }

        const expected = declaredArgumentCount(literal) + 2; // args + options + command

        if (params.length !== expected) {
          offenders.push(
            `${literal}: handler takes (${params.join(', ')}) but commander passes ` +
              `${expected} values, so '${params.at(-1)}' receives the options object, not the Command`,
          );
        }
      }

      expect(offenders).toEqual([]);
    });
  }
});
