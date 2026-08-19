import type { Command } from 'commander';
import { logger } from '../utils/logger.js';
import { isJsonMode, printJson, printTable, formatStatus } from '../utils/output.js';
import type { Column } from '../utils/output.js';
import { confirm } from '../utils/prompt.js';
import { AbortedError, ValidationError } from '../utils/errors.js';
import { waitForCompletion } from '../utils/poll.js';
import {
  DEFAULT_RESOLUTION,
  RESOLUTIONS,
  SHOT_TYPES,
  TEMPLATES,
  checkImageStatus,
  createVariation,
  deleteImage,
  downloadImage,
  findImageUrl,
  generateImages,
  getImage,
  listImages,
  retryImage,
} from '../services/images.service.js';
import type { CharacterImage, ImageStatusCheck } from '../services/images.service.js';

function parseIntStrict(value: string, label: string): number {
  const n = Number(value);
  if (!Number.isInteger(n)) {
    throw new ValidationError(`${label} must be an integer (got "${value}").`);
  }
  return n;
}

/** Poll a set of image ids until each completes; returns the final payloads. */
async function waitForImages(images: CharacterImage[], quiet: boolean): Promise<ImageStatusCheck[]> {
  const finals: ImageStatusCheck[] = [];
  for (const image of images) {
    const final = await waitForCompletion(() => checkImageStatus(String(image.id)), {
      label: `Generating look ${image.id}`,
      quiet,
    });
    finals.push(final);
  }
  return finals;
}

function printFinalStatuses(images: CharacterImage[], finals: ImageStatusCheck[]): void {
  finals.forEach((final, i) => {
    const id = images[i]?.id;
    const url = findImageUrl(final);
    logger.kv(`Look ${id}`, formatStatus(String(final.status)) + (url ? `  ${url}` : ''));
  });
}

