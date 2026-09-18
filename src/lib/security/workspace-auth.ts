import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'lexiguide_session';
const SESSION_SECONDS = 12 * 60 * 60;

export function authConfiguration(env: Record<string, string | undefined> = process.env) {
  const password = env.APP_ACCESS_PASSWORD || '';
  const secret = env.APP_SESSION_SECRET || '';
  const configured = password.length >= 16 && secret.length >= 32 &&
    !password.startsWith('replace_with_') && !secret.startsWith('replace_with_');
  const required = env.NODE_ENV === 'production' || Boolean(password || secret);
  return { configured, required, password, secret };
}

function signature(expires: string, password: string, secret: string): string {
  const passwordDigest = createHash('sha256').update(password).digest('hex');
  return createHmac('sha256', secret).update(`v1.${expires}.${passwordDigest}`).digest('base64url');
}

export function passwordMatches(candidate: string, expected: string): boolean {
  const actual = createHash('sha256').update(candidate).digest();
  const wanted = createHash('sha256').update(expected).digest();
  return timingSafeEqual(actual, wanted);
}

export function createWorkspaceSession(password: string, secret: string, now = Date.now()): string {
  const expires = String(Math.floor(now / 1000) + SESSION_SECONDS);
  return `v1.${expires}.${signature(expires, password, secret)}`;
}

export function isWorkspaceSessionValid(token: string | undefined, password: string, secret: string, now = Date.now()): boolean {
  if (!token || token.length > 200) return false;
  const [version, expires, supplied, extra] = token.split('.');
  if (version !== 'v1' || extra || !/^\d{10,}$/.test(expires || '') || !supplied) return false;
  const expiry = Number(expires);
  if (!Number.isSafeInteger(expiry) || expiry <= Math.floor(now / 1000) || expiry > Math.floor(now / 1000) + SESSION_SECONDS) return false;
  const actual = Buffer.from(supplied);
  const expected = Buffer.from(signature(expires, password, secret));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
