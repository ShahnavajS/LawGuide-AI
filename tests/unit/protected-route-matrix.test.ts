import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as uploadDocument } from '@/app/api/documents/upload/route';
import { DELETE as deleteDocument } from '@/app/api/documents/[docId]/route';
import { GET as downloadDocument } from '@/app/api/documents/[docId]/file/route';
import { POST as analyzeDocument } from '@/app/api/documents/[docId]/analyze/route';
import { POST as compareDocuments } from '@/app/api/comparisons/route';
import { POST as createMatter } from '@/app/api/matters/route';
import { POST as createPreparation } from '@/app/api/preparations/route';

const context = { params: Promise.resolve({ docId: 'doc_private' }) };

describe('protected API route matrix', () => {
  beforeEach(() => {
  });

  afterEach(() => {
  });

  it('rejects anonymous document, AI, matter, and preparation operations', async () => {
    const cases = [
      uploadDocument(new NextRequest('http://localhost:3000/api/documents/upload', { method: 'POST' })),
      deleteDocument(new NextRequest('http://localhost:3000/api/documents/doc_private', { method: 'DELETE' }), context),
      downloadDocument(new NextRequest('http://localhost:3000/api/documents/doc_private/file'), context),
      analyzeDocument(new NextRequest('http://localhost:3000/api/documents/doc_private/analyze', { method: 'POST' }), context),
      compareDocuments(new NextRequest('http://localhost:3000/api/comparisons', { method: 'POST' })),
      createMatter(new NextRequest('http://localhost:3000/api/matters', { method: 'POST' })),
      createPreparation(new NextRequest('http://localhost:3000/api/preparations', { method: 'POST' })),
    ];

    const responses = await Promise.all(cases);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401, 401, 401]);
  });
});
