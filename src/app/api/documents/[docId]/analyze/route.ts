import { apiErrorResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/route';
import { NextRequest, NextResponse } from 'next/server';
import { getAnalysisService } from '@/lib/analysis/service';
import { rateLimiter, getClientIdentifier } from '@/lib/security/rate-limiter';
import { runSingleFlight } from '@/lib/utils/single-flight';

interface RouteContext {
  params: Promise<{ docId: string }>;
}

async function POSTHandler(request: NextRequest, context: RouteContext) {
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
    const analysis = await runSingleFlight(
      `${clientIp}:analysis:${docId}`,
      () => service.analyzeDocument(docId, { force })
    );
    return NextResponse.json({ analysis });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function GETHandler(_request: NextRequest, context: RouteContext) {
  try {
    const { docId } = await context.params;
    const service = getAnalysisService();
    const analysis = await service.getAnalysis(docId);
    return NextResponse.json({ analysis });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export const POST = withAuth(POSTHandler);
export const GET = withAuth(GETHandler);
