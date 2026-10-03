/**
 * `clipugc mcp` server: exposes the tools in ./tools.ts over the Model Context Protocol.
 *
 * Transport is stdio, so stdout belongs to the protocol. Everything human-readable goes to
 * stderr, and console.log is redirected there for the lifetime of the server as a guard
 * against any dependency printing while a tool runs.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getVersion } from '../version.js';
import { getConfigPath, resolveApiBaseUrl, resolveApiKey } from '../utils/config.js';
import { TOOLS, runTool } from './tools.js';
import { registerExtras } from './extras.js';

export const MCP_SERVER_NAME = 'clipugc';

/** Build the server with every tool registered. Shared by `clipugc mcp` and the tests. */
export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: getVersion() },
    {
      instructions:
        'ClipUGC makes AI influencer UGC videos for apps. Pipeline: create_character (2 credits) -> ' +
        'generate_image for more looks of the same face (2 each) -> create_clip (7 for 5 s, 13 for 10 s), create_motion_clip ' +
        '(3 per driver second on kling, 2 on wan) or create_scene_replace_clip (3 per second of the user\'s own video) -> merge_ad to put the app screen recording and a hook into the clip -> download_video. ' +
        'Generation tools return immediately; poll get_video (clips and finished videos) or list_images (looks) until status ' +
        'is completed. Call get_credits before spending. Clip ids and finished video ids (merged_video_id) are different id spaces.',
    },
  );

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      async (args) => runTool(tool, args),
    );
  }

  registerExtras(server);

  return server;
}

/** Start the stdio server and resolve when the client disconnects. */
export async function startMcpServer(): Promise<void> {
  const toStderr = (...args: unknown[]): void => {
    console.error(...args);
  };
  console.log = toStderr;
  console.info = toStderr;
  console.debug = toStderr;
  console.warn = toStderr;

  const server = createMcpServer();
  const transport = new StdioServerTransport();

  const closed = new Promise<void>((resolve) => {
    server.server.onclose = () => resolve();
  });

  await server.connect(transport);

  const apiKey = await resolveApiKey();
  const baseUrl = await resolveApiBaseUrl();
  console.error(`clipugc mcp ${getVersion()}: ${TOOLS.length} tools ready on stdio (api: ${baseUrl})`);
  if (!apiKey) {
    console.error(
      `clipugc mcp: no API key found (config ${getConfigPath()}, env CLIPUGC_API_KEY). ` +
        'Tools will fail until you run `clipugc auth login`.',
    );
  }

  await closed;
}
