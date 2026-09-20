import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { isTrustedMutationRequest } from '@/lib/security/request-security';

afterEach(() => {
  delete process.env.APP_ORIGIN;
});

function mutation(headers: HeadersInit = {}) {
  return new NextRequest('https://lawguide.example/api/documents', {
    method: 'POST',
    headers,
  });
}

describe('mutation request validation', () => {
  it('requires a same-origin source and the API request marker', () => {
    process.env.APP_ORIGIN = 'https://lawguide.example';
    expect(isTrustedMutationRequest(mutation(), { requireApiHeader: true })).toBe(false);
    expect(isTrustedMutationRequest(mutation({
      origin: 'https://attacker.example',
      'x-lawguide-request': '1',
    }), { requireApiHeader: true })).toBe(false);
    expect(isTrustedMutationRequest(mutation({
      origin: 'https://lawguide.example',
      'sec-fetch-site': 'same-origin',
      'x-lawguide-request': '1',
    }), { requireApiHeader: true })).toBe(true);
  });

  it('uses APP_ORIGIN instead of client-controlled forwarding headers', () => {
    process.env.APP_ORIGIN = 'https://lawguide.example';
    expect(isTrustedMutationRequest(mutation({
      origin: 'https://attacker.example',
      'x-forwarded-host': 'attacker.example',
      'x-lawguide-request': '1',
    }), { requireApiHeader: true })).toBe(false);
  });

  it('accepts protected browser same-origin metadata when proxy headers omit the source', () => {
    process.env.APP_ORIGIN = 'https://lawguide.example';
    expect(isTrustedMutationRequest(mutation({
      'sec-fetch-site': 'same-origin',
      'x-lawguide-request': '1',
    }), { requireApiHeader: true })).toBe(true);
    expect(isTrustedMutationRequest(mutation({
      'sec-fetch-site': 'same-site',
      'x-lawguide-request': '1',
    }), { requireApiHeader: true })).toBe(false);
  });
});
