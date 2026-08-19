import { describe, it, expect, vi } from 'vitest';
import type { ApiClient } from '../src/services/api.js';
import { suggestHooks } from '../src/services/hooks.service.js';

function fakeApi(post: ReturnType<typeof vi.fn>) {
  return { api: { post } as unknown as ApiClient, post };
}

describe('suggestHooks', () => {
  it('posts the context and returns data.hooks', async () => {
    const { api, post } = fakeApi(
      vi.fn().mockResolvedValue({ hooks: ['Stop scrolling!', 'This app changed my mornings'] }),
    );
    const result = await suggestHooks(api, 'my app is a habit tracker');
    expect(post).toHaveBeenCalledWith('/character-videos/hook-suggestions', {
      body: { context: 'my app is a habit tracker' },
    });
    expect(result.hooks).toEqual(['Stop scrolling!', 'This app changed my mornings']);
    expect(result.raw).toEqual({ hooks: ['Stop scrolling!', 'This app changed my mornings'] });
  });

  it('omits context when not provided or blank', async () => {
    const { api, post } = fakeApi(vi.fn().mockResolvedValue({ hooks: [] }));
    await suggestHooks(api);
    expect(post).toHaveBeenCalledWith('/character-videos/hook-suggestions', { body: {} });

    await suggestHooks(api, '   ');
    expect(post).toHaveBeenLastCalledWith('/character-videos/hook-suggestions', { body: {} });
  });

  it('tolerates a raw string array response', async () => {
    const { api } = fakeApi(vi.fn().mockResolvedValue(['Hook A', 'Hook B']));
    const result = await suggestHooks(api);
    expect(result.hooks).toEqual(['Hook A', 'Hook B']);
  });

  it('returns an empty list for unknown shapes and filters non-strings', async () => {
    const { api } = fakeApi(vi.fn().mockResolvedValue({ something: 'else' }));
    expect((await suggestHooks(api)).hooks).toEqual([]);

    const { api: api2 } = fakeApi(vi.fn().mockResolvedValue({ hooks: ['ok', 42, null, 'fine'] }));
    expect((await suggestHooks(api2)).hooks).toEqual(['ok', 'fine']);
  });
});
