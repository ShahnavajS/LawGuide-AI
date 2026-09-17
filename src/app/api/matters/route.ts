import { NextRequest, NextResponse } from 'next/server';
import { getMatterService } from '@/lib/matter/service';
import { formatSafeError, AppError, ValidationError } from '@/lib/utils/errors';

export async function POST(request: NextRequest) {
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

    const { title, description, jurisdiction, jurisdictionProvenance } = body;
    if (!title || !title.trim()) {
      throw new ValidationError('Matter title is required.');
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

export async function GET(request: NextRequest) {
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
