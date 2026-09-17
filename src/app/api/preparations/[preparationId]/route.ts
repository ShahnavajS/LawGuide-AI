import { NextRequest, NextResponse } from 'next/server';
import { getPreparationService } from '@/lib/preparation/service';
import { formatSafeError, AppError, ValidationError } from '@/lib/utils/errors';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ preparationId: string }> }
) {
  try {
    const { preparationId } = await context.params;

    if (!preparationId || typeof preparationId !== 'string') {
      throw new ValidationError('Preparation ID is required.');
    }

    const service = getPreparationService();
    const preparation = await service.getPreparation(preparationId);

    if (!preparation) {
      return NextResponse.json(
        { error: { message: 'Preparation brief not found.', code: 'NOT_FOUND' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ preparation }, { status: 200 });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}
