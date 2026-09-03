// Smithery's stdio (MCPB) publish validates each manifest tool as an object with an
// inputSchema, which the MCPB spec itself forbids (`mcpb pack` rejects unknown keys).
// So the Smithery release is a second zip of the same staged bundle whose manifest
// carries inputSchema + annotations copied from the live tools/list.
//
// Usage: node scripts/smithery-manifest.mjs <stage-dir> <out-dir>
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'node:fs';
import path from 'node:path';

const [stage, outDir] = process.argv.slice(2);
if (!stage || !outDir) {
  console.error('usage: node scripts/smithery-manifest.mjs <stage-dir> <out-dir>');
  process.exit(1);
}

const transport = new StdioClientTransport({
  command: 'node',
  args: [path.join(stage, 'dist/index.js'), 'mcp'],
  env: { ...process.env, CLIPUGC_API_KEY: 'unused-for-tools-list' },
  stderr: 'pipe',
});
const client = new Client({ name: 'smithery-manifest', version: '0' });
await client.connect(transport);
const { tools } = await client.listTools();
await client.close();

const manifestPath = path.join(outDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.tools = tools.map((tool) => ({
  name: tool.name,
  description: tool.description,
  inputSchema: tool.inputSchema,
  annotations: tool.annotations ?? {},
}));
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`smithery manifest: ${manifest.tools.length} tools with inputSchema`);
