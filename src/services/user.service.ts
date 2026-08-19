import type { ApiClient } from './api.js';
import type { Pagination } from '../types/index.js';

/**
 * User / account / credits service (G1 group).
 * All functions throw typed errors from src/utils/errors.ts via ApiClient;
 * they never exit the process.
 */

/**
 * Authenticated user profile returned by GET /user.
 * The API may add fields over time, so unknown fields are kept via the
 * index signature and printed generically by `whoami`.
 */
export interface UserProfile {
  id?: number | string;
  name?: string | null;
  email?: string | null;
  [key: string]: unknown;
}

/**
 * Per-action credit costs returned by GET /credits.
 * The server charges duration-aware, so several video costs coexist:
 *   image             a reference-image generation
 *   clip              a 5s image-to-video clip
 *   clip_10s          a 10s image-to-video clip
 *   motion_per_second motion-control charge per second of driver video
 *                     (× ceil(driver seconds), capped at 30s)
 *   scene_staged      a scene-staged clip (created with a --scene prompt)
 *   merge             merging a clip with an app recording into the final ad
 * Unknown keys are tolerated via the index signature so new server-side
 * actions render generically.
 */
export interface CreditCosts {
  image?: number;
  clip?: number;
  clip_10s?: number;
  motion_per_second?: number;
  scene_staged?: number;
  merge?: number;
  [action: string]: number | undefined;
}

/** Response of GET /credits. */
export interface CreditsInfo {
  /** Current credit balance. */
  balance: number;
  /** Per-action credit costs, e.g. { image: 2, clip: 7, clip_10s: 13, merge: 0 }. */
  costs: CreditCosts;
}

/** A single credit ledger entry returned by GET /credits/transactions. */
export interface CreditTransaction {
  id?: number | string;
  uuid?: string;
  type?: string;
  action?: string;
  /** Signed amount — negative means a spend, positive means a top-up/refund. */
  amount?: number;
  balance_after?: number;
  description?: string | null;
  created_at?: string;
  [key: string]: unknown;
}

/** Payload of GET /credits/transactions. */
export interface CreditTransactionsResult {
  transactions: CreditTransaction[];
  pagination?: Pagination;
}

/** Fetch the authenticated user's profile (GET /user). */
export async function getUser(api: ApiClient): Promise<UserProfile> {
  return api.get<UserProfile>('/user');
}

/** Fetch the credit balance and per-action costs (GET /credits). */
export async function getCredits(api: ApiClient): Promise<CreditsInfo> {
  return api.get<CreditsInfo>('/credits');
}

/**
 * Fetch the credit transaction history (GET /credits/transactions).
 * `perPage` maps to the `per_page` query param; `page` to `page`.
 * Tolerant to the API returning the array raw or wrapped under `transactions`.
 */
export async function getCreditTransactions(
  api: ApiClient,
  opts: { perPage?: number; page?: number } = {},
): Promise<CreditTransactionsResult> {
  const raw = await api.get<unknown>('/credits/transactions', {
    query: { per_page: opts.perPage, page: opts.page },
  });
  if (Array.isArray(raw)) {
    return { transactions: raw as CreditTransaction[] };
  }
  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    const transactions = Array.isArray(record.transactions)
      ? (record.transactions as CreditTransaction[])
      : [];
    const pagination = (record.pagination as Pagination | undefined) ?? undefined;
    return { transactions, pagination };
  }
  return { transactions: [] };
}

/** Permanently delete the authenticated user's account (DELETE /user). */
export async function deleteAccount(api: ApiClient): Promise<void> {
  await api.delete<unknown>('/user');
}
