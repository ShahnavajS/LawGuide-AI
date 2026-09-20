import { apiErrorResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/route';
import { NextResponse } from 'next/server';
import { getDocumentService } from '@/lib/document/service';

async function GETHandler() {
  try {
    const service = getDocumentService();
    const documents = await service.getDocuments();
    return NextResponse.json({ documents });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export const GET = withAuth(GETHandler);
