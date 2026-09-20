/**
 * Unit & Integration Tests for Comparison API Routes (LexiGuide AI Phase 5).
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { authenticatedRequest } from '../helpers/authenticated-request';
import { POST, GET as GET_QUERY } from '@/app/api/comparisons/route';
import { GET as GET_BY_ID } from '@/app/api/comparisons/[comparisonId]/route';
import { DocumentService } from '@/lib/document/service';
import { LocalStorageService } from '@/lib/document/storage';
import path from 'path';
import fs from 'fs/promises';

function createBaseTestPdf(): Buffer {
  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 85 >>
stream
BT
/F1 14 Tf
50 700 Td
(11.2 Termination. Either party may terminate with 30 days notice.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000234 00000 n 
0000000369 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
438
%%EOF`;
  return Buffer.from(pdfString);
}

function createTargetTestPdf(): Buffer {
  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 85 >>
stream
BT
/F1 14 Tf
50 700 Td
(11.2 Termination. Either party may terminate with 60 days notice.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000234 00000 n 
0000000369 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
438
%%EOF`;
  return Buffer.from(pdfString);
}

describe('Phase 5: Comparison API Routes', () => {
  const testStorageDir = path.join(process.cwd(), 'uploads_test_api_comparison');
  let storage: LocalStorageService;
  let docService: DocumentService;

  beforeEach(async () => {
    storage = new LocalStorageService(testStorageDir);
    docService = new DocumentService(storage);
  });

  afterAll(async () => {
    try {
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe('POST /api/comparisons', () => {
    it('returns 400 when body is invalid or empty', async () => {
      const req = authenticatedRequest('http://localhost:3000/api/comparisons', {
        method: 'POST',
        body: 'invalid-json',
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('returns 400 when comparing identical document IDs', async () => {
      const req = authenticatedRequest('http://localhost:3000/api/comparisons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseDocumentId: 'doc_same', targetDocumentId: 'doc_same' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('Cannot compare a document to itself');
    });

    it('returns 200 and comparison result when comparing two processed documents', async () => {
      const doc1 = await docService.uploadDocument({
        filename: 'api_base.pdf',
        mimeType: 'application/pdf',
        buffer: createBaseTestPdf(),
      });
      await docService.processDocument(doc1.id);

      const doc2 = await docService.uploadDocument({
        filename: 'api_target.pdf',
        mimeType: 'application/pdf',
        buffer: createTargetTestPdf(),
      });
      await docService.processDocument(doc2.id);

      const req = authenticatedRequest('http://localhost:3000/api/comparisons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseDocumentId: doc1.id, targetDocumentId: doc2.id }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.comparison).toBeDefined();
      expect(data.comparison.baseDocumentId).toBe(doc1.id);
      expect(data.comparison.targetDocumentId).toBe(doc2.id);
      expect(data.comparison.differences.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/comparisons (by query params)', () => {
    it('returns 400 if query params are missing', async () => {
      const req = authenticatedRequest('http://localhost:3000/api/comparisons?baseDocId=123');
      const res = await GET_QUERY(req);
      expect(res.status).toBe(400);
    });

    it('returns cached comparison if pair was already compared', async () => {
      const doc1 = await docService.uploadDocument({
        filename: 'q_base.pdf',
        mimeType: 'application/pdf',
        buffer: createBaseTestPdf(),
      });
      await docService.processDocument(doc1.id);

      const doc2 = await docService.uploadDocument({
        filename: 'q_target.pdf',
        mimeType: 'application/pdf',
        buffer: createTargetTestPdf(),
      });
      await docService.processDocument(doc2.id);

      // Create comparison via POST
      const postReq = authenticatedRequest('http://localhost:3000/api/comparisons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseDocumentId: doc1.id, targetDocumentId: doc2.id }),
      });
      await POST(postReq);

      // Retrieve via GET query
      const getReq = authenticatedRequest(
        `http://localhost:3000/api/comparisons?baseDocumentId=${doc1.id}&targetDocumentId=${doc2.id}`
      );
      const res = await GET_QUERY(getReq);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.comparison).toBeDefined();
      expect(data.comparison.baseDocumentId).toBe(doc1.id);
      expect(data.comparison.targetDocumentId).toBe(doc2.id);
    });
  });

  describe('GET /api/comparisons/[comparisonId]', () => {
    it('returns 404 for non-existent comparison ID', async () => {
      const req = authenticatedRequest('http://localhost:3000/api/comparisons/comp_nonexistent');
      const res = await GET_BY_ID(req, {
        params: Promise.resolve({ comparisonId: 'comp_nonexistent' }),
      });
      expect(res.status).toBe(404);
    });

    it('returns 200 and comparison for valid comparison ID', async () => {
      const doc1 = await docService.uploadDocument({
        filename: 'id_base.pdf',
        mimeType: 'application/pdf',
        buffer: createBaseTestPdf(),
      });
      await docService.processDocument(doc1.id);

      const doc2 = await docService.uploadDocument({
        filename: 'id_target.pdf',
        mimeType: 'application/pdf',
        buffer: createTargetTestPdf(),
      });
      await docService.processDocument(doc2.id);

      const postReq = authenticatedRequest('http://localhost:3000/api/comparisons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseDocumentId: doc1.id, targetDocumentId: doc2.id }),
      });
      const postRes = await POST(postReq);
      const postData = await postRes.json();
      const compId = postData.comparison.id;

      const getReq = authenticatedRequest(`http://localhost:3000/api/comparisons/${compId}`);
      const res = await GET_BY_ID(getReq, {
        params: Promise.resolve({ comparisonId: compId }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.comparison.id).toBe(compId);
    });
  });
});
