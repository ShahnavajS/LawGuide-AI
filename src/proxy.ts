import { NextRequest, NextResponse } from 'next/server';
import { authConfiguration, readSessionToken, SESSION_COOKIE } from '@/lib/security/workspace-auth';
import { rateLimiter } from '@/lib/security/rate-limiter';

const PUBLIC_PAGES = new Set(['/', '/demo', '/legal-info', '/login', '/signup']);
const PUBLIC_API_ROUTES = new Set([
  '/api/health',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/signup',
  '/api/auth/me',
  '/api/legal-info/topics',
  '/api/legal-info/legal-aid',
]);

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PAGES.has(pathname) ||
    PUBLIC_API_ROUTES.has(pathname) ||
    pathname.startsWith('/api/legal-info/topics/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/pdf.worker.min.mjs' ||
    (!pathname.startsWith('/api/') && /\.[a-zA-Z0-9]{2,8}$/.test(pathname))
  );
}

function validSignedSession(request: NextRequest, secret: string): string | null {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return readSessionToken(token, secret) ? token || null : null;
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const auth = authConfiguration();
  const isPublic = isPublicPath(pathname);

  if (!auth.configured) {
    if (isPublic) return NextResponse.next();
    return new NextResponse('Private workspace access is not configured.', { status: 503 });
  }

  const session = validSignedSession(request, auth.secret);
  if ((pathname === '/login' || pathname === '/signup') && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  if (isPublic) return NextResponse.next();

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Sign in to access your workspace.' } },
        { status: 401 }
      );
    }
    const url = new URL('/login', request.url);
    url.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith('/api/')) {
    const limit = rateLimiter.check(session, 'standard_api');
    if (!limit.allowed) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests.' } },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
      );
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.get('origin');
      try {
        if (origin) {
          const originHost = new URL(origin).host;
          const allowedHosts = new Set([
            request.headers.get('host'),
            request.headers.get('x-forwarded-host'),
            request.nextUrl.host,
          ].filter(Boolean));
          if (!allowedHosts.has(originHost)) {
            return new NextResponse('Forbidden', { status: 403 });
          }
        }
      } catch {
        return new NextResponse('Forbidden', { status: 403 });
      }
    }
  }

  return NextResponse.next();
}

export const config = { matcher: '/:path*' };
