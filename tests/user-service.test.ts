import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from '../src/services/api.js';
import { getUser, getCredits, getCreditTransactions, deleteAccount } from '../src/services/user.service.js';
import { AuthError, InsufficientCreditsError } from '../src/utils/errors.js';

const BASE = 'https://example.test/api/v1';

function envelopeResponse(envelope: unknown, httpStatus = 200): Response {
  return new Response(JSON.stringify(envelope), {
    status: httpStatus,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('user.service', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getUser fetches GET /user with bearer auth and returns the profile', async () => {
    const profile = { id: 3, name: 'Mirze', email: 'me@example.com', is_premium: true };
    fetchMock.mockResolvedValue(
      envelopeResponse({ statusCode: 200, errorMessage: null, data: profile, message: null }),
    );

    const api = new ApiClient(BASE, 'tok_user');
    const user = await getUser(api);

    expect(user).toEqual(profile);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${BASE}/user`);
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer tok_user');
  });

  it('getCredits fetches GET /credits and returns balance + duration-aware costs', async () => {
    const credits = {
      balance: 42,
      costs: { image: 2, clip: 7, clip_10s: 13, motion_per_second: 3, scene_staged: 9, merge: 1 },
    };
    fetchMock.mockResolvedValue(
      envelopeResponse({ statusCode: 200, errorMessage: null, data: credits, message: null }),
    );

    const api = new ApiClient(BASE, 'tok');
    const result = await getCredits(api);

    expect(result.balance).toBe(42);
    expect(result.costs.clip).toBe(7);
    expect(result.costs.clip_10s).toBe(13);
    expect(result.costs.motion_per_second).toBe(3);
    expect(result.costs.scene_staged).toBe(9);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${BASE}/credits`);
  });

  it('getCreditTransactions passes per_page/page and unwraps { transactions, pagination }', async () => {
    const data = {
      transactions: [
        { id: 2, action: 'clip', amount: -7, balance_after: 35, description: 'Clip (5s)', created_at: '2026-07-31' },
        { id: 1, action: 'top_up', amount: 50, balance_after: 42, description: 'Credit pack', created_at: '2026-07-30' },
      ],
      pagination: { current_page: 1, last_page: 3, per_page: 2, total: 5, has_more_pages: true },
    };
    fetchMock.mockResolvedValue(
      envelopeResponse({ statusCode: 200, errorMessage: null, data, message: null }),
    );

    const api = new ApiClient(BASE, 'tok');
    const result = await getCreditTransactions(api, { perPage: 2, page: 1 });

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].amount).toBe(-7);
    expect(result.pagination?.has_more_pages).toBe(true);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe('/api/v1/credits/transactions');
    expect(url.searchParams.get('per_page')).toBe('2');
    expect(url.searchParams.get('page')).toBe('1');
  });

  it('getCreditTransactions tolerates a raw array payload', async () => {
    const data = [{ id: 1, amount: -9, balance_after: 10 }];
    fetchMock.mockResolvedValue(
      envelopeResponse({ statusCode: 200, errorMessage: null, data, message: null }),
    );

    const api = new ApiClient(BASE, 'tok');
    const result = await getCreditTransactions(api);

    expect(result.transactions).toHaveLength(1);
    expect(result.pagination).toBeUndefined();
  });

  it('deleteAccount issues DELETE /user', async () => {
    fetchMock.mockResolvedValue(
      envelopeResponse({ statusCode: 200, errorMessage: null, data: null, message: 'deleted' }),
    );

    const api = new ApiClient(BASE, 'tok');
    await deleteAccount(api);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${BASE}/user`);
    expect(init.method).toBe('DELETE');
  });

  it('propagates AuthError on an envelope 401', async () => {
    fetchMock.mockResolvedValue(
      envelopeResponse({ statusCode: 401, errorMessage: 'Unauthenticated', data: null, message: null }),
    );

    const api = new ApiClient(BASE, 'bad-key');
    await expect(getUser(api)).rejects.toBeInstanceOf(AuthError);
  });

  it('propagates InsufficientCreditsError on an envelope 1003', async () => {
    fetchMock.mockResolvedValue(
      envelopeResponse({ statusCode: 1003, errorMessage: 'Not enough credits', data: null, message: null }),
    );

    const api = new ApiClient(BASE, 'tok');
    await expect(getCredits(api)).rejects.toBeInstanceOf(InsufficientCreditsError);
  });
});
