import { withAuth } from '@/lib/auth/route';
import { NextRequest, NextResponse } from 'next/server';
import { getMatterService } from '@/lib/matter/service';
import { formatSafeError, AppError, ValidationError } from '@/lib/utils/errors';
import { ActionItemStatus, ActionItemPriority, ActionItemType } from '@/lib/ai/safety';

async function GETHandler(
  request: NextRequest,
  { params }: { params: Promise<{ matterId: string }> }
) {
  try {
    const { matterId } = await params;
    if (!matterId) {
      throw new ValidationError('Matter ID is required.');
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as ActionItemStatus | null;
    const priority = searchParams.get('priority') as ActionItemPriority | null;
    const itemType = searchParams.get('itemType') as ActionItemType | null;

    const service = getMatterService();
    const items = await service.getActionItems(matterId, {
      status: status || undefined,
      priority: priority || undefined,
      itemType: itemType || undefined,
    });

    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}

async function POSTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ matterId: string }> }
) {
  try {
    const { matterId } = await params;
    if (!matterId) {
      throw new ValidationError('Matter ID is required.');
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Invalid JSON request body.');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ValidationError('Action item details must be a JSON object.');
    }

    const service = getMatterService();
    const item = await service.createActionItem(
      matterId,
      { ...body, sourceType: 'USER_CREATED', userProvided: true } as unknown as import('@/lib/ai/schemas').CreateActionItemInput
    );

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}

export const GET = withAuth(GETHandler);
export const POST = withAuth(POSTHandler);
