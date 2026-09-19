import { withAuth } from '@/lib/auth/route';
import { NextRequest, NextResponse } from 'next/server';
import { getDocumentService } from '@/lib/document/service';
import { formatSafeError, AppError, ValidationError } from '@/lib/utils/errors';
import { MAX_DOCUMENT_FILE_SIZE_BYTES } from '@/lib/document/validation';

async function POSTHandler(request: NextRequest) {
  try {
    const declaredBytes = Number(request.headers.get('content-length') || 0);
    if (declaredBytes > MAX_DOCUMENT_FILE_SIZE_BYTES + 1024 * 1024) {
      return NextResponse.json({ error: { code: 'FILE_TOO_LARGE', message: 'PDF must be 20 MB or smaller.' } }, { status: 413 });
    }
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new ValidationError('Invalid or incomplete multipart upload.');
    }
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        {
          error: {
            message: 'No document file was provided. Please select a PDF file to upload.',
            code: 'MISSING_FILE',
          },
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: { code: 'FILE_TOO_LARGE', message: 'PDF must be 20 MB or smaller.' } }, { status: 413 });
    }

    const filename = (file as File).name || 'document.pdf';
    const mimeType = file.type || 'application/octet-stream';
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const service = getDocumentService();
    const document = await service.uploadDocument({
      filename,
      mimeType,
      buffer,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    const safe = formatSafeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(safe, { status });
  }
}

export const POST = withAuth(POSTHandler);
