import { NextRequest, NextResponse } from 'next/server';
import { getAnalysisService } from '@/lib/analysis/service';
import { formatSafeError, AppError } from '@/lib/utils/errors';
import { rateLimiter, getClientIdentifier } from '@/lib/security/rate-limiter';

interface RouteContext {
  params: Promise<{ docId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const clientIp = getClientIdentifier(request);
    const limit = rateLimiter.check(clientIp, 'heavy_ai');
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: {
            message: `Too many requests. Please wait ${limit.retryAfterSeconds}s before retrying.`,
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

    const { docId } = await context.params;
    let force = false;

    try {
      const body = await request.json();
      if (body && typeof body.force === 'boolean') {
        force = body.force;
      }
    } catch {
      // Empty or non-JSON body is acceptable
    }

    const service = getAnalysisService();
    const analysis = await service.analyzeDocument(docId, { force });
    return NextResponse.json({ analysis });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { docId } = await context.params;
    const service = getAnalysisService();
    const analysis = await service.getAnalysis(docId);
    return NextResponse.json({ analysis });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}
