import { NextRequest, NextResponse } from 'next/server';
import { LegalInformationService } from '@/lib/legal-info/service';
import { formatSafeError } from '@/lib/utils/errors';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const country = searchParams.get('country') || undefined;

    const service = new LegalInformationService();
    const resources = service.getLegalAid(country);

    return NextResponse.json({
      success: true,
      count: resources.length,
      resources,
      disclaimer:
        'LexiGuide provides informational navigation to recognized statutory legal aid organizations. Contact organizations directly to confirm program eligibility.',
    });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, ...formatSafeError(err) }, { status: 500 });
  }
}
