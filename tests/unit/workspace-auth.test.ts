import { describe, expect, it } from 'vitest';
import { createWorkspaceSession, isWorkspaceSessionValid, passwordMatches } from '@/lib/security/workspace-auth';

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
});
