import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Command } from 'commander';

/**
 * Brand rule: what ClipUGC makes is a "UGC video" / "finished video", never an "ad"; the
 * step that adds the app recording is never called a "merge" in prose; and outward text never
 * uses an em dash. This walks everything an MCP client shows a model or a user (server
 * instructions, tool titles/descriptions/argument descriptions, prompts and resources) plus
 * the directory listings (manifest.json, server.json, lhm.plugin.json, the Gemini and Cursor
 * manifests) and fails on any of them.
 *
 * Identifiers stay as shipped (renaming breaks installs and API callers): tool names such as
 * `merge_ad` are stripped before matching, snake_case wire fields (merged_video_id,
 * merge_status) never match the word-bounded patterns, and anything in `backticks` (CLI
 * commands like `clipugc videos merge`, the `merge` credit key) counts as code, not prose.
 */
vi.mock('../src/services/api.js', () => ({ createApiClient: vi.fn() }));

import { createApiClient } from '../src/services/api.js';
import { createMcpServer } from '../src/mcp/server.js';
import { TOOL_NAMES } from '../src/mcp/tools.js';
import { createCli } from '../src/cli.js';

const AD_WORD = /\bads?\b/i;
const MERGE_WORD = /\bmerg(e|es|ed|ing)\b/i;
const EM_DASH = '—';

function stripIdentifiers(text: string): string {
  let out = text.replace(/`[^`]*`/g, '<code>');
  for (const name of TOOL_NAMES) out = out.split(name).join('<tool>');
  return out;
}

/** Every string inside a JSON value, with the path it was found at. */
function collectStrings(value: unknown, path: string, out: Array<{ path: string; text: string }>): void {
  if (typeof value === 'string') {
    out.push({ path, text: value });
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => collectStrings(v, `${path}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      // Enum values are wire identifiers (kind "ad" is accepted for backward compatibility).
      if (k === 'enum') continue;
      collectStrings(v, `${path}.${k}`, out);
    }
  }
}

function offenders(entries: Array<{ path: string; text: string }>): string[] {
  return entries
    .filter(({ text }) => {
      const prose = stripIdentifiers(text);
      return AD_WORD.test(prose) || MERGE_WORD.test(prose) || text.includes(EM_DASH);
    })
    .map(({ path, text }) => `${path}: ${text}`);
}

async function connectedClient(): Promise<Client> {
  const server = createMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);
  return client;
}

beforeEach(() => {
  vi.mocked(createApiClient).mockResolvedValue({} as never);
});

describe('MCP outward wording', () => {
  it('server instructions never say "ad" or "merge" and never use an em dash', async () => {
    const client = await connectedClient();
    const instructions = client.getInstructions() ?? '';
    expect(instructions.length).toBeGreaterThan(0);
    expect(offenders([{ path: 'instructions', text: instructions }])).toEqual([]);
    await client.close();
  });

  it('tool titles, descriptions and argument descriptions are clean', async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();
    expect(tools.length).toBe(TOOL_NAMES.length);
    const entries: Array<{ path: string; text: string }> = [];
    for (const tool of tools) {
      collectStrings({ title: tool.title, description: tool.description, inputSchema: tool.inputSchema }, tool.name, entries);
    }
    expect(offenders(entries)).toEqual([]);
    await client.close();
  });

  it('prompts (listing and rendered text) and resources are clean', async () => {
    const client = await connectedClient();
    const entries: Array<{ path: string; text: string }> = [];

    const { prompts } = await client.listPrompts();
    for (const prompt of prompts) {
      collectStrings(prompt, `prompt:${prompt.name}`, entries);
      const args = Object.fromEntries((prompt.arguments ?? []).map((a) => [a.name, 'x']));
      const rendered = await client.getPrompt({ name: prompt.name, arguments: args });
      collectStrings(rendered, `prompt:${prompt.name}:rendered`, entries);
    }

    const { resources } = await client.listResources();
    for (const resource of resources) {
      collectStrings(resource, `resource:${resource.uri}`, entries);
      const read = await client.readResource({ uri: resource.uri });
      collectStrings(read, `resource:${resource.uri}:contents`, entries);
    }

    expect(entries.length).toBeGreaterThan(0);
    expect(offenders(entries)).toEqual([]);
    await client.close();
  });
});

describe('directory listings and extension manifests', () => {
  const root = new URL('../', import.meta.url);
  const LISTINGS = ['manifest.json', 'server.json', 'lhm.plugin.json', 'gemini-extension.json', '.cursor-plugin/plugin.json'];

  it.each(LISTINGS)('%s has no "ad", no "merge" and no em dash in its prose', (file) => {
    const json = JSON.parse(readFileSync(new URL(file, root), 'utf8')) as unknown;
    const entries: Array<{ path: string; text: string }> = [];
    collectStrings(json, file, entries);
    // Every listing carries at least a description; an empty walk would pass vacuously.
    expect(entries.length).toBeGreaterThan(0);
    expect(offenders(entries)).toEqual([]);
  });

  it('the matcher still catches the copy this rule was written for', () => {
    expect(offenders([{ path: 'x', text: 'ClipUGC makes AI influencer style UGC ads for mobile apps' }])).toHaveLength(1);
    expect(offenders([{ path: 'x', text: 'merge the app screen recording into the clip' }])).toHaveLength(1);
    expect(offenders([{ path: 'x', text: 'one line — another' }])).toHaveLength(1);
    expect(offenders([{ path: 'x', text: 'merge_ad returns merged_video_id; same as `clipugc videos merge <id>`' }])).toEqual([]);
  });
});

describe('`clipugc finished` and the legacy `ads` alias', () => {
  function sub(program: Command, name: string): Command | undefined {
    return program.commands.find((c) => c.name() === name);
  }

  it('registers `finished` with list, show (alias get), download, retry, delete', () => {
    const finished = sub(createCli(), 'finished');
    expect(finished).toBeDefined();
    expect(finished!.commands.map((c) => c.name()).sort()).toEqual(['delete', 'download', 'list', 'retry', 'show']);
    expect(sub(finished!, 'show')!.aliases()).toContain('get');
  });

  it('still resolves `clipugc ads` with the same subcommands, hidden from help', () => {
    const program = createCli();
    const ads = sub(program, 'ads');
    expect(ads).toBeDefined();
    expect(ads!.commands.map((c) => c.name()).sort()).toEqual(['delete', 'download', 'list', 'retry', 'show']);
    expect(program.helpInformation()).not.toMatch(/^\s+ads\b/m);
    expect(program.helpInformation()).toMatch(/^\s+finished\b/m);
  });

  it('dispatches `clipugc ads list` to the same action as `clipugc finished list`', async () => {
    const service = await import('../src/services/ads.service.js');
    const spy = vi.spyOn(service, 'listMergedVideos').mockResolvedValue({ items: [], raw: { merged_videos: [] } });
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      for (const name of ['ads', 'finished']) {
        const program = createCli().exitOverride();
        await program.parseAsync(['node', 'clipugc', '--json', name, 'list'], { from: 'node' });
      }
    } finally {
      write.mockRestore();
    }
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});
