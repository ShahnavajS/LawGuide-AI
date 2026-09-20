import { NextResponse } from 'next/server';
import { AppError, formatSafeError } from '@/lib/utils/errors';

export function apiErrorResponse(error: unknown): NextResponse {
  return NextResponse.json(formatSafeError(error), {
    status: error instanceof AppError ? error.statusCode : 500,
  });
}
