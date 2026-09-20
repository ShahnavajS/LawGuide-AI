import { apiErrorResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/route';
import { NextRequest, NextResponse } from 'next/server';
import { getMatterService } from '@/lib/matter/service';
import { ValidationError } from '@/lib/utils/errors';

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
    const relationships = await service.extractRelationships(matterId, false);

    return NextResponse.json({ relationships }, { status: 200 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export const GET = withAuth(GETHandler);
