import { withAuth } from '@/lib/auth/route';
import { NextRequest, NextResponse } from 'next/server';
import { getMatterService } from '@/lib/matter/service';
import { formatSafeError, AppError, ValidationError } from '@/lib/utils/errors';

async function POSTHandler(request: NextRequest) {
  try {
    let body: {
      title?: string;
      description?: string;
      jurisdiction?: string;
      jurisdictionProvenance?: 'DOCUMENT_EXPLICIT' | 'USER_PROVIDED' | 'NOT_ESTABLISHED';
    };

    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Invalid JSON request body.');
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ValidationError('Matter details must be a JSON object.');
    }
    const { title, description, jurisdiction, jurisdictionProvenance } = body;
    if (typeof title !== 'string' || !title.trim()) {
      throw new ValidationError('Matter title is required.');
    }
    if ((description !== undefined && typeof description !== 'string') ||
        (jurisdiction !== undefined && typeof jurisdiction !== 'string')) {
      throw new ValidationError('Matter details must be text.');
    }

    const service = getMatterService();
    const matter = await service.createMatter({
      title,
      description,
      jurisdiction,
      jurisdictionProvenance,
    });

    return NextResponse.json({ matter }, { status: 201 });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}

async function GETHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const statusFilter =
      statusParam === 'ACTIVE' || statusParam === 'ARCHIVED' ? statusParam : undefined;

    const service = getMatterService();
    const matters = await service.listMatters(statusFilter);

    return NextResponse.json({ matters }, { status: 200 });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}

export const POST = withAuth(POSTHandler);
export const GET = withAuth(GETHandler);
