/**
 * Shared types for the ClipUGC CLI.
 *
 * NOTE (subagent contract): group-specific request/response types live in the
 * corresponding service file (e.g. src/services/characters.service.ts).
 * Only genuinely shared, cross-group types belong here.
 */

/** Persisted CLI configuration (~/.config/clipugc/config.json). */
export interface ClipUgcConfig {
  /** API base URL, e.g. https://clipugc.com/api/v1 */
  apiBaseUrl: string;
  /** Sanctum personal access token created from the ClipUGC dashboard. */
  apiKey: string;
  /** Email of the authenticated user (cached at login for `auth status`). */
  email: string;
}

/** Standard ClipUGC API response envelope. Every response is HTTP 200. */
export interface ApiEnvelope<T = unknown> {
  statusCode: number;
  errorMessage: string | null;
  data: T;
  message: string | null;
}

/** Pagination block returned inside `data.pagination`. */
export interface Pagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  has_more_pages: boolean;
}

export interface Paginated<T> {
  items: T[];
  pagination?: Pagination;
}

/** Long-running resource statuses. */
export type ResourceStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** App-level status codes used by the API envelope. */
export const APP_CODES = {
  OK: 200,
  CREATED: 201,
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  PREMIUM_REQUIRED: 1002,
  INSUFFICIENT_CREDITS: 1003,
} as const;
