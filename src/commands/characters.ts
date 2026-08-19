import type { Command } from 'commander';
import { logger } from '../utils/logger.js';
import { isJsonMode, printJson, printTable, printPagination, formatStatus } from '../utils/output.js';
import type { Column } from '../utils/output.js';
import { confirm } from '../utils/prompt.js';
import { AbortedError, ValidationError } from '../utils/errors.js';
import { waitForCompletion } from '../utils/poll.js';
import { checkImageStatus } from '../services/images.service.js';
import {
  MAX_PER_PAGE,
  createCharacter,
  deleteCharacter,
  getCharacter,
  getDisplayName,
  getSelectedLookId,
  listCharacters,
  parseDnaJson,
  renameCharacter,
  setCharacterVisibility,
} from '../services/characters.service.js';
import type { AiCharacter } from '../services/characters.service.js';

/** "Character created: Isabel Romero, 26 (id: 6)" — name/age fall back gracefully. */
function characterHeadline(c: AiCharacter): string {
  const name = getDisplayName(c);
  const age = typeof c.age === 'number' ? String(c.age) : undefined;
  const label = [name, age].filter(Boolean).join(', ');
  return `Character created: ${label} (id: ${c.id})`;
}

/** The staged first clip returned by create with --make-video, when present. */
function stagedVideo(c: AiCharacter): { id: number | string; status?: string } | undefined {
  const video = c.character_video;
  return video && typeof video === 'object' && video.id !== undefined ? video : undefined;
}

/** Print the staged first clip's id + status with a follow-up hint. */
function printStagedVideo(video: { id: number | string; status?: string }): void {
  logger.info(`First clip queued (video id: ${video.id}, status: ${formatStatus(String(video.status ?? 'pending'))}).`);
  logger.hint(`Follow it with \`clipugc videos status ${video.id}\` (or download it once completed).`);
}

function parseIntStrict(value: string, label: string): number {
  const n = Number(value);
  if (!Number.isInteger(n)) {
    throw new ValidationError(`${label} must be an integer (got "${value}").`);
  }
  return n;
}

function yesNo(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return value ? 'yes' : 'no';
}

