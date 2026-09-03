import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

/**
 * server.json is the MCP Registry listing. The registry rejects a publish when the name does
 * not match package.json#mcpName or when the versions disagree, so those invariants are
 * pinned here instead of being discovered at publish time.
 */
const root = new URL('../', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as {
  name: string;
  version: string;
  mcpName?: string;
};
const serverJson = JSON.parse(readFileSync(new URL('server.json', root), 'utf8')) as {
  $schema: string;
  name: string;
  description: string;
  version: string;
  packages: Array<{
    registryType: string;
    identifier: string;
    version: string;
    transport: { type: string };
    packageArguments?: Array<{ type: string; value?: string }>;
  }>;
};

describe('server.json (MCP Registry listing)', () => {
  it('uses a GitHub namespace that matches package.json#mcpName', () => {
    expect(serverJson.name).toMatch(/^io\.github\.[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/);
    expect(pkg.mcpName).toBe(serverJson.name);
  });

  it('keeps every version in step with package.json', () => {
    expect(serverJson.version).toBe(pkg.version);
    for (const p of serverJson.packages) expect(p.version).toBe(pkg.version);
  });

  it('points at the npm package with the mcp argument over stdio', () => {
    expect(serverJson.packages).toHaveLength(1);
    const [p] = serverJson.packages;
    expect(p.registryType).toBe('npm');
    expect(p.identifier).toBe(pkg.name);
    expect(p.transport.type).toBe('stdio');
    expect(p.packageArguments?.some((a) => a.type === 'positional' && a.value === 'mcp')).toBe(true);
  });

  it('fits the registry description limit and pins a dated schema', () => {
    expect(serverJson.description.length).toBeLessThanOrEqual(100);
    expect(serverJson.$schema).toMatch(/^https:\/\/static\.modelcontextprotocol\.io\/schemas\/\d{4}-\d{2}-\d{2}\/server\.schema\.json$/);
  });
});
