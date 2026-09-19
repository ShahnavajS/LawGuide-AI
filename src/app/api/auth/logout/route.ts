import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, hasSameOrigin } from '@/lib/auth/http';
import { revokeSessionToken } from '@/lib/auth/service';
import { SESSION_COOKIE } from '@/lib/security/workspace-auth';

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } }, { status: 403 });
  }

  revokeSessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  const isJson = request.headers.get('content-type')?.includes('application/json') ||
                 request.headers.get('accept')?.includes('application/json');

  if (isJson) {
    const response = NextResponse.json({ ok: true, redirect: '/' });
    clearSessionCookie(response, request);
    return response;
  }

  const response = NextResponse.redirect(new URL('/', request.url), 303);
  clearSessionCookie(response, request);
  return response;
}
