import { NextRequest, NextResponse } from 'next/server';
import { LegalInformationService } from '@/lib/legal-info/service';
import { formatSafeError, AppError } from '@/lib/utils/errors';
import { runWithOptionalAuth } from '@/lib/auth/route';
import { getOptionalCurrentUser } from '@/lib/auth/context';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ topicId: string }> }
) {
  return runWithOptionalAuth(req, async () => {
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

    if ((documentId || comparisonId) && !getOptionalCurrentUser()) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Sign in to use document context.' } },
        { status: 401 }
      );
    }

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
    const unknownTopic = msg.includes('Unknown legal topic');
    const status = unknownTopic ? 404 : err instanceof AppError ? err.statusCode : 500;
    const payload = unknownTopic
      ? { error: { message: 'The requested legal topic was not found.', code: 'NOT_FOUND' } }
      : formatSafeError(err);
    return NextResponse.json({ success: false, ...payload }, { status });
  }
  });
}
