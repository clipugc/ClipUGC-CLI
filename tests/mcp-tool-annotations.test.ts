import { describe, it, expect } from 'vitest';
import { TOOLS, TOOL_NAMES } from '../src/mcp/tools.js';

/**
 * The Claude connectors directory requires every tool to carry a title and either
 * readOnlyHint or destructiveHint. Claude Desktop also uses these hints to decide how
 * much to ask before running a tool, so a wrong hint is a user-facing bug: a read-only
 * tool marked as a write gets needless confirmation prompts, and a credit-spending tool
 * marked read-only runs without one.
 */
const READ_ONLY = ['list_characters', 'list_images', 'get_video', 'get_credits', 'list_hooks'] as const;
// Writers: the five that spend credits, plus download_video, which writes a file to disk.
const SPENDS_CREDITS = ['create_character', 'generate_image', 'create_clip', 'create_motion_clip', 'merge_ad', 'download_video'] as const;

describe('MCP tool annotations', () => {
  it('covers every registered tool exactly once', () => {
    expect([...READ_ONLY, ...SPENDS_CREDITS].sort()).toEqual([...TOOL_NAMES].sort());
  });

  it('gives every tool a non-empty title', () => {
    for (const tool of TOOLS) expect(tool.title.trim().length, tool.name).toBeGreaterThan(0);
  });

  it.each(READ_ONLY)('%s is read-only', (name) => {
    const tool = TOOLS.find((t) => t.name === name);
    expect(tool?.annotations.readOnlyHint).toBe(true);
  });

  it.each(SPENDS_CREDITS)('%s writes (spends credits) but destroys nothing', (name) => {
    const tool = TOOLS.find((t) => t.name === name);
    expect(tool?.annotations.readOnlyHint).toBe(false);
    expect(tool?.annotations.destructiveHint).toBe(false);
  });

  it('never marks a tool as destructive (nothing in the API deletes user data)', () => {
    for (const tool of TOOLS) expect(tool.annotations.destructiveHint, tool.name).not.toBe(true);
  });
});
