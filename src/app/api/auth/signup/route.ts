import { NextRequest, NextResponse } from 'next/server';
import { createAccount, createUserSession } from '@/lib/auth/service';
import { hasSameOrigin, readAuthForm, safeNextPath, setSessionCookie } from '@/lib/auth/http';
import { rateLimiter } from '@/lib/security/rate-limiter';

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return new NextResponse('Forbidden', { status: 403 });
  const limit = rateLimiter.check('account-signup', 'login');
  if (!limit.allowed) {
    return new NextResponse('Too many attempts. Try again shortly.', {
      status: 429,
      headers: { 'Retry-After': String(limit.retryAfterSeconds) },
    });
  }

  const form = await readAuthForm(request);
  if (!form) return new NextResponse('Invalid sign-up form.', { status: 400 });
  const next = safeNextPath(form.get('next'));
  const password = form.get('password') || '';
  if (password !== form.get('confirmPassword')) {
    return NextResponse.redirect(new URL('/signup?error=password-match', request.url), 303);
  }

  try {
    const user = await createAccount({
      name: form.get('name') || '',
      email: form.get('email') || '',
      password,
    });
    const session = createUserSession(user.id);
    const response = NextResponse.redirect(new URL(next, request.url), 303);
    setSessionCookie(response, request, session.token);
    return response;
  } catch (error) {
    const code = error instanceof Error && error.message.includes('already exists') ? 'exists' : 'invalid';
    return NextResponse.redirect(new URL(`/signup?error=${code}`, request.url), 303);
  }
}
