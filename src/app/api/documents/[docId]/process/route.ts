import { apiErrorResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/route';
import { NextRequest, NextResponse } from 'next/server';
import { getDocumentService } from '@/lib/document/service';

interface RouteContext {
  params: Promise<{ docId: string }>;
}

async function POSTHandler(_request: NextRequest, context: RouteContext) {
  try {
    const { docId } = await context.params;
    const service = getDocumentService();
    const result = await service.processDocument(docId);
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export const POST = withAuth(POSTHandler);
