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
            message: `Too many request attempts. Please wait ${limit.retryAfterSeconds}s before retrying.`,
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

    const service = getMatterService();
    const result = await service.generateCounselQuestions(matterId);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}
