import { NextRequest, NextResponse } from 'next/server';
import { LegalInformationService } from '@/lib/legal-info/service';
import { ConceptQuestionRequestSchema } from '@/lib/legal-info/schemas';

export async function POST(req: NextRequest) {
  try {
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
    const msg = err instanceof Error ? err.message : 'Failed to process concept question.';
    const status = msg.includes('Unknown topic') ? 404 : 500;
    return NextResponse.json(
      {
        success: false,
        error: msg,
      },
      { status }
    );
  }
}
