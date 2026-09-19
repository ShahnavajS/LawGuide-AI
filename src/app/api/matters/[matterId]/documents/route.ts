import { withAuth } from '@/lib/auth/route';
import { NextRequest, NextResponse } from 'next/server';
import { getMatterService } from '@/lib/matter/service';
import { MatterDocumentRole } from '@/lib/ai/safety';
import { formatSafeError, AppError, ValidationError } from '@/lib/utils/errors';

async function POSTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ matterId: string }> }
) {
  try {
    const { matterId } = await params;
    if (!matterId) {
      throw new ValidationError('Matter ID is required.');
    }

    let body: {
      documentId?: string;
      role?: MatterDocumentRole;
    };

    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Invalid JSON request body.');
    }

    const { documentId, role } = body;
    if (!documentId) {
      throw new ValidationError('Document ID is required.');
    }

    const service = getMatterService();
    const memberDoc = await service.addDocumentToMatter(matterId, documentId, role);

    return NextResponse.json({ document: memberDoc }, { status: 201 });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}

export const POST = withAuth(POSTHandler);
