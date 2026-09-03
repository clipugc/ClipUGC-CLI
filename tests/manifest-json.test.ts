import { readFileSync, existsSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { TOOL_NAMES } from '../src/mcp/tools.js';

/**
 * manifest.json is the Claude Desktop extension (MCPB) manifest. Claude Desktop reads the
 * version, entry point and tool list from it, and the extension directory review checks the
 * privacy policy and tool annotations. The invariants that would otherwise only surface after
 * a submission are pinned here, the same way tests/server-json.test.ts does for the registry.
 */
const root = new URL('../', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as {
  name: string;
  version: string;
  license: string;
  engines: { node: string };
};
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8')) as {
  manifest_version: string;
  name: string;
  display_name: string;
  version: string;
  description: string;
  author: { name: string; url?: string };
  icon: string;
  license: string;
  server: {
    type: string;
    entry_point: string;
    mcp_config: { command: string; args: string[]; env: Record<string, string> };
  };
  user_config: Record<string, { type: string; title: string; description: string; sensitive?: boolean; required?: boolean }>;
  tools: Array<{ name: string; description?: string }>;
  compatibility: { claude_desktop: string; platforms: string[]; runtimes: { node: string } };
  privacy_policies: string[];
};

describe('manifest.json (Claude Desktop extension)', () => {
  it('keeps name, version and license in step with package.json', () => {
    expect(manifest.name).toBe(pkg.name);
    expect(manifest.version).toBe(pkg.version);
    expect(manifest.license).toBe(pkg.license);
    expect(manifest.compatibility.runtimes.node).toBe(pkg.engines.node);
  });

  it('uses a manifest version the directory accepts (0.2 or later)', () => {
    expect(Number(manifest.manifest_version)).toBeGreaterThanOrEqual(0.2);
  });

  it('starts the packaged CLI in mcp mode and passes the API key from user_config', () => {
    expect(manifest.server.type).toBe('node');
    expect(manifest.server.entry_point).toBe('dist/index.js');
    expect(manifest.server.mcp_config.command).toBe('node');
    expect(manifest.server.mcp_config.args).toEqual(['${__dirname}/dist/index.js', 'mcp']);
    expect(manifest.server.mcp_config.env.CLIPUGC_API_KEY).toBe('${user_config.api_key}');

    const apiKey = manifest.user_config.api_key;
    expect(apiKey.type).toBe('string');
    expect(apiKey.sensitive).toBe(true);
    expect(apiKey.required).toBe(true);
    expect(apiKey.title).toBe('ClipUGC API key');
    expect(apiKey.description).toContain('https://clipugc.com/dashboard');
  });

  it('declares exactly the tools the server registers, each with a description', () => {
    expect(manifest.tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
    for (const tool of manifest.tools) expect(tool.description?.trim().length ?? 0).toBeGreaterThan(0);
  });

  it('lists an HTTPS privacy policy (required for local connectors)', () => {
    expect(manifest.privacy_policies.length).toBeGreaterThan(0);
    for (const url of manifest.privacy_policies) expect(url).toMatch(/^https:\/\//);
  });

  it('ships a PNG icon that exists in the repo', () => {
    expect(manifest.icon).toMatch(/\.png$/);
    expect(existsSync(new URL(manifest.icon, root))).toBe(true);
  });

  it('targets all three desktop platforms and a Claude Desktop version', () => {
    expect(manifest.compatibility.platforms.sort()).toEqual(['darwin', 'linux', 'win32']);
    expect(manifest.compatibility.claude_desktop).toMatch(/^>=\d+\.\d+\.\d+$/);
  });

  it('uses plain wording without em dashes', () => {
    const text = JSON.stringify(manifest);
    expect(text).not.toContain('—');
  });
});
