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
    const { buffer, originalFilename } = await service.getDocumentFile(docId);

    // Sanitize filename for Content-Disposition header
    const safeHeaderFilename = originalFilename.replace(/["\r\n\\]/g, '_');

    // Return binary stream as PDF
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeHeaderFilename}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}

export const GET = withAuth(GETHandler);
