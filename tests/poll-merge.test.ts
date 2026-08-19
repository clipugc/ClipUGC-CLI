import { describe, it, expect, vi } from 'vitest';
import { waitForMerge } from '../src/utils/poll.js';
import { ApiError } from '../src/utils/errors.js';

/**
 * `waitForMerge` now polls the AD (`GET /merged-videos/{id}`), whose own `status` is the merge
 * lifecycle — not a clip's synthesised `merge_status`.
 */
describe('waitForMerge', () => {
  it('resolves when the ad status becomes completed', async () => {
    const seq = [
      { status: 'pending' },
      { status: 'processing' },
      { status: 'completed', media: { has_merged: true } },
    ];
    let i = 0;
    const check = vi.fn(async () => seq[Math.min(i++, seq.length - 1)]);

    const result = await waitForMerge(check, { intervalMs: 1, quiet: true });
    expect(result.status).toBe('completed');
    expect(check).toHaveBeenCalledTimes(3);
  });

  it('treats a queued ad as still in progress', async () => {
    const seq = [{ status: 'pending' }, { status: 'completed' }];
    let i = 0;
    const check = vi.fn(async () => seq[Math.min(i++, seq.length - 1)]);

    await waitForMerge(check, { intervalMs: 1, quiet: true });
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('throws (credits refunded) when the ad status is failed', async () => {
    const check = vi.fn(async () => ({ status: 'failed' }));
    await expect(waitForMerge(check, { intervalMs: 1, quiet: true })).rejects.toBeInstanceOf(ApiError);
  });

  it('times out if the merge never finishes', async () => {
    const check = vi.fn(async () => ({ status: 'processing' }));
    await expect(waitForMerge(check, { intervalMs: 1, timeoutMs: 5, quiet: true })).rejects.toBeInstanceOf(ApiError);
  });
});
