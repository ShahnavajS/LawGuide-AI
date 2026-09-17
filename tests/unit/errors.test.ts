import { describe, it, expect } from 'vitest';
import { AppError, ValidationError, formatSafeError } from '@/lib/utils/errors';

describe('Error Handling Utilities', () => {
  it('instantiates base AppError with custom status code and code', () => {
    const error = new AppError('Custom test error', 403, 'FORBIDDEN');
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.isOperational).toBe(true);
  });

  it('formats operational AppErrors into safe client responses', () => {
    const error = new ValidationError('The specified file exceeds the maximum allowed size of 25MB.');
    const formatted = formatSafeError(error);

    expect(formatted.error.message).toBe('The specified file exceeds the maximum allowed size of 25MB.');
    expect(formatted.error.code).toBe('VALIDATION_ERROR');
  });

  it('masks unexpected raw exceptions with generic message to avoid leaking internals', () => {
    const rawError = new Error('Database connection failed at 192.168.1.50 with password leaked_pwd');
    const formatted = formatSafeError(rawError);

    expect(formatted.error.message).toBe('An unexpected system error occurred. Please try again later.');
    expect(formatted.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(formatted.error.message).not.toContain('192.168.1.50');
    expect(formatted.error.message).not.toContain('leaked_pwd');
  });
});
