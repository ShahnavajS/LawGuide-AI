import { apiErrorResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/route';
import { NextRequest, NextResponse } from 'next/server';
import { getPreparationService } from '@/lib/preparation/service';
import { ValidationError } from '@/lib/utils/errors';
import { getClientIdentifier } from '@/lib/security/rate-limiter';
import { runSingleFlight } from '@/lib/utils/single-flight';

async function POSTHandler(request: NextRequest) {
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

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ValidationError('Request body must be an object.');
    }

    const { documentId, comparisonId, matterId, purpose, userNotes, force } = body;

    if ([documentId, comparisonId, matterId].some((id) => id !== undefined && (typeof id !== 'string' || !id.trim())) ||
      (purpose !== undefined && (typeof purpose !== 'string' || purpose.length > 2000)) ||
      (userNotes !== undefined && (!Array.isArray(userNotes) || userNotes.length > 10 || userNotes.some((note) => typeof note !== 'string' || note.length > 2000))) ||
      (force !== undefined && typeof force !== 'boolean')) {
      throw new ValidationError('Invalid preparation input.');
    }

    if (!documentId && !comparisonId && !matterId) {
      throw new ValidationError('At least one of documentId, comparisonId, or matterId is required.');
    }

    const service = getPreparationService();
    const clientId = getClientIdentifier(request);
    const sourceKey = matterId || comparisonId || documentId;
    const preparation = await runSingleFlight(
      `${clientId}:preparation:${sourceKey}`,
      () => service.generatePreparation({
        documentId,
        comparisonId,
        matterId,
        purpose,
        userNotes,
        force: Boolean(force),
      })
    );

    return NextResponse.json({ preparation }, { status: 200 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function GETHandler(request: NextRequest) {
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
    return apiErrorResponse(error);
  }
}

export const POST = withAuth(POSTHandler);
export const GET = withAuth(GETHandler);
