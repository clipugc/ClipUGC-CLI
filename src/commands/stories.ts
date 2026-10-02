import type { Command } from 'commander';
import { createApiClient } from '../services/api.js';
import {
  approveEpisode,
  createStory,
  downloadEpisode,
  draftEpisode,
  getEpisode,
  getStory,
  listStories,
  STORY_RESOLUTIONS,
  type StoryEpisode,
  type StorySeries,
} from '../services/stories.service.js';
import { formatStatus, isJsonMode, printJson, printTable } from '../utils/output.js';
import { waitForCompletion } from '../utils/poll.js';
import { ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const SERIES_COLUMNS = [
  { header: 'STORY ID', value: (s: StorySeries) => s.id },
  { header: 'Title', value: (s: StorySeries) => s.title },
  { header: 'Character', value: (s: StorySeries) => s.character?.name },
  { header: 'Episodes', value: (s: StorySeries) => s.episode_count },
  { header: 'Quality', value: (s: StorySeries) => (s.resolution === '768P' ? 'HD' : 'Standard') },
];

const EPISODE_COLUMNS = [
  { header: 'EPISODE ID', value: (e: StoryEpisode) => e.id },
  { header: '#', value: (e: StoryEpisode) => e.episode_number },
  { header: 'Title', value: (e: StoryEpisode) => e.title },
  { header: 'Status', value: (e: StoryEpisode) => formatStatus(e.status) },
  { header: 'Length', value: (e: StoryEpisode) => (e.duration_seconds ? `${e.duration_seconds}s` : undefined) },
];

function printScript(episode: StoryEpisode): void {
  logger.info('');
  logger.info(`Episode ${episode.episode_number ?? '?'}: ${episode.title ?? 'Untitled'}`);
  (episode.script ?? []).forEach((scene, index) => {
    logger.info(`  Scene ${index + 1}: ${scene.action}`);
    if (scene.dialogue) logger.info(`    She says: "${scene.dialogue}"`);
  });
  logger.info('');
}

/**
 * `clipugc stories` — ongoing episodic videos of an AI character's life. Each episode's
 * script is drafted for free and only generated after `episodes approve` (charged).
 * Every episode continues the story — and starts on the previous episode's last frame.
 */
export function registerStoriesCommands(program: Command): void {
  const stories = program
    .command('stories')
    .description("Ongoing story series: your AI character's life, one talking episode at a time");

  stories
    .command('list')
    .description('List your story series')
    .action(async (_opts: Record<string, never>, cmd: Command) => {
      const json = isJsonMode(cmd);
      const api = await createApiClient();
      const { stories: items, raw } = await listStories(api);
      if (json) return printJson(raw);
      printTable(items, SERIES_COLUMNS);
    });

  stories
    .command('create')
    .description('Start a new story series for one of your characters')
    .requiredOption('--character <id>', 'The character the story is about')
    .requiredOption('--title <title>', 'Story title')
    .requiredOption('--premise <premise>', "What her life is about (drives every episode's script)")
    .option('--tone <tone>', 'Optional tone, e.g. "dry humor, cliffhangers"')
    .option('--resolution <res>', `Video quality: ${STORY_RESOLUTIONS.join(' or ')} (default 480P)`)
    .action(async (opts: { character: string; title: string; premise: string; tone?: string; resolution?: string }, cmd: Command) => {
      const json = isJsonMode(cmd);
      const api = await createApiClient();
      const series = await createStory(api, {
        characterId: opts.character,
        title: opts.title,
        premise: opts.premise,
        tone: opts.tone,
        resolution: opts.resolution,
      });
      if (json) return printJson(series);
      logger.success(`Story ${series.id} created: ${series.title}`);
      logger.info(`Draft the first episode: clipugc stories draft ${series.id}`);
    });

  stories
    .command('show <id>')
    .description('Show a story and its episodes')
    .action(async (id: string, _opts: Record<string, never>, cmd: Command) => {
      const json = isJsonMode(cmd);
      const api = await createApiClient();
      const { story, episodes } = await getStory(api, id);
      if (json) return printJson({ story, episodes });
      printTable([story], SERIES_COLUMNS);
      if (story.story_summary) logger.info(`\nStory so far:\n${story.story_summary}\n`);
      printTable(episodes, EPISODE_COLUMNS);
    });

  stories
    .command('draft <id>')
    .description("Draft the next episode's script (free, nothing is generated yet)")
    .option('--minutes <n>', 'Episode length in minutes: 1, 2 or 5 (default 1)', (v: string) => Number.parseInt(v, 10))
    .option('--direction <text>', 'Write the plot yourself; omit to let the AI continue the story')
    .action(async (id: string, opts: { minutes?: number; direction?: string }, cmd: Command) => {
      const json = isJsonMode(cmd);
      const api = await createApiClient();
      const { episode, cost_credits } = await draftEpisode(api, id, {
        minutes: opts.minutes,
        direction: opts.direction,
      });
      if (json) return printJson({ episode, cost_credits });
      printScript(episode);
      logger.info(`Generating this episode costs ${cost_credits ?? '?'} credits.`);
      logger.info(`Approve it: clipugc stories approve ${id} ${episode.id} [--wait]`);
    });

  stories
    .command('approve <id> <episodeId>')
    .description('Approve a drafted episode: charges credits and generates it scene by scene')
    .option('--wait', 'Wait until the episode finishes rendering')
    .option('--output <path>', 'With --wait: also download the finished episode here')
    .action(async (id: string, episodeId: string, opts: { wait?: boolean; output?: string }, cmd: Command) => {
      const json = isJsonMode(cmd);
      const api = await createApiClient();
      const episode = await approveEpisode(api, id, episodeId);
      if (!opts.wait) {
        if (json) return printJson(episode);
        logger.success(`Episode ${episode.episode_number ?? episodeId} is generating.`);
        logger.info(`Check progress: clipugc stories status ${id} ${episodeId}`);
        return;
      }
      const finished = await waitForCompletion(() => getEpisode(api, id, episodeId), {
        label: `Episode ${episode.episode_number ?? episodeId}`,
        intervalMs: 10_000,
        quiet: json,
      });
      if (opts.output || !json) {
        const path = await downloadEpisode(api, id, episodeId, opts.output);
        if (!json) logger.success(`Saved to ${path}`);
      }
      if (json) printJson(finished);
    });

  stories
    .command('status <id> <episodeId>')
    .description("Check an episode's generation progress")
    .action(async (id: string, episodeId: string, _opts: Record<string, never>, cmd: Command) => {
      const json = isJsonMode(cmd);
      const api = await createApiClient();
      const episode = await getEpisode(api, id, episodeId);
      if (json) return printJson(episode);
      printTable([episode], EPISODE_COLUMNS);
      if (episode.status === 'processing') {
        logger.info(`Scenes completed: ${episode.scenes_completed ?? 0}/${episode.scene_count ?? '?'}`);
      }
      if (episode.error) logger.warn(`Error: ${episode.error}`);
    });

  stories
    .command('download <id> <episodeId>')
    .description('Download a completed episode')
    .option('--output <path>', 'Where to save the .mp4')
    .action(async (id: string, episodeId: string, opts: { output?: string }, cmd: Command) => {
      const json = isJsonMode(cmd);
      const api = await createApiClient();
      const path = await downloadEpisode(api, id, episodeId, opts.output);
      if (json) return printJson({ saved_to: path });
      logger.success(`Saved to ${path}`);
    });
}

export { ValidationError };
