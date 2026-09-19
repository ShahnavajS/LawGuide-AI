import { withAuth } from '@/lib/auth/route';
import { NextRequest, NextResponse } from 'next/server';
import { getMatterService } from '@/lib/matter/service';
import { formatSafeError, AppError, ValidationError } from '@/lib/utils/errors';

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
    const classification = searchParams.get('classification') || undefined;
    const verificationStatus = searchParams.get('verificationStatus') || undefined;
    const documentId = searchParams.get('documentId') || undefined;
    const search = searchParams.get('search') || undefined;

    const service = getMatterService();
    const ledger = await service.getMatterEvidenceLedger(matterId, {
      classification,
      verificationStatus,
      documentId,
      search,
    });

    return NextResponse.json(ledger, { status: 200 });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}

export const GET = withAuth(GETHandler);
