import { NextRequest, NextResponse } from 'next/server';
import { LegalInformationService } from '@/lib/legal-info/service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category');

    const service = new LegalInformationService();
    let topics = service.searchTopics(query);

    if (category) {
      topics = topics.filter((t) => t.category.toLowerCase() === category.toLowerCase());
    }

    return NextResponse.json({
      success: true,
      count: topics.length,
      topics,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve legal topics.',
      },
      { status: 500 }
    );
  }
}
