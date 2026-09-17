import { NextResponse } from 'next/server';
import { getDocumentService } from '@/lib/document/service';
import { formatSafeError, AppError } from '@/lib/utils/errors';

export async function GET() {
  try {
    const service = getDocumentService();
    const documents = await service.getDocuments();
    return NextResponse.json({ documents });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}
