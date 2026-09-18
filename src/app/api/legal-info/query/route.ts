import { NextRequest, NextResponse } from 'next/server';
import { LegalInformationService } from '@/lib/legal-info/service';
import { ConceptQuestionRequestSchema } from '@/lib/legal-info/schemas';
import { formatSafeError, AppError, ValidationError } from '@/lib/utils/errors';

export async function POST(req: NextRequest) {
  try {
    if (Number(req.headers.get('content-length') || 0) > 16 * 1024) {
      throw new ValidationError('Question request is too large.');
    }
    const rawBody = await req.json();
    const parseResult = ConceptQuestionRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed.',
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { topic, question, documentId, jurisdiction, contextQuote } = parseResult.data;

    const service = new LegalInformationService();
    const response = await service.answerConceptQuestion({
      topic,
      question,
      documentId,
      userJurisdiction: jurisdiction
        ? { country: jurisdiction.country, region: jurisdiction.region }
        : undefined,
      contextQuote,
    });

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (err: unknown) {
    const unknownTopic = err instanceof Error && err.message.startsWith('Unknown topic');
    const status = unknownTopic ? 404 : err instanceof AppError ? err.statusCode : 500;
    const payload = unknownTopic
      ? { error: { message: 'The requested legal topic was not found.', code: 'NOT_FOUND' } }
      : formatSafeError(err);
    return NextResponse.json({ success: false, ...payload }, { status });
  }
}
