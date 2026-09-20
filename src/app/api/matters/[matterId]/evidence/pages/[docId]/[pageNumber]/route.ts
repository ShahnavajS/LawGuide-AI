import { apiErrorResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/route';
import { NextRequest, NextResponse } from 'next/server';
import { getMatterService } from '@/lib/matter/service';
import { ValidationError } from '@/lib/utils/errors';

async function GETHandler(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      matterId: string;
      docId: string;
      pageNumber: string;
    }>;
  }
) {
  try {
    const { matterId, docId, pageNumber: pageStr } = await params;
    if (!matterId || !docId) {
      throw new ValidationError('Matter ID and Document ID are required.');
    }

    const pageNum = parseInt(pageStr, 10);
    if (isNaN(pageNum) || pageNum <= 0) {
      throw new ValidationError('Valid positive pageNumber is required.');
    }

    const service = getMatterService();
    const pageEvidence = await service.getDocumentPageEvidence(
      matterId,
      docId,
      pageNum
    );

    return NextResponse.json(pageEvidence, { status: 200 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export const GET = withAuth(GETHandler);
