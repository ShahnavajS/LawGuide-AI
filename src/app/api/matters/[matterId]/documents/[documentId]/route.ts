import { NextRequest, NextResponse } from 'next/server';
import { getMatterService } from '@/lib/matter/service';
import { MatterDocumentRole } from '@/lib/ai/safety';
import { formatSafeError, AppError, ValidationError } from '@/lib/utils/errors';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ matterId: string; documentId: string }> }
) {
  try {
    const { matterId, documentId } = await params;
    if (!matterId || !documentId) {
      throw new ValidationError('Matter ID and Document ID are required.');
    }

    let body: {
      role?: MatterDocumentRole;
      confirmed?: boolean;
    };

    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Invalid JSON request body.');
    }

    if (!body.role) {
      throw new ValidationError('Role is required.');
    }

    const service = getMatterService();
    const updated = await service.updateDocumentRole(
      matterId,
      documentId,
      body.role,
      body.confirmed ?? true
    );

    return NextResponse.json({ document: updated }, { status: 200 });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ matterId: string; documentId: string }> }
) {
  try {
    const { matterId, documentId } = await params;
    if (!matterId || !documentId) {
      throw new ValidationError('Matter ID and Document ID are required.');
    }

    const service = getMatterService();
    await service.removeDocumentFromMatter(matterId, documentId);

    return NextResponse.json(
      { success: true, message: 'Document removed from matter successfully.' },
      { status: 200 }
    );
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}
