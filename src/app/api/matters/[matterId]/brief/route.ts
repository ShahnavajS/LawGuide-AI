import { apiErrorResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/route';
import { NextRequest, NextResponse } from 'next/server';
import { getMatterService } from '@/lib/matter/service';
import { ValidationError } from '@/lib/utils/errors';
import { rateLimiter, getClientIdentifier } from '@/lib/security/rate-limiter';
import { runSingleFlight } from '@/lib/utils/single-flight';

async function GETHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ matterId: string }> }
) {
  try {
    const { matterId } = await params;
    if (!matterId) {
      throw new ValidationError('Matter ID is required.');
    }

    const service = getMatterService();
    const brief = await service.getMatterBrief(matterId);

    if (!brief) {
      return NextResponse.json({ brief: null }, { status: 200 });
    }

    return NextResponse.json({ brief }, { status: 200 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function POSTHandler(
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
            message: `Too many brief generation requests. Please wait ${limit.retryAfterSeconds}s before retrying.`,
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

    let force = false;
    try {
      const body = await request.json();
      force = Boolean(body?.force);
    } catch {
      // empty body is fine
    }

    const service = getMatterService();
    const brief = await runSingleFlight(
      `${clientIp}:matter-brief:${matterId}`,
      () => service.generateMatterBrief(matterId, { force })
    );

    return NextResponse.json({ brief }, { status: 200 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export const GET = withAuth(GETHandler);
export const POST = withAuth(POSTHandler);
