import { apiErrorResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/route';
import { NextRequest, NextResponse } from 'next/server';
import { getMatterService } from '@/lib/matter/service';
import { ValidationError } from '@/lib/utils/errors';

async function GETHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ matterId: string }> }
) {
  try {
    const { matterId } = await params;
    if (!matterId) {
      throw new ValidationError('Matter ID is required.');
    }

    const service = getMatterService();
    const notes = await service.getNotes(matterId);

    return NextResponse.json({ notes }, { status: 200 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function POSTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ matterId: string }> }
) {
  try {
    const { matterId } = await params;
    if (!matterId) {
      throw new ValidationError('Matter ID is required.');
    }

    let body: {
      title?: string;
      content?: string;
    };

    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Invalid JSON request body.');
    }

    const { title, content } = body;
    if (!title || !title.trim() || !content || !content.trim()) {
      throw new ValidationError('Note title and content are required.');
    }

    const service = getMatterService();
    const note = await service.addNote(matterId, title, content);

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export const GET = withAuth(GETHandler);
export const POST = withAuth(POSTHandler);
