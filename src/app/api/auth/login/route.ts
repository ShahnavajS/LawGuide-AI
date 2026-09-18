import { NextRequest, NextResponse } from 'next/server';
import { authConfiguration, createWorkspaceSession, passwordMatches, SESSION_COOKIE } from '@/lib/security/workspace-auth';
import { rateLimiter } from '@/lib/security/rate-limiter';

export async function POST(request: NextRequest) {
  const auth = authConfiguration();
  if (!auth.configured) return new NextResponse('Private workspace access is not configured.', { status: 503 });
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== request.headers.get('host')) return new NextResponse('Forbidden', { status: 403 });
    } catch {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }
  if (Number(request.headers.get('content-length') || 0) > 4096) return new NextResponse('Request too large', { status: 413 });
  // One shared workspace: limit password guesses globally, independent of caller-controlled IP headers.
  const limit = rateLimiter.check('workspace-login', 'login');
  if (!limit.allowed) return new NextResponse('Too many attempts. Try again shortly.', { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
  let body: FormData;
  try { body = await request.formData(); } catch { return new NextResponse('Invalid sign-in form.', { status: 400 }); }
  const supplied = body.get('password');
  if (typeof supplied !== 'string' || !passwordMatches(supplied, auth.password)) {
    return NextResponse.redirect(new URL('/login?error=1', request.url), 303);
  }
  const response = NextResponse.redirect(new URL('/dashboard', request.url), 303);
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(request.nextUrl.hostname);
  response.cookies.set(SESSION_COOKIE, createWorkspaceSession(auth.password, auth.secret), {
    httpOnly: true, secure: request.nextUrl.protocol === 'https:' || (process.env.NODE_ENV === 'production' && !isLocal),
    sameSite: 'strict', path: '/', maxAge: 12 * 60 * 60,
  });
  return response;
}
