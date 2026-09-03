import type { Command } from 'commander';
import { startMcpServer } from '../mcp/server.js';

/**
 * `clipugc mcp` starts a stdio Model Context Protocol server so MCP clients (Claude Code,
 * Cursor, Claude Desktop) can drive ClipUGC through tools instead of shelling out to the CLI.
 * Register it with e.g. `claude mcp add clipugc -- npx -y clipugc mcp`.
 */
export function registerMcpCommand(program: Command): void {
  program
    .command('mcp')
    .description(
      'Start a stdio MCP server exposing ClipUGC as tools for Claude Code, Cursor and other MCP clients (uses the same API key as the CLI)',
    )
    .action(async () => {
      await startMcpServer();
    });
}
