import { NextRequest, NextResponse } from 'next/server';
import { createAccount, createUserSession } from '@/lib/auth/service';
import { hasSameOrigin, readAuthForm, safeNextPath, setSessionCookie } from '@/lib/auth/http';
import { rateLimiter } from '@/lib/security/rate-limiter';
import { validateAccountInput } from '@/lib/auth/password';

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Forbidden request origin.' } }, { status: 403 });
  }

  const isJson = request.headers.get('content-type')?.includes('application/json') ||
                 request.headers.get('accept')?.includes('application/json');

  const limit = rateLimiter.check('account-signup', 'login');
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

  let name = '';
  let email = '';
  let password = '';
  let confirmPassword = '';
  let next = '/dashboard';

  if (request.headers.get('content-type')?.includes('application/json')) {
    try {
      const body = await request.json();
      name = String(body.name || '').trim();
      email = String(body.email || '').trim();
      password = String(body.password || '');
      confirmPassword = String(body.confirmPassword || '');
      next = safeNextPath(body.next);
    } catch {
      return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body.' } }, { status: 400 });
    }
  } else {
    const form = await readAuthForm(request);
    if (!form) {
      if (isJson) return NextResponse.json({ error: { code: 'INVALID_FORM', message: 'Invalid form submission.' } }, { status: 400 });
      return new NextResponse('Invalid sign-up form.', { status: 400 });
    }
    name = (form.get('name') || '').trim();
    email = (form.get('email') || '').trim();
    password = form.get('password') || '';
    confirmPassword = form.get('confirmPassword') || '';
    next = safeNextPath(form.get('next'));
  }

  if (password !== confirmPassword) {
    if (isJson) {
      return NextResponse.json({ error: { code: 'PASSWORD_MISMATCH', message: 'The two passwords do not match.' } }, { status: 400 });
    }
    return NextResponse.redirect(new URL('/signup?error=password-match', request.url), 303);
  }

  const inputError = validateAccountInput(name, email, password);
  if (inputError) {
    if (isJson) {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: inputError } }, { status: 400 });
    }
    const errCode = inputError.includes('Password') ? 'password-requirements' : (inputError.includes('email') ? 'email-invalid' : 'invalid');
    return NextResponse.redirect(new URL(`/signup?error=${errCode}`, request.url), 303);
  }

  try {
    const user = await createAccount({ name, email, password });
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
    const message = error instanceof Error ? error.message : 'Failed to create account.';
    const isExists = message.includes('already exists');
    const isSecretMissing = message.includes('APP_SESSION_SECRET');
    const publicMessage = isExists
      ? 'An account with this email already exists.'
      : isSecretMissing
        ? 'Authentication is temporarily unavailable.'
        : 'Could not create the account. Please try again.';

    if (isJson) {
      const status = isExists ? 409 : (isSecretMissing ? 503 : 400);
      const code = isExists ? 'ACCOUNT_EXISTS' : (isSecretMissing ? 'SERVER_NOT_CONFIGURED' : 'CREATE_FAILED');
      return NextResponse.json({ error: { code, message: publicMessage } }, { status });
    }

    const errCode = isExists ? 'exists' : (isSecretMissing ? 'server-error' : 'invalid');
    return NextResponse.redirect(new URL(`/signup?error=${errCode}`, request.url), 303);
  }
}
