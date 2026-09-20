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
    const query = searchParams.get('q') || searchParams.get('query') || '';

    if (!query.trim()) {
      throw new ValidationError('Search query parameter "q" is required.');
    }

    const service = getMatterService();
    const searchResults = await service.searchMatter(matterId, query);

    return NextResponse.json(searchResults, { status: 200 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export const GET = withAuth(GETHandler);
