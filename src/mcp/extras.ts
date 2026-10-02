/**
 * Prompts and resources for the `clipugc mcp` server.
 *
 * Tools do the work (see ./tools.ts). Prompts give a client a ready-made way to start the
 * common jobs, and resources let it read the pipeline and pricing notes without spending a
 * tool call. Prices quoted here are the documented defaults; get_credits returns the live ones.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export const PROMPT_NAMES = ['make_ugc_video', 'new_ai_influencer', 'hook_ideas'] as const;

export const RESOURCE_URIS = ['clipugc://pipeline', 'clipugc://pricing'] as const;

export const PIPELINE_GUIDE = `ClipUGC pipeline for one UGC video

1. get_credits. Stop and tell the user if the balance cannot cover the plan below.
2. Pick the face: list_characters with scope "discover" for a public influencer, or
   create_character with a plain description for a new private one (its first photo is
   generated automatically; poll list_images until a photo is completed).
3. Optional: generate_image for another look of the same face (a place, an outfit).
4. create_clip with the completed image id, a prompt for what she says or does, and
   duration 5 or 10. Poll get_video with the returned id until status is completed.
5. Optional: merge_ad with the clip id, the path to the app screen recording and a hook
   line (list_hooks suggests some) to make the finished video. Poll get_video with kind
   "finished" and the merged_video_id.
6. download_video with the id (kind "clip" or "finished") and an output path.

Ids: clip ids and finished video ids are separate id spaces. Generation tools return right
away; nothing blocks. A failed job refunds exactly what it charged.`;

export const PRICING_NOTES = `ClipUGC credit costs (documented defaults; get_credits returns the live table)

image (a photo of a character): 2
clip, 5 seconds: 7
clip, 10 seconds: 13
clip with a scene (character staged in a place first): 9 for 5 seconds, 15 for 10 seconds
motion clip: 3 per second of the driver video, capped at 30 seconds
finished video (app recording plus hook on a clip, the "merge" entry): free
listing, status, download and hook suggestions: free

Plans: Professional is 150 credits a month for $14.99, about 11 ten-second videos.
Credits: https://clipugc.com/dashboard`;

/** Register the prompts and resources on a server built by createMcpServer(). */
export function registerExtras(server: McpServer): void {
  server.registerPrompt(
    'make_ugc_video',
    {
      title: 'Make a UGC video for an app',
      description:
        'Walks the model through the whole ClipUGC pipeline for one video: pick or create the influencer, make the clip, add the app recording, download.',
      argsSchema: {
        app: z.string().describe('What the app does, in one or two sentences.'),
        message: z.string().optional().describe('What she should say or do in the clip. Leave empty to let the model write it.'),
        recording: z.string().optional().describe('Local path to the app screen recording to add, if any.'),
      },
    },
    ({ app, message, recording }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Make one UGC video for this app: ${app}\n` +
              (message ? `She should say or do: ${message}\n` : 'Write a short, natural line for her to say about the app.\n') +
              (recording ? `Add this app recording with merge_ad: ${recording}\n` : 'No app recording; stop after the clip.\n') +
              `\nFollow this order and tell me each id as you get it:\n${PIPELINE_GUIDE}`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'new_ai_influencer',
    {
      title: 'Create a new AI influencer',
      description: 'Creates a private ClipUGC character from a plain description and waits for her first photo.',
      argsSchema: {
        description: z.string().describe('Who she is: age range, style, setting, mood. Plain words.'),
      },
    },
    ({ description }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Create a private ClipUGC character described as: ${description}\n` +
              'Use create_character, then poll list_images for that character until a photo has status completed, ' +
              'and show me the character id and the image id. Call get_credits first and stop if the balance is under 2.',
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'hook_ideas',
    {
      title: 'Hook line ideas for an app',
      description: 'Asks ClipUGC for hook lines (the first words on screen) for an app, then picks the strongest three.',
      argsSchema: {
        app: z.string().describe('What the app does and who it is for.'),
      },
    },
    ({ app }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Call list_hooks with this context: ${app}\n` +
              'Then pick the three strongest lines, say why each works in one sentence, and keep every line under 150 characters.',
          },
        },
      ],
    }),
  );

  server.registerResource(
    'pipeline',
    'clipugc://pipeline',
    {
      title: 'ClipUGC pipeline',
      description: 'The order of tool calls for one UGC video, with polling and id rules.',
      mimeType: 'text/plain',
    },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/plain', text: PIPELINE_GUIDE }] }),
  );

  server.registerResource(
    'pricing',
    'clipugc://pricing',
    {
      title: 'ClipUGC credit costs',
      description: 'Documented credit cost of each action and the plan that covers it. get_credits has the live table.',
      mimeType: 'text/plain',
    },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/plain', text: PRICING_NOTES }] }),
  );
}
