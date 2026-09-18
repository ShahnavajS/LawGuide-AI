import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { POST as login } from '@/app/api/auth/login/route';
import { authConfiguration, createWorkspaceSession, isWorkspaceSessionValid, passwordMatches } from '@/lib/security/workspace-auth';

const originalPassword = process.env.APP_ACCESS_PASSWORD;
const originalSecret = process.env.APP_SESSION_SECRET;

afterEach(() => {
  if (originalPassword === undefined) delete process.env.APP_ACCESS_PASSWORD;
  else process.env.APP_ACCESS_PASSWORD = originalPassword;
  if (originalSecret === undefined) delete process.env.APP_SESSION_SECRET;
  else process.env.APP_SESSION_SECRET = originalSecret;
  vi.unstubAllEnvs();
});

describe('private workspace sessions', () => {
  const password = 'a-long-private-test-password';
  const secret = 'a-long-independent-test-secret-at-least-32-characters';
  const now = 1_780_000_000_000;

  it('accepts only a signed, unexpired session', () => {
    const token = createWorkspaceSession(password, secret, now);
    expect(isWorkspaceSessionValid(token, password, secret, now)).toBe(true);
    expect(isWorkspaceSessionValid(token, password, secret, now + 13 * 60 * 60 * 1000)).toBe(false);
    expect(isWorkspaceSessionValid(token, password + 'changed', secret, now)).toBe(false);
    expect(isWorkspaceSessionValid(token, password, secret + 'changed', now)).toBe(false);
    expect(isWorkspaceSessionValid(token.slice(0, -1) + 'x', password, secret, now)).toBe(false);
  });

  it('compares passwords safely', () => {
    expect(passwordMatches(password, password)).toBe(true);
    expect(passwordMatches('wrong', password)).toBe(false);
  });

  it('refuses workspace access when credentials are missing or placeholders', () => {
    delete process.env.APP_ACCESS_PASSWORD;
    delete process.env.APP_SESSION_SECRET;
    vi.stubEnv('NODE_ENV', 'production');
    expect(authConfiguration().configured).toBe(false);
    expect(proxy(new NextRequest('http://localhost:3000/api/documents')).status).toBe(503);

    vi.stubEnv('NODE_ENV', 'test');
    process.env.APP_ACCESS_PASSWORD = 'replace_with_a_long_private_password';
    process.env.APP_SESSION_SECRET = 'replace_with_at_least_32_random_characters';
    expect(proxy(new NextRequest('http://localhost:3000/dashboard')).status).toBe(503);
  });

  it('allows an unconfigured local development workspace', () => {
    delete process.env.APP_ACCESS_PASSWORD;
    delete process.env.APP_SESSION_SECRET;
    vi.stubEnv('NODE_ENV', 'development');
    expect(authConfiguration().required).toBe(false);
    expect(proxy(new NextRequest('http://localhost:3000/dashboard')).status).toBe(200);
  });

  it('does not treat API paths ending in asset extensions as public', () => {
    process.env.APP_ACCESS_PASSWORD = password;
    process.env.APP_SESSION_SECRET = secret;
    expect(proxy(new NextRequest('http://localhost:3000/api/documents/report.svg')).status).toBe(401);
  });

  it('accepts the browser sign-in form and rejects an oversized body without Content-Length', async () => {
    process.env.APP_ACCESS_PASSWORD = password;
    process.env.APP_SESSION_SECRET = secret;
    const headers = { 'content-type': 'application/x-www-form-urlencoded' };
    const accepted = await login(new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST', headers, body: new URLSearchParams({ password }).toString(),
    }));
    expect(accepted.status).toBe(303);
    expect(accepted.headers.get('set-cookie')).toContain('lexiguide_session=');

    const oversizedRequest = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST', headers, body: `password=${'x'.repeat(5000)}`,
    });
    expect(oversizedRequest.headers.get('content-length')).toBeNull();
    const oversized = await login(oversizedRequest);
    expect(oversized.status).toBe(413);
  });
});
