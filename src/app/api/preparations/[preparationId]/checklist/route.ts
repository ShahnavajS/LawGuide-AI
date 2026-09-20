import { apiErrorResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/route';
import { NextRequest, NextResponse } from 'next/server';
import { getPreparationService } from '@/lib/preparation/service';
import { ValidationError } from '@/lib/utils/errors';

async function PATCHHandler(
  request: NextRequest,
  context: { params: Promise<{ preparationId: string }> }
) {
  try {
    const { preparationId } = await context.params;

    if (!preparationId || typeof preparationId !== 'string') {
      throw new ValidationError('Preparation ID is required.');
    }

    let body: { itemId?: string; isCompleted?: boolean };
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Invalid JSON request body.');
    }

    const { itemId, isCompleted } = body;
    if (!itemId || typeof itemId !== 'string') {
      throw new ValidationError('itemId is required.');
    }
    if (typeof isCompleted !== 'boolean') {
      throw new ValidationError('isCompleted must be a boolean.');
    }

    const service = getPreparationService();
    const updatedState = await service.updateChecklistState(preparationId, itemId, isCompleted);

    return NextResponse.json({ checklistState: updatedState }, { status: 200 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export const PATCH = withAuth(PATCHHandler);
