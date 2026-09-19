import { withAuth } from '@/lib/auth/route';
import { NextRequest, NextResponse } from 'next/server';
import { getMatterService } from '@/lib/matter/service';
import { formatSafeError, AppError, ValidationError } from '@/lib/utils/errors';

async function GETHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ matterId: string }> }
) {
  try {
    const { matterId } = await params;
    if (!matterId) {
      throw new ValidationError('Matter ID is required.');
    }

    const service = getMatterService();
    const matter = await service.getMatter(matterId);

    return NextResponse.json({ matter }, { status: 200 });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}

async function PATCHHandler(
  request: NextRequest,
  { params }: { params: Promise<{ matterId: string }> }
) {
  try {
    const { matterId } = await params;
    if (!matterId) {
      throw new ValidationError('Matter ID is required.');
    }

    let body: {
      title?: string;
      description?: string;
      jurisdiction?: string;
      jurisdictionProvenance?: 'DOCUMENT_EXPLICIT' | 'USER_PROVIDED' | 'NOT_ESTABLISHED';
      status?: 'ACTIVE' | 'ARCHIVED';
    };

    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Invalid JSON request body.');
    }

    const service = getMatterService();
    const matter = await service.updateMatter(matterId, body);

    return NextResponse.json({ matter }, { status: 200 });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}

async function DELETEHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ matterId: string }> }
) {
  try {
    const { matterId } = await params;
    if (!matterId) {
      throw new ValidationError('Matter ID is required.');
    }

    const service = getMatterService();
    await service.deleteMatter(matterId);

    return NextResponse.json({ success: true, message: 'Matter deleted successfully.' }, { status: 200 });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}

export const GET = withAuth(GETHandler);
export const PATCH = withAuth(PATCHHandler);
export const DELETE = withAuth(DELETEHandler);
