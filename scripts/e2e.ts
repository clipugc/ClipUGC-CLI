/**
 * End-to-end test: drives the BUILT clipugc binary (dist/index.js) against a
 * running local ClipUGC website instance.
 *
 * Usage:
 *   npm run build && npm run e2e
 *
 * Env:
 *   CLIPUGC_E2E_BASE_URL  (default http://localhost:8080/api/v2)
 *   CLIPUGC_E2E_TOKEN     (optional; otherwise fetched from GET /test/login, a local-only route)
 *
 * The script fails fast with a clear message when the server is not reachable.
 * Server-side generation should be running with mock AI services (FalMockService)
 * so --wait completes offline.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/** Every tool `clipugc mcp` must expose. Kept in sync with src/mcp/tools.ts by the unit tests. */
const MCP_TOOL_NAMES = [
  'list_characters',
  'create_character',
  'generate_image',
  'list_images',
  'create_clip',
  'create_motion_clip',
  'create_scene_replace_clip',
  'merge_ad',
  'get_video',
  'download_video',
  'get_credits',
  'list_hooks',
];

const BASE_URL = process.env.CLIPUGC_E2E_BASE_URL ?? 'http://localhost:8080/api/v2';
const CLI = path.resolve(process.cwd(), 'dist/index.js');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipugc-e2e-'));
const configPath = path.join(tmpDir, 'config.json');

