import { NextRequest, NextResponse } from 'next/server';
import { getComparisonService } from '@/lib/comparison/service';
import { formatSafeError, AppError, NotFoundError } from '@/lib/utils/errors';

interface RouteContext {
  params: Promise<{ comparisonId: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { comparisonId } = await context.params;
    const service = getComparisonService();
    const comparison = await service.getComparison(comparisonId);

    if (!comparison) {
      throw new NotFoundError('Comparison');
    }

    return NextResponse.json({ comparison });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}
