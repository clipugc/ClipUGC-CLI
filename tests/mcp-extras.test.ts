import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

vi.mock('../src/services/api.js', () => ({ createApiClient: vi.fn() }));

import { createApiClient } from '../src/services/api.js';
import { createMcpServer } from '../src/mcp/server.js';
import { PROMPT_NAMES, RESOURCE_URIS, PRICING_NOTES } from '../src/mcp/extras.js';

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

describe('clipugc mcp prompts and resources', () => {
  it('lists the three prompts with titles and argument schemas', async () => {
    const client = await connectedClient();
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name).sort()).toEqual([...PROMPT_NAMES].sort());
    const make = prompts.find((p) => p.name === 'make_ugc_video');
    expect(make?.title).toBeTruthy();
    expect(make?.arguments?.map((a) => a.name).sort()).toEqual(['app', 'message', 'recording']);
    expect(make?.arguments?.find((a) => a.name === 'app')?.required).toBe(true);
    await client.close();
  });

  it('renders make_ugc_video with the pipeline and the given app', async () => {
    const client = await connectedClient();
    const result = await client.getPrompt({ name: 'make_ugc_video', arguments: { app: 'a habit tracker', recording: '/tmp/rec.mp4' } });
    const text = (result.messages[0].content as { text: string }).text;
    expect(text).toContain('a habit tracker');
    expect(text).toContain('merge_ad: /tmp/rec.mp4');
    expect(text).toContain('get_credits');
    expect(text).not.toContain('—');
    await client.close();
  });

  it('lists and reads the pipeline and pricing resources', async () => {
    const client = await connectedClient();
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri).sort()).toEqual([...RESOURCE_URIS].sort());
    const pricing = await client.readResource({ uri: 'clipugc://pricing' });
    expect((pricing.contents[0] as { text: string }).text).toBe(PRICING_NOTES);
    expect(PRICING_NOTES).toContain('clip, 5 seconds: 7');
    expect(PRICING_NOTES).toContain('clip, 10 seconds: 13');
    await client.close();
  });
});
