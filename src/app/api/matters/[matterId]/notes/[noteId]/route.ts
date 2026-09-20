import { apiErrorResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/route';
import { NextRequest, NextResponse } from 'next/server';
import { getMatterService } from '@/lib/matter/service';
import { ValidationError } from '@/lib/utils/errors';

async function DELETEHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ matterId: string; noteId: string }> }
) {
  try {
    const { matterId, noteId } = await params;
    if (!matterId || !noteId) {
      throw new ValidationError('Matter ID and Note ID are required.');
    }

    const service = getMatterService();
    await service.deleteNote(matterId, noteId);

    return NextResponse.json({ success: true, message: 'Note deleted successfully.' }, { status: 200 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export const DELETE = withAuth(DELETEHandler);
