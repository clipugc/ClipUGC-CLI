import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../src/services/api.js';
import {
  ApiError,
  AuthError,
  InsufficientCreditsError,
  NetworkError,
  NotFoundError,
  PremiumRequiredError,
  ValidationError,
} from '../src/utils/errors.js';

const BASE = 'https://example.test/api/v1';

function envelopeResponse(envelope: unknown, httpStatus = 200): Response {
  return new Response(JSON.stringify(envelope), {
    status: httpStatus,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ApiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('unwraps a 200 envelope and returns data', async () => {
    fetchMock.mockResolvedValue(
      envelopeResponse({ statusCode: 200, errorMessage: null, data: { id: 7 }, message: 'ok' }),
    );
    const client = new ApiClient(BASE, 'key123');
    const data = await client.get<{ id: number }>('/user');
    expect(data).toEqual({ id: 7 });
  });

  it('treats 201 as success', async () => {
    fetchMock.mockResolvedValue(
      envelopeResponse({ statusCode: 201, errorMessage: null, data: { id: 1 }, message: null }),
    );
    const client = new ApiClient(BASE, 'key123');
    await expect(client.post('/ai-characters', { body: { full_name: 'A B' } })).resolves.toEqual({ id: 1 });
  });

  it('sends Bearer auth and no X-Client-Type header', async () => {
    fetchMock.mockResolvedValue(
      envelopeResponse({ statusCode: 200, errorMessage: null, data: {}, message: null }),
    );
    const client = new ApiClient(BASE, 'secret-token');
    await client.get('/user');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${BASE}/user`);
    expect(init.headers.Authorization).toBe('Bearer secret-token');
    expect(init.headers['X-Client-Type']).toBeUndefined();
    expect(init.headers['X-App-Secret']).toBeUndefined();
  });

  it('serializes query params and drops empty values', async () => {
    fetchMock.mockResolvedValue(
      envelopeResponse({ statusCode: 200, errorMessage: null, data: [], message: null }),
    );
    const client = new ApiClient(BASE, 'k');
    await client.get('/ai-characters', {
      query: { scope: 'mine', search: undefined, page: 2, per_page: 50, empty: '' },
    });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('scope')).toBe('mine');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('per_page')).toBe('50');
    expect(url.searchParams.has('search')).toBe(false);
    expect(url.searchParams.has('empty')).toBe(false);
  });

  it('maps envelope 400 to ValidationError', async () => {
    fetchMock.mockResolvedValue(
      envelopeResponse({ statusCode: 400, errorMessage: 'full_name is required', data: null, message: null }),
    );
    const client = new ApiClient(BASE, 'k');
    await expect(client.post('/ai-characters')).rejects.toThrow(ValidationError);
    fetchMock.mockResolvedValue(
      envelopeResponse({ statusCode: 400, errorMessage: 'full_name is required', data: null, message: null }),
    );
    await expect(client.post('/ai-characters')).rejects.toThrow('full_name is required');
  });

  it('maps envelope 401 to AuthError', async () => {
    fetchMock.mockResolvedValue(
      envelopeResponse({ statusCode: 401, errorMessage: 'Unauthenticated', data: null, message: null }),
    );
    const client = new ApiClient(BASE, 'bad');
    await expect(client.get('/user')).rejects.toThrow(AuthError);
  });

  it('maps envelope 404 to NotFoundError', async () => {
    fetchMock.mockResolvedValue(
      envelopeResponse({ statusCode: 404, errorMessage: 'Character not found', data: null, message: null }),
    );
    const client = new ApiClient(BASE, 'k');
    await expect(client.get('/ai-characters/999')).rejects.toThrow(NotFoundError);
  });

  it('maps envelope 1002 to PremiumRequiredError', async () => {
    fetchMock.mockResolvedValue(
      envelopeResponse({ statusCode: 1002, errorMessage: 'Premium required', data: null, message: null }),
    );
    const client = new ApiClient(BASE, 'k');
    await expect(client.post('/character-videos/image-to-video')).rejects.toThrow(PremiumRequiredError);
  });

  it('maps envelope 1003 to InsufficientCreditsError with friendly message', async () => {
    fetchMock.mockResolvedValue(
      envelopeResponse({ statusCode: 1003, errorMessage: 'You need 2 more credits', data: null, message: null }),
    );
    const client = new ApiClient(BASE, 'k');
    const err = await client.post('/character-videos/image-to-video').catch((e) => e);
    expect(err).toBeInstanceOf(InsufficientCreditsError);
    expect(err.message).toContain('Insufficient credits');
    expect(err.message).toContain('You need 2 more credits');
  });

  it('maps unknown envelope codes to ApiError', async () => {
    fetchMock.mockResolvedValue(
      envelopeResponse({ statusCode: 500, errorMessage: 'Server exploded', data: null, message: null }),
    );
    const client = new ApiClient(BASE, 'k');
    const err = await client.get('/user').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(500);
  });

  it('maps fetch rejection to NetworkError', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const client = new ApiClient(BASE, 'k');
    await expect(client.get('/user')).rejects.toThrow(NetworkError);
  });

  it('handles non-envelope 401 JSON (framework-level) as AuthError', async () => {
    fetchMock.mockResolvedValue(envelopeResponse({ message: 'Unauthenticated.' }, 401));
    const client = new ApiClient(BASE, 'bad');
    await expect(client.get('/user')).rejects.toThrow(AuthError);
  });

  it('handles non-JSON responses as ApiError', async () => {
    fetchMock.mockResolvedValue(new Response('<html>boom</html>', { status: 502 }));
    const client = new ApiClient(BASE, 'k');
    await expect(client.get('/user')).rejects.toThrow(ApiError);
  });

  it('request() also returns the envelope message', async () => {
    fetchMock.mockResolvedValue(
      envelopeResponse({ statusCode: 200, errorMessage: null, data: { ok: true }, message: 'Video deleted' }),
    );
    const client = new ApiClient(BASE, 'k');
    const result = await client.request('DELETE', '/character-videos/3');
    expect(result.message).toBe('Video deleted');
  });
});
