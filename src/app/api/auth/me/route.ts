import { NextRequest, NextResponse } from 'next/server';
import { authenticateSessionToken } from '@/lib/auth/service';
import { SESSION_COOKIE } from '@/lib/security/workspace-auth';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = authenticateSessionToken(token);
  return NextResponse.json({ user: user || null }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
