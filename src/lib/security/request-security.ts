import type { NextRequest } from 'next/server';

export const API_REQUEST_HEADER = 'x-lawguide-request';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function expectedOrigin(request: NextRequest): string | null {
  const configured = process.env.APP_ORIGIN?.trim();
  try {
    return new URL(configured || request.nextUrl.origin).origin;
  } catch {
    return null;
  }
}

/**
 * Validates the browser source of state-changing requests. The session cookie is
 * SameSite=Strict; this check adds an explicit origin boundary and a custom
 * header for JavaScript API calls that HTML forms cannot forge cross-site.
 */
export function isTrustedMutationRequest(
  request: NextRequest,
  options: { requireApiHeader?: boolean } = {}
): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') return false;

  const source = request.headers.get('origin') || request.headers.get('referer');
  const allowedOrigin = expectedOrigin(request);
  if (!source || !allowedOrigin) return false;

  try {
    if (new URL(source).origin !== allowedOrigin) return false;
  } catch {
    return false;
  }

  return !options.requireApiHeader || request.headers.get(API_REQUEST_HEADER) === '1';
}
