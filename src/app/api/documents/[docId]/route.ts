import { apiErrorResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/route';
import { NextRequest, NextResponse } from 'next/server';
import { getDocumentService } from '@/lib/document/service';

interface RouteContext {
  params: Promise<{ docId: string }>;
}

async function GETHandler(_request: NextRequest, context: RouteContext) {
  try {
    const { docId } = await context.params;
    const service = getDocumentService();
    const document = await service.getDocumentById(docId);
    return NextResponse.json({ document });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function DELETEHandler(_request: NextRequest, context: RouteContext) {
  try {
    const { docId } = await context.params;
    const service = getDocumentService();
    const result = await service.deleteDocument(docId);
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export const GET = withAuth(GETHandler);
export const DELETE = withAuth(DELETEHandler);
