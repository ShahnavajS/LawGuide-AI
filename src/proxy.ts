import { NextRequest, NextResponse } from 'next/server';
import { authConfiguration, readSessionToken, SESSION_COOKIE } from '@/lib/security/workspace-auth';
import { rateLimiter } from '@/lib/security/rate-limiter';
import { isTrustedMutationRequest } from '@/lib/security/request-security';

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

function contentSecurityPolicy(nonce: string): string {
  const scripts = [`'self'`, `'nonce-${nonce}'`, `'strict-dynamic'`];
  if (process.env.NODE_ENV !== 'production') scripts.push(`'unsafe-eval'`);
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `style-src 'self' 'nonce-${nonce}'`,
    `style-src-elem 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    `script-src ${scripts.join(' ')}`,
    "worker-src 'self' blob:",
    "connect-src 'self'",
  ].join('; ');
}

function secureResponse(response: NextResponse, policy: string): NextResponse {
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

function continueRequest(request: NextRequest, policy: string, nonce: string): NextResponse {
  const headers = new Headers(request.headers);
  headers.set('Content-Security-Policy', policy);
  headers.set('x-nonce', nonce);
  return secureResponse(NextResponse.next({ request: { headers } }), policy);
}

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PAGES.has(pathname) ||
    PUBLIC_API_ROUTES.has(pathname) ||
    pathname.startsWith('/api/legal-info/topics/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
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
  const nonce = btoa(crypto.randomUUID());
  const policy = contentSecurityPolicy(nonce);

  if (!auth.configured) {
    if (isPublic) return continueRequest(request, policy, nonce);
    return secureResponse(new NextResponse('Private workspace access is not configured.', { status: 503 }), policy);
  }

  const session = validSignedSession(request, auth.secret);
  if ((pathname === '/login' || pathname === '/signup') && session) {
    return secureResponse(NextResponse.redirect(new URL('/dashboard', request.url)), policy);
  }
  if (isPublic) return continueRequest(request, policy, nonce);

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return secureResponse(NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Sign in to access your workspace.' } },
        { status: 401 }
      ), policy);
    }
    const url = new URL('/login', request.url);
    url.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return secureResponse(NextResponse.redirect(url), policy);
  }

  if (pathname.startsWith('/api/')) {
    const limit = rateLimiter.check(session, 'standard_api');
    if (!limit.allowed) {
      return secureResponse(NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests.' } },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
      ), policy);
    }
    if (!isTrustedMutationRequest(request, { requireApiHeader: true })) {
      return secureResponse(new NextResponse('Forbidden', { status: 403 }), policy);
    }
  }

  return continueRequest(request, policy, nonce);
}

export const config = { matcher: '/:path*' };
