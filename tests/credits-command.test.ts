import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { createCli } from '../src/cli.js';
import { loadConfig, saveConfig } from '../src/utils/config.js';

let tmpDir: string;

function envelopeResponse(envelope: unknown): Response {
  return new Response(JSON.stringify(envelope), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clipugc-credits-test-'));
  process.env.CLIPUGC_CONFIG_PATH = path.join(tmpDir, 'config.json');
  delete process.env.CLIPUGC_API_KEY;
  delete process.env.CLIPUGC_API_BASE_URL;
  const config = await loadConfig();
  config.apiKey = 'tok_credits';
  config.email = 'me@example.com';
  await saveConfig(config);
});

afterEach(async () => {
  delete process.env.CLIPUGC_CONFIG_PATH;
  vi.unstubAllGlobals();
  await fs.remove(tmpDir);
});

describe('credits command (rendering)', () => {
  it('renders readable labels for the new duration-aware cost keys', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        envelopeResponse({
          statusCode: 200,
          errorMessage: null,
          data: {
            balance: 100,
            costs: { image: 2, clip: 7, clip_10s: 13, motion_per_second: 3, scene_staged: 9, merge: 1 },
          },
          message: null,
        }),
      ),
    );
    const lines: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      lines.push(args.join(' '));
    });

    await createCli().parseAsync(['credits'], { from: 'user' });
    const out = lines.join('\n');

    expect(out).toContain('clip (5s)');
    expect(out).toContain('clip (10s)');
    expect(out).toContain('motion control (per second)');
    expect(out).toContain('scene-staged clip');
    logSpy.mockRestore();
  });
});

describe('credits history command', () => {
  it('calls GET /credits/transactions with --per-page and prints signed amounts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      envelopeResponse({
        statusCode: 200,
        errorMessage: null,
        data: {
          transactions: [
            { id: 2, action: 'clip', amount: -7, balance_after: 93, description: 'Clip (5s)', created_at: '2026-07-31' },
            { id: 1, action: 'top_up', amount: 50, balance_after: 100, description: 'Credit pack', created_at: '2026-07-30' },
          ],
          pagination: { current_page: 1, last_page: 1, per_page: 20, total: 2, has_more_pages: false },
        },
        message: null,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const lines: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      lines.push(args.join(' '));
    });

    await createCli().parseAsync(['credits', 'history', '--per-page', '20'], { from: 'user' });

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toContain('/credits/transactions');
    expect(url.searchParams.get('per_page')).toBe('20');

    const out = lines.join('\n');
    expect(out).toContain('-7');
    expect(out).toContain('+50');
    expect(out).toContain('Credit pack');
    logSpy.mockRestore();
  });

  it('--json prints the raw { transactions, pagination } payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        envelopeResponse({
          statusCode: 200,
          errorMessage: null,
          data: {
            transactions: [{ id: 1, amount: -9, balance_after: 91 }],
            pagination: { current_page: 1, last_page: 1, per_page: 20, total: 1, has_more_pages: false },
          },
          message: null,
        }),
      ),
    );
    const lines: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      lines.push(args.join(' '));
    });

    await createCli().parseAsync(['--json', 'credits', 'history'], { from: 'user' });
    const parsed = JSON.parse(lines.join('\n'));

    expect(parsed.transactions).toHaveLength(1);
    expect(parsed.transactions[0].amount).toBe(-9);
    logSpy.mockRestore();
  });
});