/** Register the `clipugc images` command group (character looks). */
export function registerImagesCommands(program: Command): void {
  const images = program
    .command('images')
    .description('Manage character looks (reference images)');

  images
    .command('generate')
    .description('Generate look(s) for a character')
    .requiredOption('--character <id>', 'Character id')
    .option('--shots <list>', `Comma-separated shot types: ${SHOT_TYPES.join(', ')}`, 'frontal')
    .option('--template <template>', `Template: ${TEMPLATES.join(', ')}`)
    .option('--scene <prompt>', 'Scene prompt (max 600 characters)')
    .option('--resolution <res>', `Resolution: ${RESOLUTIONS.join(', ')}`, DEFAULT_RESOLUTION)
    .option('--wait', 'Poll until generation completes')
    .action(async (options, cmd: Command) => {
      const json = isJsonMode(cmd);

      const { raw, images: created } = await generateImages(options.character, {
        shots: options.shots,
        template: options.template,
        scene: options.scene,
        resolution: options.resolution,
      });

      if (!options.wait) {
        if (json) {
          printJson(raw);
          return;
        }
        if (created.length === 0) {
          logger.success('Look generation started.');
          return;
        }
        logger.success(`Look generation started (id${created.length > 1 ? 's' : ''}: ${created.map((i) => i.id).join(', ')})`);
        logger.hint(`Check progress with: clipugc images status ${created[0].id}`);
        return;
      }

      if (created.length === 0) {
        if (json) {
          printJson(raw);
        } else {
          logger.warn('Generation started but no image ids were returned — cannot wait. Check `clipugc images list`.');
        }
        return;
      }

      const finals = await waitForImages(created, json);
      if (json) {
        printJson(finals);
        return;
      }
      printFinalStatuses(created, finals);
    });

  images
    .command('list')
    .description('List looks for a character')
    .requiredOption('--character <id>', 'Character id')
    .action(async (options, cmd: Command) => {
      const json = isJsonMode(cmd);
      const { items, raw } = await listImages(options.character);

      if (json) {
        printJson(raw);
        return;
      }

      const columns: Column<CharacterImage>[] = [
        { header: 'ID', value: (i) => i.id },
        {
          header: 'Scene',
          value: (i) => {
            const scene = typeof i.scene_prompt === 'string' ? i.scene_prompt : '';
            if (scene === '') return 'base look';
            return scene.length > 42 ? `${scene.slice(0, 39)}…` : scene;
          },
        },
        { header: 'Status', value: (i) => (i.status ? formatStatus(String(i.status)) : undefined) },
        { header: 'Created', value: (i) => i.created_at },
      ];
      printTable(items, columns);
      logger.hint('Reference a look by its ID, e.g. clipugc videos create --image <ID>');
    });

  images
    .command('show <id>')
    .description('Show a look in detail')
    .action(async (id: string, _options, cmd: Command) => {
      const json = isJsonMode(cmd);
      const image = await getImage(id);

      if (json) {
        printJson(image);
        return;
      }

      for (const [key, value] of Object.entries(image)) {
        if (value === null || value === undefined || value === '') continue;
        if (typeof value === 'object') {
          logger.kv(key, JSON.stringify(value));
        } else if (key === 'status') {
          logger.kv(key, formatStatus(String(value)));
        } else {
          logger.kv(key, String(value));
        }
      }
    });

  images
    .command('status <id>')
    .description('Check generation status of a look')
    .action(async (id: string, _options, cmd: Command) => {
      const json = isJsonMode(cmd);
      const check = await checkImageStatus(id);

      if (json) {
        printJson(check);
        return;
      }

      logger.kv('Status', formatStatus(String(check.status)));
      const url = findImageUrl(check);
      if (check.status === 'completed' && url) logger.kv('URL', url);
      const reason = check.failure_reason || check.error_message;
      if (check.status === 'failed' && reason) logger.kv('Reason', reason);
    });

  images
    .command('download <id>')
    .description('Download a look image to disk')
    .option('-o, --output <file>', 'Output file (default: clipugc-look-<id>.<ext>)')
    .action(async (id: string, options, cmd: Command) => {
      const json = isJsonMode(cmd);
      const dest = await downloadImage(id, { output: options.output, quiet: json });

      if (json) {
        printJson({ saved: dest });
        return;
      }
      logger.success(`Saved ${dest}`);
    });

  images
    .command('variation <id>')
    .description('Generate variation(s) of a look with a new scene')
    .requiredOption('--scene <prompt>', 'Scene prompt (3-600 characters)')
    .option('--count <n>', 'Number of variations (1-4)')
    .option('--before-after', 'Generate a before/after style variation')
    .option('--wait', 'Poll until the variation completes')
    .action(async (id: string, options, cmd: Command) => {
      const json = isJsonMode(cmd);
      const count = options.count !== undefined ? parseIntStrict(options.count, '--count') : undefined;

      const { raw, images: created } = await createVariation(id, {
        scene: options.scene,
        count,
        beforeAfter: options.beforeAfter ? true : undefined,
      });

      if (!options.wait) {
        if (json) {
          printJson(raw);
          return;
        }
        if (created.length === 0) {
          logger.success('Variation started.');
          return;
        }
        logger.success(`Variation started (id${created.length > 1 ? 's' : ''}: ${created.map((i) => i.id).join(', ')})`);
        logger.hint(`Check progress with: clipugc images status ${created[0].id}`);
        return;
      }

      if (created.length === 0) {
        if (json) {
          printJson(raw);
        } else {
          logger.warn('Variation started but no image ids were returned — cannot wait. Check `clipugc images list`.');
        }
        return;
      }

      const finals = await waitForImages(created, json);
      if (json) {
        printJson(finals);
        return;
      }
      printFinalStatuses(created, finals);
    });

  images
    .command('retry <id>')
    .description('Retry a failed look generation')
    .option('--wait', 'Poll until the retry completes')
    .action(async (id: string, options, cmd: Command) => {
      const json = isJsonMode(cmd);
      const result = await retryImage(id);

      if (!options.wait) {
        if (json) {
          printJson(result ?? { retried: true, id });
          return;
        }
        logger.success(`Retry started for look ${id}.`);
        logger.hint(`Check progress with: clipugc images status ${id}`);
        return;
      }

      const final = await waitForCompletion(() => checkImageStatus(id), {
        label: `Regenerating look ${id}`,
        quiet: json,
      });
      if (json) {
        printJson(final);
        return;
      }
      const url = findImageUrl(final);
      logger.kv(`Look ${id}`, formatStatus(String(final.status)) + (url ? `  ${url}` : ''));
    });

  images
    .command('delete <id>')
    .description('Delete a look')
    .option('--yes', 'Skip the confirmation prompt')
    .action(async (id: string, options, cmd: Command) => {
      const json = isJsonMode(cmd);

      if (!options.yes) {
        const ok = await confirm(`Delete look ${id}? This cannot be undone.`);
        if (!ok) throw new AbortedError('Delete cancelled.');
      }

      const result = await deleteImage(id);
      if (json) {
        printJson(result ?? { deleted: true, id });
        return;
      }
      logger.success(`Look ${id} deleted.`);
    });
}