let step = 0;
function log(msg: string): void {
  console.log(`\x1b[36m[e2e]\x1b[0m ${msg}`);
}
function pass(msg: string): void {
  console.log(`\x1b[32m  ok\x1b[0m ${msg}`);
}
function warn(msg: string): void {
  console.log(`\x1b[33m  warn\x1b[0m ${msg}`);
}
function fail(msg: string): never {
  console.error(`\x1b[31m  FAIL\x1b[0m ${msg}`);
  process.exit(1);
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

function run(args: string[], opts: { allowFail?: boolean } = {}): RunResult {
  step += 1;
  log(`step ${step}: clipugc ${args.join(' ')}`);
  const res = spawnSync('node', [CLI, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      CLIPUGC_CONFIG_PATH: configPath,
      CLIPUGC_API_BASE_URL: BASE_URL,
      FORCE_COLOR: '0',
    },
    timeout: 25 * 60 * 1000,
  });
  const result = { code: res.status ?? 1, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
  if (result.code !== 0 && !opts.allowFail) {
    fail(`exit ${result.code}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  }
  return result;
}

function runJson(args: string[]): unknown {
  const res = run([...args, '--json']);
  try {
    return JSON.parse(res.stdout);
  } catch {
    fail(`expected JSON output from \`clipugc ${args.join(' ')}\`, got:\n${res.stdout}`);
  }
}

/** Tolerantly find an id in a data payload: top-level id, or first element of a wrapped list. */
function findId(data: unknown): string | number | undefined {
  if (data === null || typeof data !== 'object') return undefined;
  const obj = data as Record<string, unknown>;
  if (obj.id !== undefined) return obj.id as string | number;
  if (Array.isArray(data)) return findId(data[0]);
  for (const key of ['items', 'data', 'images', 'reference_images', 'videos', 'character', 'video', 'image']) {
    if (obj[key] !== undefined) {
      const found = findId(obj[key]);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

async function getToken(): Promise<string> {
  if (process.env.CLIPUGC_E2E_TOKEN) {
    log('using CLIPUGC_E2E_TOKEN from env');
    return process.env.CLIPUGC_E2E_TOKEN;
  }
  log(`fetching test token from ${BASE_URL}/test/login`);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/test/login`, { signal: AbortSignal.timeout(5000) });
  } catch {
    fail(
      `ClipUGC server not reachable at ${BASE_URL}.\n` +
        '  Start the local website (docker compose up -d, serves on http://localhost:8080)\n' +
        '  or set CLIPUGC_E2E_BASE_URL / CLIPUGC_E2E_TOKEN.',
    );
  }
  let body: { data?: { token?: string; access_token?: string } };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    fail(`GET /test/login returned non-JSON (HTTP ${res.status}). Is the local-only test route enabled?`);
  }
  const token = body.data?.token ?? body.data?.access_token;
  if (!token) fail(`GET /test/login gave no token: ${JSON.stringify(body)}`);
  return token;
}

/**
 * Start the built binary as an MCP server over stdio (`node dist/index.js mcp`), run the
 * initialize handshake, list the tools, and call get_credits against the same server the
 * CLI steps use. The config file already holds the token from `auth login`.
 */
async function mcpSmoke(): Promise<void> {
  step += 1;
  log(`step ${step}: clipugc mcp (stdio initialize, tools/list, tools/call get_credits)`);

  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  env.CLIPUGC_CONFIG_PATH = configPath;
  env.CLIPUGC_API_BASE_URL = BASE_URL;
  env.FORCE_COLOR = '0';

  const transport = new StdioClientTransport({ command: 'node', args: [CLI, 'mcp'], env, stderr: 'inherit' });
  const client = new Client({ name: 'clipugc-e2e', version: '0.0.0' });
  try {
    await client.connect(transport);
    const serverInfo = client.getServerVersion();
    if (serverInfo?.name !== 'clipugc') fail(`mcp initialize returned unexpected serverInfo: ${JSON.stringify(serverInfo)}`);
    pass(`mcp initialize → ${serverInfo.name} ${serverInfo.version}`);

    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    const missing = MCP_TOOL_NAMES.filter((n) => !names.includes(n));
    const extra = names.filter((n) => !MCP_TOOL_NAMES.includes(n));
    if (missing.length > 0 || extra.length > 0) {
      fail(`mcp tools/list mismatch. missing: [${missing.join(', ')}] extra: [${extra.join(', ')}]`);
    }
    pass(`mcp tools/list → ${names.length} tools`);

    const result = await client.callTool({ name: 'get_credits', arguments: {} });
    const content = result.content as Array<{ type: string; text?: string }>;
    const text = content.find((c) => c.type === 'text')?.text ?? '';
    if (result.isError) fail(`mcp get_credits returned an error: ${text}`);
    let credits: { balance?: unknown; costs?: unknown };
    try {
      credits = JSON.parse(text) as typeof credits;
    } catch {
      fail(`mcp get_credits returned non-JSON text:\n${text}`);
    }
    if (typeof credits.balance !== 'number' || typeof credits.costs !== 'object') {
      fail(`mcp get_credits payload lacks balance/costs: ${text}`);
    }
    pass(`mcp get_credits → balance ${credits.balance}`);
  } finally {
    await client.close().catch(() => undefined);
  }
}

function makeDummyFile(name: string, sizeKb = 64): string {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, Buffer.alloc(sizeKb * 1024, 7));
  return p;
}

async function main(): Promise<void> {
  log(`base URL: ${BASE_URL}`);
  log(`temp config: ${configPath}`);
  if (!fs.existsSync(CLI)) fail('dist/index.js not found — run `npm run build` first.');

  const token = await getToken();

  // Auth
  run(['auth', 'login', '--api-key', token]);
  pass('auth login');
  run(['whoami']);
  pass('whoami');

  const creditsRes = run(['credits'], { allowFail: true });
  if (creditsRes.code === 0) pass('credits');
  else warn('credits endpoint failed (may not be deployed yet) — continuing');

  // MCP server: same binary, same token, over stdio.
  await mcpSmoke();

  // Character — description path (web parity): the first look generates automatically.
  const character = runJson([
    'characters', 'create',
    '--description', 'an energetic e2e test character woman in her twenties, casual style',
    '--private',
  ]);
  const characterId = findId(character);
  if (characterId === undefined) fail(`no character id in: ${JSON.stringify(character)}`);
  const autoLooks = Array.isArray((character as { reference_images?: unknown[] }).reference_images)
    ? (character as { reference_images: unknown[] }).reference_images
    : [];
  pass(`characters create (description) → id ${characterId}, auto looks: ${autoLooks.length}`);

  run(['characters', 'show', String(characterId)]);
  pass('characters show');

  // Looks
  const images = runJson([
    'images', 'generate',
    '--character', String(characterId),
    '--shots', 'frontal',
    '--wait',
  ]);
  const imageId = findId(images);
  if (imageId === undefined) fail(`no image id in: ${JSON.stringify(images)}`);
  pass(`images generate --wait → id ${imageId}`);

  run(['images', 'list', '--character', String(characterId)]);
  pass('images list');

  // Clip
  const video = runJson([
    'videos', 'create',
    '--image', String(imageId),
    '--prompt', 'talking excitedly about an app',
    '--duration', '5',
    '--wait',
  ]);
  const videoId = findId(video);
  if (videoId === undefined) fail(`no video id in: ${JSON.stringify(video)}`);
  pass(`videos create --wait → id ${videoId}`);

  // Wan engine and scene replace (card #57). Submit only: against a mocked server the
  // render never finishes, so these check the request round trip, not the output.
  // CLIPUGC_E2E_DRIVER points at a real mp4 when running against the real API.
  const driverFile = process.env.CLIPUGC_E2E_DRIVER ?? makeDummyFile('driver.mp4');
  const extraClips: Array<string | number> = [];
  for (const [label, args, expect] of [
    ['videos motion --engine wan', ['videos', 'motion', '--image', String(imageId), '--driver', driverFile, '--engine', 'wan', '--resolution', '720p'], { mode: 'motion_control', engine: 'wan' }],
    ['videos replace', ['videos', 'replace', '--image', String(imageId), '--driver', driverFile], { mode: 'scene_replace', engine: 'wan' }],
  ] as const) {
    const res = run([...args, '--json'], { allowFail: true });
    if (res.code !== 0) {
      warn(`${label} failed (exit ${res.code}); the server may predate card #57 or the account lacks credits:\n${res.stderr}`);
      continue;
    }
    const clip = JSON.parse(res.stdout) as Record<string, unknown>;
    if (clip.mode !== expect.mode || clip.engine !== expect.engine) {
      fail(`${label}: expected mode ${expect.mode} / engine ${expect.engine}, got ${JSON.stringify(clip)}`);
    }
    extraClips.push(clip.id as string | number);
    pass(`${label} → id ${clip.id} (${clip.mode}, ${clip.engine})`);
  }

  // Merge (dummy app video; mocked pipeline should accept it — tolerate failure).
  // The merge produces an AD with its own id; everything after the merge uses that id.
  const appVideo = makeDummyFile('app-recording.mp4');
  let adId: string | number | undefined;
  const mergeRes = run(
    ['videos', 'merge', String(videoId), '--app-video', appVideo, '--hook', 'E2E hook text', '--json'],
    { allowFail: true },
  );
  if (mergeRes.code === 0) {
    let merged: Record<string, unknown> = {};
    try {
      merged = JSON.parse(mergeRes.stdout) as Record<string, unknown>;
    } catch {
      warn(`videos merge --json produced non-JSON output:\n${mergeRes.stdout}`);
    }
    adId = merged.merged_video_id as string | number | undefined;
    if (adId === undefined) warn('videos merge returned no merged_video_id — ad-side checks skipped');
    else pass(`videos merge → ad ${adId}`);
  } else {
    warn(`videos merge failed (exit ${mergeRes.code}) — dummy mp4 may be rejected by processing:\n${mergeRes.stderr}`);
  }

  if (adId !== undefined) {
    const adsList = run(['videos', 'list', '--finals'], { allowFail: true });
    if (adsList.code === 0) pass('videos list --finals (native /merged-videos)');
    else warn('videos list --finals failed — continuing');

    const showRes = run(['ads', 'show', String(adId)], { allowFail: true });
    if (showRes.code === 0) pass('ads show');
    else warn('ads show failed — continuing');
  }

  // Download: the clip, then the ad (different id spaces)
  const outFile = path.join(tmpDir, 'out.mp4');
  const dlRes = run(['videos', 'download', String(videoId), '-o', outFile], { allowFail: true });
  if (dlRes.code === 0 && fs.existsSync(outFile)) pass('videos download (clip)');
  else warn('videos download failed or produced no file — continuing');

  if (adId !== undefined) {
    const adFile = path.join(tmpDir, 'ad.mp4');
    const adDl = run(['ads', 'download', String(adId), '-o', adFile], { allowFail: true });
    if (adDl.code === 0 && fs.existsSync(adFile)) pass('ads download');
    else warn('ads download failed or produced no file (the merge may still be rendering) — continuing');
  }

  // Hooks
  const hooksRes = run(['hooks', 'suggest', '--context', 'habit tracker app'], { allowFail: true });
  if (hooksRes.code === 0) pass('hooks suggest');
  else warn('hooks suggest failed — continuing');

  // Cleanup. Deleting the ad leaves the clip alone, so delete both.
  if (adId !== undefined) run(['ads', 'delete', String(adId), '--yes'], { allowFail: true });
  run(['videos', 'delete', String(videoId), '--yes'], { allowFail: true });
  for (const id of extraClips) run(['videos', 'delete', String(id), '--yes'], { allowFail: true });
  run(['characters', 'delete', String(characterId), '--yes'], { allowFail: true });
  run(['auth', 'logout']);
  pass('cleanup + logout');

  log('E2E PASSED');
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
