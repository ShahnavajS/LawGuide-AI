import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/security/workspace-auth';

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url), 303);
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 });
  return response;
}
