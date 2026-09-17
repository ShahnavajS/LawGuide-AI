import { NextRequest, NextResponse } from 'next/server';
import { getPreparationService } from '@/lib/preparation/service';
import { formatSafeError, AppError, ValidationError } from '@/lib/utils/errors';

export async function POST(request: NextRequest) {
  try {
    let body: {
      documentId?: string;
      comparisonId?: string;
      matterId?: string;
      purpose?: string;
      userNotes?: string[];
      force?: boolean;
    };

    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Invalid JSON request body.');
    }

    const { documentId, comparisonId, matterId, purpose, userNotes, force } = body;

    if (!documentId && !comparisonId && !matterId) {
      throw new ValidationError('At least one of documentId, comparisonId, or matterId is required.');
    }

    const service = getPreparationService();
    const preparation = await service.generatePreparation({
      documentId,
      comparisonId,
      matterId,
      purpose,
      userNotes,
      force: Boolean(force),
    });

    return NextResponse.json({ preparation }, { status: 200 });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId') || searchParams.get('docId') || undefined;
    const comparisonId = searchParams.get('comparisonId') || searchParams.get('compId') || undefined;
    const matterId = searchParams.get('matterId') || undefined;

    if (!documentId && !comparisonId && !matterId) {
      throw new ValidationError('At least one of documentId, comparisonId, or matterId query parameter is required.');
    }

    const service = getPreparationService();
    const preparation = await service.getPreparationBySource(documentId, comparisonId, matterId);

    return NextResponse.json({ preparation }, { status: 200 });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}
