import { NextRequest, NextResponse } from 'next/server';
import { answerDocumentQuestion } from '@/lib/document/query';
import { formatSafeError, AppError, ValidationError } from '@/lib/utils/errors';
import { getClientIdentifier, rateLimiter } from '@/lib/security/rate-limiter';

export async function POST(request: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  try {
    const limit = rateLimiter.check(getClientIdentifier(request), 'heavy_ai');
    if (!limit.allowed) return NextResponse.json({ error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many questions. Try again shortly.' } }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
    if (Number(request.headers.get('content-length') || 0) > 2048) throw new ValidationError('Question request is too large.');
    let body: unknown;
    try { body = await request.json(); } catch { throw new ValidationError('Invalid JSON request body.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof (body as Record<string, unknown>).question !== 'string') throw new ValidationError('A question is required.');
    const { docId } = await params;
    const answer = await answerDocumentQuestion(docId, (body as { question: string }).question);
    return NextResponse.json(answer, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const safe = formatSafeError(error);
    return NextResponse.json(safe, { status: error instanceof AppError ? error.statusCode : 500 });
  }
}
