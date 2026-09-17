import { NextRequest, NextResponse } from 'next/server';
import { LegalInformationService } from '@/lib/legal-info/service';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ topicId: string }> }
) {
  try {
    const { topicId } = await context.params;
    if (!topicId) {
      return NextResponse.json(
        { success: false, error: 'Topic ID is required.' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get('docId') || searchParams.get('documentId') || undefined;
    const comparisonId = searchParams.get('comparisonId') || undefined;
    const country = searchParams.get('country') || undefined;
    const region = searchParams.get('region') || undefined;
    const force = searchParams.get('force') === 'true';

    const service = new LegalInformationService();
    const dossier = await service.getLegalInformation({
      topic: topicId,
      documentId,
      comparisonId,
      userJurisdiction: country ? { country, region } : undefined,
      force,
    });

    return NextResponse.json({
      success: true,
      dossier,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve legal topic dossier.';
    const status = msg.includes('Unknown legal topic') ? 404 : 500;
    return NextResponse.json(
      {
        success: false,
        error: msg,
      },
      { status }
    );
  }
}
