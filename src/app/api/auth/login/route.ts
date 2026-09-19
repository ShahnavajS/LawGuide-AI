import { NextRequest, NextResponse } from 'next/server';
import { authenticateAccount, createUserSession } from '@/lib/auth/service';
import { hasSameOrigin, readAuthForm, safeNextPath, setSessionCookie } from '@/lib/auth/http';
import { rateLimiter } from '@/lib/security/rate-limiter';

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return new NextResponse('Forbidden', { status: 403 });
  const limit = rateLimiter.check('account-login', 'login');
  if (!limit.allowed) {
    return new NextResponse('Too many attempts. Try again shortly.', {
      status: 429,
      headers: { 'Retry-After': String(limit.retryAfterSeconds) },
    });
  }

  const form = await readAuthForm(request);
  if (!form) return new NextResponse('Invalid sign-in form.', { status: 400 });
  const next = safeNextPath(form.get('next'));
  const user = await authenticateAccount(form.get('email') || '', form.get('password') || '');
  if (!user) {
    const url = new URL('/login', request.url);
    url.searchParams.set('error', 'credentials');
    if (next !== '/dashboard') url.searchParams.set('next', next);
    return NextResponse.redirect(url, 303);
  }

  const session = createUserSession(user.id);
  const response = NextResponse.redirect(new URL(next, request.url), 303);
  setSessionCookie(response, request, session.token);
  return response;
}
