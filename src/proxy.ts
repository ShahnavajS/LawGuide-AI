import { NextRequest, NextResponse } from 'next/server';
import { authConfiguration, isWorkspaceSessionValid, SESSION_COOKIE } from '@/lib/security/workspace-auth';
import { rateLimiter } from '@/lib/security/rate-limiter';

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/_next/') || pathname === '/favicon.ico' || pathname === '/api/health') return NextResponse.next();

  const auth = authConfiguration();
  if (!auth.required) return NextResponse.next();
  if (!auth.configured) return new NextResponse('Private workspace access is not configured.', { status: 503 });
  if (pathname === '/login' || pathname === '/api/auth/login') return NextResponse.next();

  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (isWorkspaceSessionValid(session, auth.password, auth.secret)) {
    if (pathname.startsWith('/api/')) {
      const limit = rateLimiter.check(session!, 'standard_api');
      if (!limit.allowed) return NextResponse.json({ error: { code: 'RATE_LIMITED', message: 'Too many requests.' } }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
        const origin = request.headers.get('origin');
        if (origin) {
          try {
            if (new URL(origin).host !== request.headers.get('host')) return new NextResponse('Forbidden', { status: 403 });
          } catch {
            return new NextResponse('Forbidden', { status: 403 });
          }
        }
      }
    }
    return NextResponse.next();
  }
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in to access this workspace.' } }, { status: 401 });
  }
  const url = new URL('/login', request.url);
  return NextResponse.redirect(url);
}

export const config = { matcher: '/:path*' };
