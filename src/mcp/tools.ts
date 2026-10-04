/**
 * MCP tool definitions for `clipugc mcp`.
 *
 * Each tool is a thin adapter over the existing service layer (src/services/*): it maps
 * MCP arguments (named after the matching CLI flags, with underscores instead of dashes)
 * onto the service call the CLI command would make, and formats the result as JSON text.
 * No HTTP happens here; the services own the endpoints.
 *
 * Long-running actions (images, clips, finished videos) return the job id right away, the same way
 * the CLI behaves without --wait. The caller polls with get_video / list_images.
 *
 * Nothing in this file may write to stdout: stdout is the MCP transport.
 */

import path from 'node:path';
import { z } from 'zod';
import { createApiClient, type ApiClient } from '../services/api.js';
import * as characters from '../services/characters.service.js';
import * as images from '../services/images.service.js';
import * as videos from '../services/videos.service.js';
import * as ads from '../services/ads.service.js';
import * as user from '../services/user.service.js';
import * as hooks from '../services/hooks.service.js';
import * as uploads from '../services/upload.service.js';
import { AuthError, CliError, InsufficientCreditsError, PremiumRequiredError } from '../utils/errors.js';

export const TOOL_NAMES = [
  'list_characters',
  'create_character',
  'generate_image',
  'list_images',
  'create_clip',
  'create_motion_clip',
  'create_scene_replace_clip',
  'merge_ad',
  'get_video',
  'download_video',
  'get_credits',
  'list_hooks',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

/** Zod raw shape: the SDK builds the JSON schema from it. */
export type ToolShape = Record<string, z.ZodType>;

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface ToolDefinition<Shape extends ToolShape = ToolShape> {
  name: ToolName;
  title: string;
  description: string;
  inputSchema: Shape;
  annotations: ToolAnnotations;
  /**
   * Returns plain data; runTool() turns it into an MCP result. Declared as a method so the
   * per-tool argument types stay bivariant and every tool fits into `readonly ToolDefinition[]`.
   */
  handler(args: z.output<z.ZodObject<Shape>>): Promise<unknown>;
}

/** MCP CallToolResult, limited to what these tools produce (the SDK type is open-ended). */
export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

const DASHBOARD_URL = 'https://clipugc.com/dashboard';

const AUTH_HELP =
  'No valid ClipUGC API key is available to the MCP server. Create an API key in the ClipUGC dashboard ' +
  `(${DASHBOARD_URL}, API Keys section, paid plans) and either run \`clipugc auth login\` in a terminal ` +
  'on this machine or set CLIPUGC_API_KEY in the MCP server environment. Then call the tool again.';

const POLL_CLIP =
  'Generation runs in the background. Poll get_video with {"id": <clip id>, "kind": "clip"} every 5 to 10 seconds ' +
  'until status is "completed" or "failed", then call download_video.';

const POLL_FINISHED =
  'The finished video renders in the background. Poll get_video with {"id": <merged_video_id>, "kind": "finished"} every 5 to 10 ' +
  'seconds until status is "completed" or "failed", then call download_video with kind "finished".';

/**
 * get_video / download_video `kind`. "finished" addresses a finished video (merged_video_id).
 * "ad" is the pre-1.3.1 name for the same thing, still accepted so existing callers keep working.
 */
const KIND_FIELD = z
  .enum(['clip', 'finished', 'ad'])
  .optional()
  .describe('"clip" (default) for a clip id, "finished" for a finished video id (merged_video_id).');

function isFinishedKind(kind: 'clip' | 'finished' | 'ad' | undefined): boolean {
  return kind === 'finished' || kind === 'ad';
}

const POLL_IMAGE =
  'Looks generate in the background. Poll list_images with the same character id every 5 to 10 seconds until each ' +
  'new look has status "completed" (or "failed"), then pass the look id to create_clip.';

function define<Shape extends ToolShape>(def: ToolDefinition<Shape>): ToolDefinition<Shape> {
  return def;
}

function parseCharacterListScope(scope: 'mine' | 'discover' | 'feed' | undefined): 'mine' | 'discover' | 'feed' {
  return scope ?? 'mine';
}

/** Resolve the --image / --photo pair the way `videos create` does (photo is uploaded first). */
async function resolveImageSource(
  api: ApiClient,
  args: { image?: string; photo?: string },
): Promise<{ characterReferenceImageId?: string; sourceImageKey?: string }> {
  const hasImage = Boolean(args.image);
  const hasPhoto = Boolean(args.photo);
  if (hasImage === hasPhoto) {
    throw new CliError(
      'Provide exactly one image source: "image" (the id of a generated character look) or "photo" (path to your own photo).',
      2,
    );
  }
  if (hasImage) return { characterReferenceImageId: args.image };
  const sourceImageKey = await uploads.uploadFile(api, 'photo', args.photo!, { quiet: true });
  return { sourceImageKey };
}

const idField = (what: string) => z.string().min(1).describe(`${what} id, as returned by other tools (numbers are fine as strings).`);

export const TOOLS: readonly ToolDefinition[] = [
  define({
    name: 'list_characters',
    title: 'List AI characters',
    description:
      'List ClipUGC AI characters (AI influencers). Same as `clipugc characters list`. scope "mine" (default) lists the ' +
      'authenticated user\'s own characters, "discover" the public feed, "feed" own characters first then public ones. ' +
      'Returns items with id, display_name, age, gender, is_public, status, plus pagination. Costs no credits.',
    inputSchema: {
      scope: z.enum(['mine', 'discover', 'feed']).optional().describe('Which list: mine (default), discover, or feed.'),
      search: z.string().optional().describe('Search by name (same as --search).'),
      page: z.number().int().min(1).optional().describe('Page number (same as --page).'),
      per_page: z.number().int().min(1).max(characters.MAX_PER_PAGE).optional().describe('Results per page, max 50 (same as --per-page).'),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
    handler: async (args) => {
      const result = await characters.listCharacters({
        scope: parseCharacterListScope(args.scope),
        search: args.search,
        page: args.page,
        perPage: args.per_page,
      });
      return { items: result.items, pagination: result.pagination ?? null };
    },
  }),

  define({
    name: 'create_character',
    title: 'Create an AI character',
    description:
      'Create a new AI character from a plain-text description. Same as `clipugc characters create`. The server extracts ' +
      'the appearance DNA and generates the first look automatically (2 credits; confirm with get_credits). Be specific: ' +
      'nationality, age, hair, eyes, face shape, skin, style, and a realism anchor such as "natural skin texture, not airbrushed". ' +
      'Characters are public by default; set private=true to opt out. make_video=true also stages the first clip (extra clip cost). ' +
      'Returns the character with first_look_id. ' + POLL_IMAGE + ' Advanced: pass name (2-120 chars) plus optional age, gender, dna_json ' +
      'instead of description for a structured create.',
    inputSchema: {
      description: z.string().min(characters.DESCRIPTION_MIN).max(characters.DESCRIPTION_MAX).optional()
        .describe('Plain-words description of the person, 10-1000 chars (same as --description). Preferred path.'),
      scene: z.string().max(characters.CREATE_SCENE_MAX).optional()
        .describe('Optional scene/pose for the first look, up to 600 chars (same as --scene).'),
      inspiration: z.array(z.string()).max(characters.INSPIRATION_MAX).optional()
        .describe('Optional local file paths of up to 6 inspiration images (same as --inspiration).'),
      private: z.boolean().optional().describe('Keep the character private (same as --private). Default: public.'),
      make_video: z.boolean().optional().describe('Also stage the character\'s first video clip (same as --make-video).'),
      motion_prompt: z.string().optional().describe('Motion prompt for that first clip; requires make_video (same as --motion-prompt).'),
      name: z.string().optional().describe('[advanced] Full name, 2-120 chars, for the structured path without a description (same as --name).'),
      age: z.number().int().min(characters.AGE_MIN).max(characters.AGE_MAX).optional().describe('[advanced] Age 18-99 (same as --age).'),
      gender: z.string().optional().describe('[advanced] Gender, e.g. male, female, other (same as --gender).'),
      dna_json: z.string().optional().describe('[advanced] Appearance DNA fields as an inline JSON object string or a JSON file path (same as --dna-json).'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    handler: async (args) => {
      if (!args.description && !args.name) {
        throw new CliError('Provide "description" (preferred) or the advanced "name" field.', 2);
      }
      const dna = args.dna_json !== undefined ? await characters.parseDnaJson(args.dna_json) : undefined;
      const character = await characters.createCharacter({
        description: args.description,
        scene: args.scene,
        inspirationFiles: args.inspiration,
        name: args.name,
        age: args.age,
        gender: args.gender,
        // Same rule as the CLI: description path is public unless private; structured path keeps the server default.
        isPublic: args.description ? !args.private : args.private ? false : undefined,
        dna,
        makeVideo: args.make_video,
        motionPrompt: args.motion_prompt,
      });
      const looks = Array.isArray(character.reference_images)
        ? (character.reference_images as Array<{ id?: number | string }>)
        : [];
      const firstLookId = looks[0]?.id ?? null;
      const firstClipId = character.character_video?.id ?? null;
      return {
        character,
        first_look_id: firstLookId,
        first_clip_id: firstClipId,
        next: firstLookId !== null
          ? `Poll list_images with character "${character.id}" until look ${firstLookId} is completed. ` +
            (firstClipId !== null ? `The staged first clip is ${firstClipId}; poll it with get_video.` : 'Then create_clip with that look id.')
          : `Generate a look with generate_image for character "${character.id}".`,
      };
    },
  }),

  define({
    name: 'generate_image',
    title: 'Generate character looks',
    description:
      'Generate one or more new looks (reference images) of an existing character. Same as `clipugc images generate`. ' +
      'Every look is generated from the character\'s base image, so the face stays the same person: only describe the new ' +
      'setting, outfit and light in scene, never the person again. Costs 2 credits per shot (confirm with get_credits). ' +
      'Returns the created image ids. ' + POLL_IMAGE,
    inputSchema: {
      character: idField('Character'),
      shots: z.string().optional()
        .describe(`Comma-separated shot types: ${images.SHOT_TYPES.join(', ')} (same as --shots). Default "frontal".`),
      template: z.enum(images.TEMPLATES).optional()
        .describe('Template (same as --template). Omit to let the server pick: scene_recreation when scene is set, else model_digitals.'),
      scene: z.string().max(images.SCENE_MAX).optional().describe('Scene prompt, max 600 chars (same as --scene).'),
      resolution: z.enum(images.RESOLUTIONS).optional().describe('Resolution (same as --resolution). Default 2K.'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    handler: async (args) => {
      const result = await images.generateImages(args.character, {
        shots: args.shots,
        template: args.template,
        scene: args.scene,
        resolution: args.resolution,
      });
      return {
        images: result.images.map((img) => ({ id: img.id, status: img.status ?? 'pending' })),
        next: POLL_IMAGE,
      };
    },
  }),

  define({
    name: 'list_images',
    title: 'List character looks',
    description:
      'List the looks (reference images) of a character with id, status (pending, processing, completed, failed), scene_prompt ' +
      'and image url when ready. Same as `clipugc images list --character <id>`. Also the poll call for generate_image and ' +
      'create_character. Costs no credits.',
    inputSchema: {
      character: idField('Character'),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
    handler: async (args) => {
      const result = await images.listImages(args.character);
      return { items: result.items };
    },
  }),

  define({
    name: 'create_clip',
    title: 'Create a video clip from a look',
    description:
      'Animate a character look (or your own photo) into a short video clip. Same as `clipugc videos create`. ' +
      'Costs 7 credits for 5 seconds or 13 for 10 seconds; adding scene makes it a scene-staged clip (9 at 5s, 15 at 10s). ' +
      'Confirm with get_credits first. Prefer a silent reaction prompt (mouth closed, no talking, an arc in beats, ambient motion): ' +
      'lip-sync from a still image is what makes AI video look fake. Provide exactly one of image or photo. ' +
      'Returns the clip id and status. ' + POLL_CLIP,
    inputSchema: {
      image: z.string().optional().describe('Id of a generated character look (same as --image).'),
      photo: z.string().optional().describe('Local path to your own photo, png/jpg/jpeg/webp; uploaded first (same as --photo).'),
      prompt: z.string().max(videos.MAX_PROMPT_LENGTH).optional().describe('What the character does, max 1500 chars (same as --prompt).'),
      scene: z.string().max(videos.MAX_SCENE_PROMPT_LENGTH).optional()
        .describe('Extra scene description, max 600 chars; makes it a scene-staged clip (same as --scene).'),
      duration: z.union([z.literal(5), z.literal(10)]).optional().describe('5 or 10 seconds, default 5 (same as --duration).'),
      keep_sound: z.boolean().optional().describe('Keep the original sound (same as --keep-sound).'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    handler: async (args) => {
      const api = await createApiClient();
      const source = await resolveImageSource(api, args);
      const video = await videos.createImageToVideo(api, {
        ...source,
        prompt: args.prompt,
        scenePrompt: args.scene,
        duration: args.duration,
        keepOriginalSound: args.keep_sound,
      });
      return { id: video.id, status: video.status, video, next: POLL_CLIP };
    },
  }),

  define({
    name: 'create_motion_clip',
    title: 'Create a motion-control clip',
    description:
      'Animate a character look (or your own photo) by copying the motion of a driver video. Same as `clipugc videos motion`. ' +
      'Two engines: kling (default, 3 credits per second of driver video, reads the prompt) or wan (2 credits per second, keeps the ' +
      'look\'s own background, ignores the prompt, resolution 480p, 580p or 720p). Rounded up, capped at 30 seconds (confirm with get_credits). ' +
      'The driver must be mp4/mov, at most 50 MB and 30 seconds; it is uploaded first. Provide exactly one of image or photo. ' +
      'Returns the clip id and status. ' + POLL_CLIP,
    inputSchema: {
      image: z.string().optional().describe('Id of a generated character look (same as --image).'),
      photo: z.string().optional().describe('Local path to your own photo, png/jpg/jpeg/webp; uploaded first (same as --photo).'),
      driver: z.string().min(1).describe('Local path of the driver video, mp4/mov, max 50 MB and 30s (same as --driver).'),
      prompt: z.string().max(videos.MAX_PROMPT_LENGTH).optional().describe('What the character does, max 1500 chars (same as --prompt).'),
      engine: z.enum(videos.MOTION_ENGINES).optional().describe('kling (default) or wan, the cheaper engine (same as --engine).'),
      resolution: z.enum(videos.WAN_RESOLUTIONS).optional().describe('wan only: 480p, 580p or 720p, default 720p (same as --resolution).'),
      keep_sound: z.boolean().optional().describe('Keep the driver video\'s original sound (same as --keep-sound).'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    handler: async (args) => {
      const api = await createApiClient();
      const source = await resolveImageSource(api, args);
      const referenceVideoKey = await uploads.uploadFile(api, 'driver_video', args.driver, { quiet: true });
      const video = await videos.createMotionControl(api, {
        ...source,
        referenceVideoKey,
        prompt: args.prompt,
        engine: args.engine,
        resolution: args.resolution,
        keepOriginalSound: args.keep_sound,
      });
      return { id: video.id, status: video.status, video, next: POLL_CLIP };
    },
  }),

  define({
    name: 'create_scene_replace_clip',
    title: 'Put your AI influencer into your own video',
    description:
      'Put an AI influencer into a video the user filmed or holds the rights to: the AI influencer takes the place of the person ' +
      'in it, in that video\'s own room, light and camera, and the clip carries a visible "AI generated" label. Same as ' +
      '`clipugc videos replace`. Needs a look of an AI influencer designed in ClipUGC (not the user\'s own photo) and a local video ' +
      'file, mp4/mov, at most 50 MB and 30 seconds; it is uploaded first. Costs 3 credits per second of the video, rounded up, ' +
      'capped at 30 seconds (confirm with get_credits). Rendering takes several minutes. Returns the clip id and status. ' +
      POLL_CLIP,
    inputSchema: {
      image: z.string().min(1).describe('Id of a look of an AI influencer designed in ClipUGC (same as --image).'),
      driver: z.string().min(1).describe('Local path of the user\'s own video, mp4/mov, max 50 MB and 30s (same as --driver).'),
      resolution: z.enum(videos.WAN_RESOLUTIONS).optional().describe('480p, 580p or 720p, default 720p (same as --resolution).'),
      keep_sound: z.boolean().optional().describe('Keep the video\'s original sound (same as --keep-sound).'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    handler: async (args) => {
      const api = await createApiClient();
      const referenceVideoKey = await uploads.uploadFile(api, 'driver_video', args.driver, { quiet: true });
      const video = await videos.createSceneReplace(api, {
        characterReferenceImageId: args.image,
        referenceVideoKey,
        resolution: args.resolution,
        keepOriginalSound: args.keep_sound,
      });
      return { id: video.id, status: video.status, video, next: POLL_CLIP };
    },
  }),

  define({
    name: 'merge_ad',
    title: 'Turn a clip into a finished UGC video',
    description:
      'Put an app screen recording and a hook text overlay (plus optional background music) into a completed clip to make the ' +
      'finished UGC video for the app. Same as `clipugc videos merge <clipId>`. The clip must have status "completed" (check ' +
      'with get_video). This step is free at the time of writing; the live cost is the "merge" entry of get_credits. Files are ' +
      'uploaded first. Returns merged_video_id: the finished video id, which is a different id space from the clip id. ' +
      POLL_FINISHED,
    inputSchema: {
      video: idField('Clip (character video)'),
      app_video: z.string().min(1).describe('Local path of the app screen recording, mp4/mov (same as --app-video).'),
      hook: z.string().min(1).max(videos.MAX_HOOK_TEXT_LENGTH).describe('Hook text overlaid on the video, max 150 chars (same as --hook).'),
      music: z.string().optional().describe('Local path of background music, mp3/wav/m4a (same as --music).'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    handler: async (args) => {
      const api = await createApiClient();
      const appVideoKey = await uploads.uploadFile(api, 'app_video', args.app_video, { quiet: true });
      const musicKey = args.music ? await uploads.uploadFile(api, 'music', args.music, { quiet: true }) : undefined;
      const clip = await videos.mergeVideo(api, args.video, { appVideoKey, hookText: args.hook, musicKey });
      const mergedVideoId = clip.merged_video_id == null ? null : clip.merged_video_id;
      return {
        merged_video_id: mergedVideoId,
        clip_id: clip.id,
        merge_status: clip.merge_status ?? 'pending',
        clip,
        next: mergedVideoId !== null
          ? POLL_FINISHED
          : 'The request was accepted but no merged_video_id came back. List finished videos with `clipugc finished list` to find it.',
      };
    },
  }),

  define({
    name: 'get_video',
    title: 'Get clip or finished video status',
    description:
      'Get the current status of a clip (kind "clip", default; same as `clipugc videos status <id>`) or of a finished video ' +
      '(kind "finished"; same as `clipugc finished show <videoId>`). This is the poll tool for create_clip, create_motion_clip ' +
      'and merge_ad. Status is pending, processing, completed or failed. A clip record also carries merge_status and ' +
      'merged_video_id once a finished video was made from it. Costs no credits.',
    inputSchema: {
      id: idField('Clip or finished video'),
      kind: KIND_FIELD,
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
    handler: async (args) => {
      const api = await createApiClient();
      if (isFinishedKind(args.kind)) {
        const finished = await ads.getMergedVideo(api, args.id);
        return {
          kind: args.kind,
          id: finished.id,
          status: finished.status,
          ad: finished, // output key kept for existing callers
          next: finished.status === 'completed'
            ? `Download it with download_video {"id": "${finished.id}", "kind": "finished"}.`
            : finished.status === 'failed'
              ? (finished.can_retry ? `Re-render it with \`clipugc finished retry ${finished.id}\` (free).` : 'Run merge_ad again with the app recording.')
              : 'Still rendering. Poll again in 5 to 10 seconds.',
        };
      }
      const check = await videos.checkVideoStatus(api, args.id);
      return {
        kind: 'clip',
        id: args.id,
        status: check.status,
        check,
        next: check.status === 'completed'
          ? `Download it with download_video {"id": "${args.id}"} or turn it into a finished video with merge_ad.`
          : check.status === 'failed'
            ? `Generation failed${check.failure_reason || check.error_message ? `: ${check.failure_reason || check.error_message}` : ''}. Retry with \`clipugc videos retry ${args.id}\`.`
            : 'Still generating. Poll again in 5 to 10 seconds.',
      };
    },
  }),

  define({
    name: 'download_video',
    title: 'Download a clip or finished video',
    description:
      'Download a completed clip (kind "clip", default; same as `clipugc videos download <id>`) or a completed finished video ' +
      '(kind "finished"; same as `clipugc finished download <videoId>`) to a local mp4 file. Pass an absolute output path; missing parent ' +
      'directories are created. Costs no credits. Fails if the video has not completed yet.',
    inputSchema: {
      id: idField('Clip or finished video'),
      kind: KIND_FIELD,
      output: z.string().optional().describe('Destination file path (same as --output). Default: clipugc-video-<id>.mp4 or clipugc-finished-<id>.mp4 in the server\'s working directory.'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: async (args) => {
      const api = await createApiClient();
      const dest = isFinishedKind(args.kind)
        ? await ads.downloadMergedVideo(api, args.id, { output: args.output, quiet: true })
        : await videos.downloadVideo(api, args.id, { output: args.output, quiet: true });
      return { kind: args.kind ?? 'clip', id: args.id, output: path.resolve(dest) };
    },
  }),

  define({
    name: 'get_credits',
    title: 'Get credit balance and costs',
    description:
      'Return the authenticated user\'s credit balance and the live per-action credit costs (image, clip, clip_10s, scene_staged, ' +
      'motion_per_second, motion_wan_per_second, scene_replace_per_second, merge). Same as `clipugc credits`. Call it before any generation tool so you can tell the user the ' +
      'cost and stop early when the balance is too low. Costs no credits.',
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: true },
    handler: async () => {
      const api = await createApiClient();
      const info = await user.getCredits(api);
      return { balance: info.balance, costs: info.costs ?? {}, top_up_url: DASHBOARD_URL };
    },
  }),

  define({
    name: 'list_hooks',
    title: 'Suggest hook texts',
    description:
      'Get AI-suggested hook texts (the short attention-grabbing line burned over a UGC video). Same as `clipugc hooks suggest`. ' +
      'Pass context describing the app for tailored hooks. Pick one (max 150 chars) and pass it as hook to merge_ad. ' +
      'Costs no credits.',
    inputSchema: {
      context: z.string().optional().describe('Describe the app, e.g. "my app is a habit tracker" (same as --context).'),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
    handler: async (args) => {
      const api = await createApiClient();
      const result = await hooks.suggestHooks(api, args.context);
      return { hooks: result.hooks };
    },
  }),
];

export function getTool(name: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.name === name);
}

/** Map a thrown error to the text an MCP client (and its LLM) can act on. */
export function formatToolError(error: unknown): string {
  if (error instanceof AuthError) {
    return `${AUTH_HELP} (server said: ${error.message})`;
  }
  if (error instanceof InsufficientCreditsError) {
    return `${error.message} Call get_credits to see the balance; credits can be bought at ${DASHBOARD_URL}.`;
  }
  if (error instanceof PremiumRequiredError) {
    return `${error.message} This needs a paid plan; upgrade at ${DASHBOARD_URL}.`;
  }
  if (error instanceof CliError) {
    return `${error.name}: ${error.message}`;
  }
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return `Error: ${String(error)}`;
}

/**
 * Validate the raw arguments against the tool's schema, run it, and wrap the outcome in an
 * MCP CallToolResult. Never throws: failures come back as isError results so the client can
 * show them to the model.
 */
export async function runTool(tool: ToolDefinition, rawArgs: unknown): Promise<ToolResult> {
  try {
    const parsed = z.object(tool.inputSchema).parse(rawArgs ?? {});
    const data = await tool.handler(parsed);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
      return { isError: true, content: [{ type: 'text', text: `Invalid arguments for ${tool.name}: ${issues}` }] };
    }
    return { isError: true, content: [{ type: 'text', text: formatToolError(error) }] };
  }
}
