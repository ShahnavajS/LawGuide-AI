import { NextRequest, NextResponse } from 'next/server';
import { authenticateAccount, createUserSession } from '@/lib/auth/service';
import { hasSameOrigin, readAuthForm, safeNextPath, setSessionCookie } from '@/lib/auth/http';
import { rateLimiter } from '@/lib/security/rate-limiter';

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } }, { status: 403 });
  }

  const isJson = request.headers.get('content-type')?.includes('application/json') ||
                 request.headers.get('accept')?.includes('application/json');

  const limit = rateLimiter.check('account-login', 'login');
  if (!limit.allowed) {
    if (isJson) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again shortly.' } },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
      );
    }
    return new NextResponse('Too many attempts. Try again shortly.', {
      status: 429,
      headers: { 'Retry-After': String(limit.retryAfterSeconds) },
    });
  }

  let email = '';
  let password = '';
  let next = '/dashboard';

  if (request.headers.get('content-type')?.includes('application/json')) {
    try {
      const body = await request.json();
      email = String(body.email || '').trim();
      password = String(body.password || '');
      next = safeNextPath(body.next);
    } catch {
      return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body.' } }, { status: 400 });
    }
  } else {
    const form = await readAuthForm(request);
    if (!form) {
      if (isJson) return NextResponse.json({ error: { code: 'INVALID_FORM', message: 'Invalid form submission.' } }, { status: 400 });
      return new NextResponse('Invalid sign-in form.', { status: 400 });
    }
    email = (form.get('email') || '').trim();
    password = form.get('password') || '';
    next = safeNextPath(form.get('next'));
  }

  const user = await authenticateAccount(email, password);
  if (!user) {
    if (isJson) {
      return NextResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'The email or password is incorrect.' } },
        { status: 401 }
      );
    }
    const url = new URL('/login', request.url);
    url.searchParams.set('error', 'credentials');
    if (next !== '/dashboard') url.searchParams.set('next', next);
    return NextResponse.redirect(url, 303);
  }

  try {
    const session = createUserSession(user.id);

    if (isJson) {
      const response = NextResponse.json({ ok: true, user, next });
      setSessionCookie(response, request, session.token);
      return response;
    }

    const response = NextResponse.redirect(new URL(next, request.url), 303);
    setSessionCookie(response, request, session.token);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Session creation failed.';
    if (isJson) {
      return NextResponse.json({ error: { code: 'SESSION_ERROR', message } }, { status: 500 });
    }
    const url = new URL('/login?error=server', request.url);
    return NextResponse.redirect(url, 303);
  }
}
