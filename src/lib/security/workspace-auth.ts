import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'lexiguide_session';
export const SESSION_SECONDS = 12 * 60 * 60;
const DEV_SESSION_SECRET = 'lexiguide-local-development-session-secret-only';

export interface SessionTokenPayload {
  sessionId: string;
  userId: string;
  expiresAt: number;
}

export function authConfiguration(env: Record<string, string | undefined> = process.env) {
  const suppliedSecret = env.APP_SESSION_SECRET || '';
  const hasStrongSecret = suppliedSecret.length >= 32 && !suppliedSecret.startsWith('replace_with_');
  const useDevelopmentSecret = env.NODE_ENV !== 'production' && !hasStrongSecret;
  return {
    configured: hasStrongSecret || useDevelopmentSecret,
    required: true,
    secret: useDevelopmentSecret ? DEV_SESSION_SECRET : suppliedSecret,
  };
}

export function getSessionSecret(env: Record<string, string | undefined> = process.env): string {
  const config = authConfiguration(env);
  if (config.configured) return config.secret;
  throw new Error('APP_SESSION_SECRET is not configured.');
}

function signature(sessionId: string, userId: string, expiresAt: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`v2.${sessionId}.${userId}.${expiresAt}`)
    .digest('base64url');
}

export function hashSessionId(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex');
}

export function createSessionToken(
  userId: string,
  secret: string,
  now = Date.now(),
  sessionId = randomBytes(32).toString('base64url')
): { token: string; sessionId: string; expiresAt: Date } {
  const expiresAt = new Date(now + SESSION_SECONDS * 1000);
  const expiry = String(Math.floor(expiresAt.getTime() / 1000));
  const supplied = signature(sessionId, userId, expiry, secret);
  return { token: `v2.${sessionId}.${userId}.${expiry}.${supplied}`, sessionId, expiresAt };
}

export function readSessionToken(
  token: string | undefined,
  secret: string,
  now = Date.now()
): SessionTokenPayload | null {
  if (!token || token.length > 500) return null;
  const [version, sessionId, userId, expiresAt, supplied, extra] = token.split('.');
  if (
    version !== 'v2' || extra || !sessionId || !userId || !supplied ||
    !/^[A-Za-z0-9_-]{20,100}$/.test(sessionId) ||
    !/^[A-Za-z0-9_-]{3,100}$/.test(userId) ||
    !/^\d{10,}$/.test(expiresAt || '')
  ) return null;

  const expiry = Number(expiresAt);
  const nowSeconds = Math.floor(now / 1000);
  if (!Number.isSafeInteger(expiry) || expiry <= nowSeconds || expiry > nowSeconds + SESSION_SECONDS) return null;

  const actual = Buffer.from(supplied);
  const expected = Buffer.from(signature(sessionId, userId, expiresAt, secret));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return { sessionId, userId, expiresAt: expiry };
}
