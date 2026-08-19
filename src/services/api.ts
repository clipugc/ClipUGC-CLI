import type { ApiEnvelope } from '../types/index.js';
import { APP_CODES } from '../types/index.js';
import {
  ApiError,
  AuthError,
  InsufficientCreditsError,
  NetworkError,
  NotFoundError,
  PremiumRequiredError,
  ValidationError,
} from '../utils/errors.js';
import { resolveApiBaseUrl, resolveApiKey } from '../utils/config.js';

export interface RequestOptions {
  /** JSON body (POST/PATCH). */
  body?: unknown;
  /** Multipart body (file uploads). Mutually exclusive with body. */
  form?: FormData;
  /** Query string params; undefined/null values are dropped. */
  query?: Record<string, string | number | boolean | undefined | null>;
}

export interface ApiResult<T> {
  data: T;
  message: string | null;
}

/**
 * Thin fetch client for the ClipUGC REST API.
 * Unwraps the {statusCode, errorMessage, data, message} envelope and throws
 * typed errors — it never exits the process.
 */
export class ApiClient {
  constructor(
    readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return (await this.request<T>('GET', path, options)).data;
  }

  async post<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return (await this.request<T>('POST', path, options)).data;
  }

  /** POST multipart/form-data (file uploads). fetch sets the boundary header itself. */
  async postForm<T>(path: string, form: FormData): Promise<T> {
    return (await this.request<T>('POST', path, { form })).data;
  }

  async patch<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return (await this.request<T>('PATCH', path, options)).data;
  }

  async delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return (await this.request<T>('DELETE', path, options)).data;
  }

  /** Full request returning both data and the envelope message. */
  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
    const url = this.buildUrl(path, options.query);

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    // For FormData, fetch sets Content-Type (with boundary) itself.
    if (options.body !== undefined && options.form === undefined) headers['Content-Type'] = 'application/json';

    const body = options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined);
    // Retry idempotent reads on transient failures (network blips, rate limits,
    // gateway/5xx while the server is briefly saturated).
    const retryable = method === 'GET' || method === 'HEAD';
    const transientStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);
    const maxAttempts = retryable ? 4 : 1;

    let response: Response | undefined;
    let lastNetworkErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        response = await fetch(url, { method, headers, body });
      } catch (err) {
        lastNetworkErr = err;
        response = undefined;
      }
      if (response && !(retryable && transientStatuses.has(response.status))) break;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 800 * attempt)); // 0.8s, 1.6s, 2.4s
      }
    }
    if (!response) {
      const reason = lastNetworkErr instanceof Error ? lastNetworkErr.message : String(lastNetworkErr);
      throw new NetworkError(`Could not reach ClipUGC API at ${this.baseUrl} (${reason}). Is the server up? Check \`clipugc config get apiBaseUrl\`.`);
    }

    let envelope: ApiEnvelope<T>;
    try {
      envelope = (await response.json()) as ApiEnvelope<T>;
    } catch {
      throw new ApiError(`Unexpected non-JSON response from API (HTTP ${response.status}).`, response.status);
    }

    if (envelope.statusCode === undefined) {
      // Not the standard envelope (e.g. framework-level 401/422/500 JSON)
      if (response.status === 401) throw new AuthError();
      if (response.status === 422) {
        // Laravel validation error: { message, errors: { field: [msgs] } }
        const raw = envelope as unknown as { message?: string; errors?: Record<string, string[]> };
        const details = raw.errors ? Object.values(raw.errors).flat().join(' ') : '';
        throw new ValidationError(details || raw.message || 'The request was invalid (HTTP 422).');
      }
      throw new ApiError(`Unexpected API response (HTTP ${response.status}).`, response.status);
    }

    return this.unwrap(envelope);
  }

  private unwrap<T>(envelope: ApiEnvelope<T>): ApiResult<T> {
    const { statusCode, errorMessage, data, message } = envelope;

    if (statusCode === APP_CODES.OK || statusCode === APP_CODES.CREATED) {
      return { data, message: message ?? null };
    }

    const msg = errorMessage || message || `API error (code ${statusCode})`;

    switch (statusCode) {
      case APP_CODES.VALIDATION:
        throw new ValidationError(msg);
      case APP_CODES.UNAUTHORIZED:
        throw new AuthError(errorMessage || undefined);
      case APP_CODES.NOT_FOUND:
        throw new NotFoundError(errorMessage || undefined);
      case APP_CODES.PREMIUM_REQUIRED:
        throw new PremiumRequiredError(errorMessage || undefined);
      case APP_CODES.INSUFFICIENT_CREDITS: {
        const detail = errorMessage ? ` ${errorMessage}` : '';
        throw new InsufficientCreditsError(
          `Insufficient credits.${detail} Check your balance with \`clipugc credits\`.`,
        );
      }
      default:
        throw new ApiError(msg, statusCode);
    }
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const base = this.baseUrl.replace(/\/+$/, '');
    const p = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(base + p);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }
}

/**
 * Build a client from persisted config/env. Throws AuthError when no API key
 * is available (unless allowAnonymous — used by `auth login` itself).
 */
export async function createApiClient(opts: { allowAnonymous?: boolean; apiKey?: string } = {}): Promise<ApiClient> {
  const baseUrl = await resolveApiBaseUrl();
  const apiKey = opts.apiKey ?? (await resolveApiKey());
  if (!apiKey && !opts.allowAnonymous) {
    throw new AuthError('Not logged in. Create an API key in your ClipUGC dashboard, then run `clipugc auth login`.');
  }
  return new ApiClient(baseUrl, apiKey);
}