/** Register the `clipugc characters` command group (AI characters CRUD). */
export function registerCharactersCommands(program: Command): void {
  const characters = program
    .command('characters')
    .description('Manage AI characters (create, list, publish, delete)');

  characters
    .command('list')
    .description('List AI characters (your own by default, or the public discover feed)')
    .option('--discover', 'Browse public characters instead of your own')
    .option('--mine', 'List your own characters (default)')
    .option('--feed', 'Combined feed: your characters first (newest), then public ones in unlock order')
    .option('--search <q>', 'Search by name')
    .option('--page <n>', 'Page number')
    .option('--per-page <n>', `Results per page (max ${MAX_PER_PAGE})`)
    .action(async (options, cmd: Command) => {
      const json = isJsonMode(cmd);
      let scope: 'mine' | 'discover' | 'feed' = 'mine';
      if (options.discover && !options.mine) scope = 'discover';
      else if (options.feed && !options.mine) scope = 'feed';

      let perPage = options.perPage !== undefined ? parseIntStrict(options.perPage, '--per-page') : undefined;
      if (perPage !== undefined && perPage > MAX_PER_PAGE) {
        if (!json) logger.warn(`--per-page is capped at ${MAX_PER_PAGE}; using ${MAX_PER_PAGE}.`);
        perPage = MAX_PER_PAGE;
      }
      const page = options.page !== undefined ? parseIntStrict(options.page, '--page') : undefined;

      const result = await listCharacters({ scope, search: options.search, page, perPage });

      if (json) {
        printJson(result.raw);
        return;
      }

      const columns: Column<AiCharacter>[] = [
        { header: 'ID', value: (c) => c.id },
        { header: 'Name', value: (c) => getDisplayName(c) },
        { header: 'Age', value: (c) => c.age },
        { header: 'Gender', value: (c) => c.gender },
        { header: 'Public', value: (c) => yesNo(c.is_public) },
      ];
      if (result.items.some((c) => c.is_locked !== undefined && c.is_locked !== null)) {
        columns.push({ header: 'Locked', value: (c) => yesNo(c.is_locked) });
      }
      if (result.items.some((c) => c.status !== undefined && c.status !== null)) {
        columns.push({ header: 'Status', value: (c) => (c.status ? formatStatus(String(c.status)) : undefined) });
      }
      if (result.items.some((c) => getSelectedLookId(c) !== undefined)) {
        columns.push({ header: 'Selected Look', value: (c) => getSelectedLookId(c) });
      }

      printTable(result.items, columns);
      printPagination(result.pagination);
    });

  characters
    .command('create')
    .description('Create a new AI character from a text description (the first look is generated automatically, 2 credits)')
    .option('--description <text>', 'Describe your character in plain words, 10-1000 chars (e.g. "playful italian street musician woman in her 20s")')
    .option('--scene <text>', 'Optional scene/pose for the first look, up to 600 chars')
    .option('--inspiration <files...>', 'Optional inspiration images (up to 6 files)')
    .option('--private', 'Keep the character private (default: public/discoverable, like the web)')
    .option('--make-video', 'Also stage the character\'s first video clip right after the first look')
    .option('--motion-prompt <text>', 'Motion/action prompt for that first clip (requires --make-video)')
    .option('--wait', 'Wait for the first look to finish generating')
    // Advanced: raw structured DNA instead of a description (rarely needed).
    .option('--name <full name>', '[advanced] Full name (2-120 chars) — structured create without a description')
    .option('--age <n>', '[advanced] Age (18-99)')
    .option('--gender <gender>', '[advanced] Gender (e.g. male, female, other)')
    .option('--dna-json <file-or-json>', '[advanced] Appearance DNA fields: inline JSON object or a JSON file path')
    .action(async (options, cmd: Command) => {
      const json = isJsonMode(cmd);

      if (!options.description && !options.name) {
        throw new ValidationError(
          'Describe your character with --description "…" (or use the advanced --name/--dna-json structured path).',
        );
      }

      const dna = options.dnaJson !== undefined ? await parseDnaJson(options.dnaJson) : undefined;
      const age = options.age !== undefined ? parseIntStrict(options.age, '--age') : undefined;

      const character = await createCharacter({
        description: options.description,
        scene: options.scene,
        inspirationFiles: options.inspiration,
        name: options.name,
        age,
        gender: options.gender,
        // Web parity: public by default; --private opts out. (Structured path keeps
        // the server default unless --private is passed.)
        isPublic: options.description ? !options.private : options.private ? false : undefined,
        dna,
        makeVideo: options.makeVideo,
        motionPrompt: options.motionPrompt,
      });

      const rawLooks = (character as { reference_images?: unknown }).reference_images;
      const looks = Array.isArray(rawLooks)
        ? (rawLooks as Array<{ id?: number | string; status?: string }>)
        : [];
      const firstLook = looks[0];
      const firstClip = stagedVideo(character);

      if (options.wait && firstLook?.id !== undefined) {
        const final = await waitForCompletion(() => checkImageStatus(String(firstLook.id)), {
          label: 'first look',
          quiet: json,
        });
        // The name/age/DNA are extracted asynchronously (in the first-look job), so the
        // create response had them null — re-fetch now that the look is done.
        const resolved = await getCharacter(String(character.id)).catch(() => character);
        if (json) {
          printJson({ ...resolved, reference_images: [final] });
          return;
        }
        logger.success(characterHeadline(resolved));
        const clip = stagedVideo(resolved) ?? firstClip;
        if (clip) {
          printStagedVideo(clip);
        } else {
          logger.hint(`Make a video: clipugc videos create --image ${firstLook.id} --wait`);
        }
        return;
      }

      if (json) {
        printJson(character);
        return;
      }

      logger.success(`Character created (id: ${character.id})`);
      if (firstLook?.id !== undefined && !options.wait) {
        logger.info('First look is generating; its name & appearance fill in when it finishes.');
        logger.hint(`Check it with: clipugc images status ${firstLook.id} --wait`);
      } else if (firstLook?.id === undefined) {
        logger.hint(`Next: clipugc images generate --character ${character.id}`);
      }
      if (firstClip) printStagedVideo(firstClip);
    });

  characters
    .command('show <id>')
    .description('Show a character in detail')
    .action(async (id: string, _options, cmd: Command) => {
      const json = isJsonMode(cmd);
      const character = await getCharacter(id);

      if (json) {
        printJson(character);
        return;
      }

      for (const [key, value] of Object.entries(character)) {
        if (value === null || value === undefined || value === '') continue;
        if (key === 'preview_clip' && typeof value === 'object') {
          const clip = value as {
            clip_url?: string | null;
            url?: string | null;
            clip_thumbnail_url?: string | null;
            thumbnail_url?: string | null;
          };
          // Locked public rows now return clip_url: null but keep the thumbnail —
          // render whatever is present instead of dumping the raw object.
          const url = clip.clip_url ?? clip.url;
          const thumbnail = clip.clip_thumbnail_url ?? clip.thumbnail_url;
          if (url) logger.kv('preview_clip', url);
          if (thumbnail) logger.kv('preview_thumbnail', thumbnail);
          if (url || thumbnail) continue;
        }
        if (typeof value === 'object') {
          logger.kv(key, JSON.stringify(value));
        } else if (key === 'status') {
          logger.kv(key, formatStatus(String(value)));
        } else {
          logger.kv(key, String(value));
        }
      }
    });

  characters
    .command('rename <id>')
    .description('Rename a character')
    .requiredOption('--name <new name>', 'New full name (2-120 characters)')
    .action(async (id: string, options, cmd: Command) => {
      const json = isJsonMode(cmd);
      const character = await renameCharacter(id, options.name);
      if (json) {
        printJson(character);
        return;
      }
      logger.success(`Character ${id} renamed to "${character.display_name ?? character.full_name ?? options.name}".`);
    });

  characters
    .command('publish <id>')
    .description('Make a character public (discoverable by others)')
    .action(async (id: string, _options, cmd: Command) => {
      const json = isJsonMode(cmd);
      const character = await setCharacterVisibility(id, true);
      if (json) {
        printJson(character);
        return;
      }
      logger.success(`Character ${id} is now public.`);
    });

  characters
    .command('unpublish <id>')
    .description('Make a character private')
    .action(async (id: string, _options, cmd: Command) => {
      const json = isJsonMode(cmd);
      const character = await setCharacterVisibility(id, false);
      if (json) {
        printJson(character);
        return;
      }
      logger.success(`Character ${id} is now private.`);
    });

  characters
    .command('delete <id>')
    .description('Delete a character')
    .option('--yes', 'Skip the confirmation prompt')
    .action(async (id: string, options, cmd: Command) => {
      const json = isJsonMode(cmd);

      if (!options.yes) {
        const ok = await confirm(`Delete character ${id}? This cannot be undone.`);
        if (!ok) throw new AbortedError('Delete cancelled.');
      }

      const result = await deleteCharacter(id);
      if (json) {
        printJson(result ?? { deleted: true, id });
        return;
      }
      logger.success(`Character ${id} deleted.`);
    });
}
