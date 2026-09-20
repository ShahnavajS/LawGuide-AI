import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { EVALUATOR_USER_ID } from '@/lib/auth/constants';
import { getDb, schema } from '@/lib/db';
import {
  createSessionToken,
  getSessionSecret,
  hashSessionId,
  SESSION_COOKIE,
} from '@/lib/security/workspace-auth';
import { API_REQUEST_HEADER } from '@/lib/security/request-security';

const TEST_SESSION_ID = 'route-test-session-identifier-000000000001';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
type NextRequestInit = NonNullable<ConstructorParameters<typeof NextRequest>[1]>;

function authenticatedSessionToken(): string {
  const db = getDb();
  const now = new Date().toISOString();
  db.insert(schema.users).values({
    id: EVALUATOR_USER_ID,
    name: 'Test User',
    email: 'test@lexiguide.local',
    passwordHash: 'test-only-unused-password-hash',
    isDemo: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing().run();

  const created = createSessionToken(
    EVALUATOR_USER_ID,
    getSessionSecret(),
    Date.now(),
    TEST_SESSION_ID
  );
  const sessionId = hashSessionId(created.sessionId);
  db.delete(schema.userSessions).where(eq(schema.userSessions.id, sessionId)).run();
  db.insert(schema.userSessions).values({
    id: sessionId,
    userId: EVALUATOR_USER_ID,
    createdAt: now,
    expiresAt: created.expiresAt.toISOString(),
  }).run();
  return created.token;
}

/** Builds route-test requests that cross the same auth and mutation checks as real clients. */
export function authenticatedRequest(input: string | URL, init: NextRequestInit = {}): NextRequest {
  const url = new URL(input);
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  headers.set('cookie', `${SESSION_COOKIE}=${authenticatedSessionToken()}`);
  if (!SAFE_METHODS.has(method)) {
    headers.set('origin', url.origin);
    headers.set(API_REQUEST_HEADER, '1');
  }
  return new NextRequest(url, { ...init, headers });
}
