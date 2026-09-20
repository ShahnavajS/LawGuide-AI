import { apiErrorResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/route';
import { NextRequest, NextResponse } from 'next/server';
import { getComparisonService } from '@/lib/comparison/service';
import { NotFoundError } from '@/lib/utils/errors';

interface RouteContext {
  params: Promise<{ comparisonId: string }>;
}

async function GETHandler(_request: NextRequest, context: RouteContext) {
  try {
    const { comparisonId } = await context.params;
    const service = getComparisonService();
    const comparison = await service.getComparison(comparisonId);

    if (!comparison) {
      throw new NotFoundError('Comparison');
    }

    return NextResponse.json({ comparison });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export const GET = withAuth(GETHandler);
