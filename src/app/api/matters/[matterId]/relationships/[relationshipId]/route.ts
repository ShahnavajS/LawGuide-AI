import { apiErrorResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/route';
import { NextRequest, NextResponse } from 'next/server';
import { getMatterService } from '@/lib/matter/service';
import { ValidationError } from '@/lib/utils/errors';

async function PATCHHandler(
  request: NextRequest,
  { params }: { params: Promise<{ matterId: string; relationshipId: string }> }
) {
  try {
    const { matterId, relationshipId } = await params;
    if (!matterId || !relationshipId) {
      throw new ValidationError('Matter ID and Relationship ID are required.');
    }

    let body: {
      status?: 'CONFIRMED' | 'REJECTED';
    };

    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Invalid JSON request body.');
    }

    if (!body.status || (body.status !== 'CONFIRMED' && body.status !== 'REJECTED')) {
      throw new ValidationError('Status must be either CONFIRMED or REJECTED.');
    }

    const service = getMatterService();
    const updated = await service.confirmRelationship(matterId, relationshipId, body.status);

    return NextResponse.json({ relationship: updated }, { status: 200 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export const PATCH = withAuth(PATCHHandler);
