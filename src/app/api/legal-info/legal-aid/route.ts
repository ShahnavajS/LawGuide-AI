import { NextRequest, NextResponse } from 'next/server';
import { LegalInformationService } from '@/lib/legal-info/service';

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
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve legal aid resources.',
      },
      { status: 500 }
    );
  }
}
