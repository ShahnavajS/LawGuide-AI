import type { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_SECONDS } from '@/lib/security/workspace-auth';

const MAX_AUTH_FORM_BYTES = 16 * 1024;

export function hasSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const allowedHosts = new Set([
      request.headers.get('host'),
      request.headers.get('x-forwarded-host'),
      request.nextUrl.host,
    ].filter(Boolean));
    return allowedHosts.has(originHost);
  } catch {
    return false;
  }
}

export async function readAuthForm(request: NextRequest): Promise<URLSearchParams | null> {
  if (
    Number(request.headers.get('content-length') || 0) > MAX_AUTH_FORM_BYTES ||
    !request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded') ||
    !request.body
  ) return null;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_AUTH_FORM_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
    return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/dashboard';
  }
  return value;
}

export function setSessionCookie(response: NextResponse, request: NextRequest, token: string): void {
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(request.nextUrl.hostname);
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:' || (process.env.NODE_ENV === 'production' && !isLocal),
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse, request: NextRequest): void {
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(request.nextUrl.hostname);
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:' || (process.env.NODE_ENV === 'production' && !isLocal),
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}
