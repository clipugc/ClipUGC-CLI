import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

/**
 * Drives the real McpServer through the SDK client over an in-memory transport: the tool
 * list and a tool call go through the same protocol code path `clipugc mcp` uses over stdio,
 * with only the HTTP-facing service mocked.
 */
vi.mock('../src/services/api.js', () => ({ createApiClient: vi.fn() }));
vi.mock('../src/services/user.service.js', () => ({ getCredits: vi.fn() }));

import { createApiClient } from '../src/services/api.js';
import { getCredits } from '../src/services/user.service.js';
import { createMcpServer } from '../src/mcp/server.js';
import { TOOL_NAMES } from '../src/mcp/tools.js';

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

describe('clipugc mcp server', () => {
  it('lists all 12 tools with JSON schemas after the initialize handshake', async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
    const credits = tools.find((t) => t.name === 'get_credits');
    expect(credits?.description).toContain('credit');
    const clip = tools.find((t) => t.name === 'create_clip');
    expect(clip?.inputSchema.type).toBe('object');
    expect(Object.keys((clip?.inputSchema as { properties: Record<string, unknown> }).properties).sort()).toEqual(
      ['duration', 'image', 'keep_sound', 'photo', 'prompt', 'scene'],
    );
    await client.close();
  });

  it('executes get_credits through the protocol and returns JSON text', async () => {
    vi.mocked(getCredits).mockResolvedValue({ balance: 15, costs: { image: 2, clip: 7 } });
    const client = await connectedClient();
    const result = await client.callTool({ name: 'get_credits', arguments: {} });
    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const payload = JSON.parse(content[0].text) as { balance: number; costs: Record<string, number> };
    expect(payload.balance).toBe(15);
    expect(payload.costs.clip).toBe(7);
    await client.close();
  });

  it('returns an isError result (not a protocol error) when the API key is missing', async () => {
    const { AuthError } = await import('../src/utils/errors.js');
    vi.mocked(createApiClient).mockRejectedValue(new AuthError('Not logged in.'));
    const client = await connectedClient();
    const result = await client.callTool({ name: 'get_credits', arguments: {} });
    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain('clipugc auth login');
    await client.close();
  });

  it('rejects invalid arguments at the protocol layer before the handler runs', async () => {
    const client = await connectedClient();
    const result = await client.callTool({ name: 'get_video', arguments: { id: '1', kind: 'bogus' } });
    expect(result.isError).toBe(true);
    await client.close();
  });
});
