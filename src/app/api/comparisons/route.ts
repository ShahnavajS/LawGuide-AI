import { withAuth } from '@/lib/auth/route';
import { NextRequest, NextResponse } from 'next/server';
import { getComparisonService } from '@/lib/comparison/service';
import { formatSafeError, AppError, ValidationError } from '@/lib/utils/errors';
import { rateLimiter, getClientIdentifier } from '@/lib/security/rate-limiter';

async function POSTHandler(request: NextRequest) {
  try {
    const clientIp = getClientIdentifier(request);
    const limit = rateLimiter.check(clientIp, 'heavy_ai');
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: {
            message: `Too many comparison requests. Please wait ${limit.retryAfterSeconds}s before retrying.`,
            code: 'RATE_LIMIT_EXCEEDED',
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(limit.retryAfterSeconds),
          },
        }
      );
    }

    let body: { baseDocumentId?: string; targetDocumentId?: string; force?: boolean };
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Invalid JSON request body.');
    }

    const { baseDocumentId, targetDocumentId, force } = body;
    if (!baseDocumentId || typeof baseDocumentId !== 'string') {
      throw new ValidationError('baseDocumentId is required.');
    }
    if (!targetDocumentId || typeof targetDocumentId !== 'string') {
      throw new ValidationError('targetDocumentId is required.');
    }

    const service = getComparisonService();
    const comparison = await service.compareDocuments(baseDocumentId, targetDocumentId, {
      force: Boolean(force),
    });

    return NextResponse.json({ comparison });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}

async function GETHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const baseDocId = searchParams.get('baseDocumentId') || searchParams.get('baseDocId');
    const targetDocId = searchParams.get('targetDocumentId') || searchParams.get('targetDocId');

    if (!baseDocId || !targetDocId) {
      throw new ValidationError('Both baseDocumentId and targetDocumentId query parameters are required.');
    }

    const service = getComparisonService();
    const comparison = await service.getComparisonByDocumentPair(baseDocId, targetDocId);

    return NextResponse.json({ comparison });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}

export const POST = withAuth(POSTHandler);
export const GET = withAuth(GETHandler);
