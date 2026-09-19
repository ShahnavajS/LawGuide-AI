import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/route';
import { getCurrentUser } from '@/lib/auth/context';

async function GETHandler() {
  return NextResponse.json({ user: getCurrentUser() }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export const GET = withAuth(GETHandler);
