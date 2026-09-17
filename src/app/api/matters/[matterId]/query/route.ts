import { NextRequest, NextResponse } from 'next/server';
import { getMatterService } from '@/lib/matter/service';
import { formatSafeError, AppError, ValidationError } from '@/lib/utils/errors';
import { rateLimiter, getClientIdentifier } from '@/lib/security/rate-limiter';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ matterId: string }> }
) {
  try {
    const clientIp = getClientIdentifier(request);
    const limit = rateLimiter.check(clientIp, 'heavy_ai');
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: {
            message: `Too many query requests. Please wait ${limit.retryAfterSeconds}s before retrying.`,
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

    const { matterId } = await params;
    if (!matterId) {
      throw new ValidationError('Matter ID is required.');
    }

    let body: {
      question?: string;
      query?: string;
    };

    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Invalid JSON request body.');
    }

    const questionText = body.question?.trim() || body.query?.trim();
    if (!questionText) {
      throw new ValidationError('Question is required.');
    }

    const service = getMatterService();
    const queryResponse = await service.queryMatter(matterId, questionText);

    return NextResponse.json(queryResponse, { status: 200 });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}
