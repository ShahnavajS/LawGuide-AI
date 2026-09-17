/**
 * Standardized application error handling.
 * Protects users from internal stack traces and prevents leaking confidential document content.
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(entity = 'Resource') {
    super(`${entity} not found.`, 404, 'NOT_FOUND');
  }
}

export class AIServiceError extends AppError {
  constructor(message = 'An error occurred during AI analysis. Please retry.') {
    super(message, 502, 'AI_SERVICE_ERROR');
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfterSeconds: number;

  constructor(message = 'Too many requests. Please wait before retrying.', retryAfterSeconds = 60) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface SafeErrorResponse {
  error: {
    message: string;
    code: string;
  };
}

/**
 * Scrubs sensitive patterns such as API keys, bearer tokens, full filesystem paths,
 * and database URLs from error messages before exposure to clients or standard logs.
 */
export function sanitizeErrorString(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let sanitized = input;

  // Redact Google / standard API keys
  sanitized = sanitized.replace(/AIza[0-9A-Za-z_-]{20,50}/g, '[REDACTED_API_KEY]');
  sanitized = sanitized.replace(/(?:key|apiKey|api_key)=([A-Za-z0-9_-]+)/gi, 'key=[REDACTED_KEY]');
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED_TOKEN]');

  // Redact database URIs
  sanitized = sanitized.replace(/(?:postgres|mysql|sqlite|mongodb)(?:\+srv)?:\/\/[^\s]+/gi, '[REDACTED_DB_URL]');

  // Redact absolute filesystem paths (Windows: C:\... and Unix: /Users/... or /home/...)
  sanitized = sanitized.replace(/[a-zA-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*/g, '[REDACTED_PATH]');
  sanitized = sanitized.replace(/\/(?:Users|home|var|tmp|etc|app)\/[^\s:]+/g, '[REDACTED_PATH]');

  return sanitized;
}

/**
 * Converts any caught error into a safe client-facing payload.
 * Never outputs raw error objects, stack traces, or sensitive internals in production.
 */
export function formatSafeError(error: unknown): SafeErrorResponse {
  if (error instanceof AppError && error.isOperational) {
    return {
      error: {
        message: sanitizeErrorString(error.message),
        code: error.code,
      },
    };
  }

  // Generic fallback for unhandled or operational errors
  return {
    error: {
      message: 'An unexpected system error occurred. Please try again later.',
      code: 'INTERNAL_SERVER_ERROR',
    },
  };
}
