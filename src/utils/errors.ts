/**
 * Typed errors thrown by services. Services NEVER call process.exit —
 * only src/index.ts maps errors to exit codes.
 */

/** Exit codes used by the CLI entry point. */
export const EXIT_CODES = {
  OK: 0,
  GENERIC: 1,
  VALIDATION: 2,
  AUTH: 3,
  NOT_FOUND: 4,
  PREMIUM_REQUIRED: 5,
  INSUFFICIENT_CREDITS: 6,
  NETWORK: 7,
} as const;

export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number = EXIT_CODES.GENERIC) {
    super(message);
    this.name = new.target.name;
    this.exitCode = exitCode;
  }
}

/** Generic API failure (unexpected status code or malformed response). */
export class ApiError extends CliError {
  readonly statusCode: number | undefined;

  constructor(message: string, statusCode?: number, exitCode: number = EXIT_CODES.GENERIC) {
    super(message, exitCode);
    this.statusCode = statusCode;
  }
}

/** 400 — request validation failed. */
export class ValidationError extends ApiError {
  constructor(message: string) {
    super(message, 400, EXIT_CODES.VALIDATION);
  }
}

/** 401 — missing/invalid API key. */
export class AuthError extends ApiError {
  constructor(message = 'Unauthorized. Run `clipugc auth login` with a valid API key.') {
    super(message, 401, EXIT_CODES.AUTH);
  }
}

/** 404 — resource not found. */
export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found.') {
    super(message, 404, EXIT_CODES.NOT_FOUND);
  }
}

/** 1002 — premium subscription required. */
export class PremiumRequiredError extends ApiError {
  constructor(message = 'This feature requires a premium subscription. Upgrade at https://clipugc.com') {
    super(message, 1002, EXIT_CODES.PREMIUM_REQUIRED);
  }
}

/** 1003 — insufficient credits. */
export class InsufficientCreditsError extends ApiError {
  constructor(message = 'Insufficient credits. Top up at https://clipugc.com') {
    super(message, 1003, EXIT_CODES.INSUFFICIENT_CREDITS);
  }
}

/** Network-level failure (server unreachable, DNS, timeout). */
export class NetworkError extends CliError {
  constructor(message: string) {
    super(message, EXIT_CODES.NETWORK);
  }
}

/** User aborted an interactive confirmation. */
export class AbortedError extends CliError {
  constructor(message = 'Aborted.') {
    super(message, EXIT_CODES.OK);
  }
}
