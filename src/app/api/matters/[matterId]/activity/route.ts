import { apiErrorResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/route';
import { NextRequest, NextResponse } from 'next/server';
import { getMatterService } from '@/lib/matter/service';
import { ValidationError } from '@/lib/utils/errors';

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
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    const service = getMatterService();
    const activity = await service.getActivity(matterId, isNaN(limit) ? 50 : limit);

    return NextResponse.json({ activity }, { status: 200 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export const GET = withAuth(GETHandler);
