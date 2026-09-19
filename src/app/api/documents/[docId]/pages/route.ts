import { withAuth } from '@/lib/auth/route';
import { NextRequest, NextResponse } from 'next/server';
import { getDocumentService } from '@/lib/document/service';
import { formatSafeError, AppError } from '@/lib/utils/errors';

interface RouteContext {
  params: Promise<{ docId: string }>;
}

async function GETHandler(_request: NextRequest, context: RouteContext) {
  try {
    const { docId } = await context.params;
    const service = getDocumentService();
    const pages = await service.getDocumentPages(docId);
    return NextResponse.json({
      documentId: docId,
      pageCount: pages.length,
      pages,
    });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}

export const GET = withAuth(GETHandler);
