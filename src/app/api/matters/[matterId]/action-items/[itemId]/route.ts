import { apiErrorResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/route';
import { NextRequest, NextResponse } from 'next/server';
import { getMatterService } from '@/lib/matter/service';
import { ValidationError } from '@/lib/utils/errors';

async function PATCHHandler(
  request: NextRequest,
  { params }: { params: Promise<{ matterId: string; itemId: string }> }
) {
  try {
    const { matterId, itemId } = await params;
    if (!matterId || !itemId) {
      throw new ValidationError('Matter ID and Item ID are required.');
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Invalid JSON request body.');
    }

    const service = getMatterService();
    const item = await service.updateActionItem(
      matterId,
      itemId,
      body as unknown as import('@/lib/ai/schemas').UpdateActionItemInput
    );

    return NextResponse.json({ item }, { status: 200 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function DELETEHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ matterId: string; itemId: string }> }
) {
  try {
    const { matterId, itemId } = await params;
    if (!matterId || !itemId) {
      throw new ValidationError('Matter ID and Item ID are required.');
    }

    const service = getMatterService();
    await service.deleteActionItem(matterId, itemId);

    return NextResponse.json(
      { success: true, message: 'Action item deleted successfully.' },
      { status: 200 }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export const PATCH = withAuth(PATCHHandler);
export const DELETE = withAuth(DELETEHandler);
