import { describe, expect, it } from 'vitest';
import { authenticatedRequest } from '../helpers/authenticated-request';
import { POST } from '@/app/api/documents/upload/route';

describe('document upload API', () => {
  it('returns a client error for incomplete multipart data', async () => {
    const response = await POST(authenticatedRequest('http://localhost:3000/api/documents/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=missing' },
      body: '--missing\r\nContent-Disposition: form-data; name="file"; filename="broken.pdf"\r\n',
    }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('VALIDATION_ERROR');
  });
});
