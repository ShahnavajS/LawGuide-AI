import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { POST as login } from '@/app/api/auth/login/route';
import {
  authConfiguration,
  createSessionToken,
  readSessionToken,
} from '@/lib/security/workspace-auth';
import { DEFAULT_EVALUATOR_EMAIL, DEFAULT_EVALUATOR_PASSWORD } from '@/lib/auth/constants';

const originalSecret = process.env.APP_SESSION_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.APP_SESSION_SECRET;
  else process.env.APP_SESSION_SECRET = originalSecret;
  delete process.env.TEST_ENFORCE_AUTH;
  vi.unstubAllEnvs();
});

describe('account sessions', () => {
  const secret = 'a-long-independent-test-secret-at-least-32-characters';
  const now = 1_780_000_000_000;

  it('accepts only a signed, unexpired session token', () => {
    const created = createSessionToken('usr_test_123', secret, now, 'session_identifier_at_least_twenty_chars');
    expect(readSessionToken(created.token, secret, now)?.userId).toBe('usr_test_123');
    expect(readSessionToken(created.token, secret, now + 13 * 60 * 60 * 1000)).toBeNull();
    expect(readSessionToken(created.token, `${secret}-changed`, now)).toBeNull();
    expect(readSessionToken(`${created.token.slice(0, -1)}x`, secret, now)).toBeNull();
  });

  it('keeps public information available and fails closed for private workspaces without a secret', () => {
    delete process.env.APP_SESSION_SECRET;
    vi.stubEnv('NODE_ENV', 'production');
    expect(authConfiguration().configured).toBe(false);
    expect(proxy(new NextRequest('http://localhost:3000/')).status).toBe(200);
    expect(proxy(new NextRequest('http://localhost:3000/legal-info')).status).toBe(200);
    expect(proxy(new NextRequest('http://localhost:3000/api/documents')).status).toBe(503);
  });

  it('requires sign-in in local development too', () => {
    process.env.APP_SESSION_SECRET = secret;
    vi.stubEnv('NODE_ENV', 'development');
    expect(proxy(new NextRequest('http://localhost:3000/dashboard')).status).toBe(307);
    expect(proxy(new NextRequest('http://localhost:3000/api/documents')).status).toBe(401);
  });

  it('does not treat protected API paths ending in asset extensions as public', () => {
    process.env.APP_SESSION_SECRET = secret;
    expect(proxy(new NextRequest('http://localhost:3000/api/documents/report.svg')).status).toBe(401);
  });

  it('signs in the evaluator account and rejects oversized forms', async () => {
    process.env.APP_SESSION_SECRET = secret;
    const headers = { 'content-type': 'application/x-www-form-urlencoded' };
    const accepted = await login(new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers,
      body: new URLSearchParams({
        email: DEFAULT_EVALUATOR_EMAIL,
        password: DEFAULT_EVALUATOR_PASSWORD,
      }).toString(),
    }));
    expect(accepted.status).toBe(303);
    expect(accepted.headers.get('set-cookie')).toContain('lexiguide_session=');

    const oversized = await login(new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers,
      body: `email=a%40b.com&password=${'x'.repeat(17 * 1024)}`,
    }));
    expect(oversized.status).toBe(400);
  });
});
