/**
 * Unit & Integration Tests for Preparation API Routes (LexiGuide AI Phase 6).
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET as GET_QUERY } from '@/app/api/preparations/route';
import { GET as GET_BY_ID } from '@/app/api/preparations/[preparationId]/route';
import { PATCH as PATCH_CHECKLIST } from '@/app/api/preparations/[preparationId]/checklist/route';
import { DocumentService } from '@/lib/document/service';
import { LocalStorageService } from '@/lib/document/storage';
import { AnalysisService } from '@/lib/analysis/service';
import { CitationValidator } from '@/lib/evidence/validator';
import { GeminiService } from '@/lib/ai/gemini';
import path from 'path';
import fs from 'fs/promises';

function createApiTestPdf(): Buffer {
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
<< /Length 110 >>
stream
BT
/F1 14 Tf
50 700 Td
(Software License Agreement between DevCorp and Client LLC.) Tj
50 650 Td
(Payment is due within thirty days.) Tj
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
0000000394 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
479
%%EOF`;
  return Buffer.from(pdfString);
}

describe('Phase 6: Preparation API Routes', () => {
  const testStorageDir = path.join(process.cwd(), 'uploads_test_prep_api');
  let storage: LocalStorageService;
  let docService: DocumentService;
  let analysisService: AnalysisService;

  beforeEach(async () => {
    storage = new LocalStorageService(testStorageDir);
    docService = new DocumentService(storage);

    const offlineGemini = new GeminiService();
    offlineGemini.isConfigured = () => false;

    const validator = new CitationValidator();
    analysisService = new AnalysisService(docService, offlineGemini, validator);
  });

  afterAll(async () => {
    try {
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch {
      // Clean up test storage
    }
  });

  describe('POST /api/preparations', () => {
    it('returns 400 when neither documentId nor comparisonId is provided', async () => {
      const req = new NextRequest('http://localhost:3000/api/preparations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error?.message).toContain('At least one of documentId, comparisonId, or matterId is required');
    });

    it('returns 200 and preparation result for an analyzed document', async () => {
      const doc = await docService.uploadDocument({
        filename: 'api_prep_doc.pdf',
        mimeType: 'application/pdf',
        buffer: createApiTestPdf(),
      });
      await docService.processDocument(doc.id);
      await analysisService.analyzeDocument(doc.id);

      const req = new NextRequest('http://localhost:3000/api/preparations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: doc.id,
          purpose: 'Pre-signing consultation review',
          userNotes: ['Check fee structure'],
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.preparation).toBeDefined();
      expect(data.preparation.documentId).toBe(doc.id);
      expect(data.preparation.purpose).toBe('Pre-signing consultation review');
      expect(data.preparation.checklist.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/preparations (by query params)', () => {
    it('returns 400 when no query parameters are provided', async () => {
      const req = new NextRequest('http://localhost:3000/api/preparations', {
        method: 'GET',
      });

      const res = await GET_QUERY(req);
      expect(res.status).toBe(400);
    });

    it('returns cached preparation if document was already prepared', async () => {
      const doc = await docService.uploadDocument({
        filename: 'api_prep_cached.pdf',
        mimeType: 'application/pdf',
        buffer: createApiTestPdf(),
      });
      await docService.processDocument(doc.id);
      await analysisService.analyzeDocument(doc.id);

      // Create preparation first
      const postReq = new NextRequest('http://localhost:3000/api/preparations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id, purpose: 'Query test' }),
      });
      await POST(postReq);

      // Query cached preparation
      const queryReq = new NextRequest(
        `http://localhost:3000/api/preparations?documentId=${doc.id}`,
        { method: 'GET' }
      );
      const res = await GET_QUERY(queryReq);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.preparation).toBeDefined();
      expect(data.preparation.documentId).toBe(doc.id);
    });
  });

  describe('GET /api/preparations/[preparationId]', () => {
    it('returns 200 and preparation for a valid preparation ID', async () => {
      const doc = await docService.uploadDocument({
        filename: 'api_prep_by_id.pdf',
        mimeType: 'application/pdf',
        buffer: createApiTestPdf(),
      });
      await docService.processDocument(doc.id);
      await analysisService.analyzeDocument(doc.id);

      const postReq = new NextRequest('http://localhost:3000/api/preparations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id, purpose: 'ID test' }),
      });
      const postRes = await POST(postReq);
      const postData = await postRes.json();
      const prepId = postData.preparation.id;

      const getReq = new NextRequest(`http://localhost:3000/api/preparations/${prepId}`);
      const res = await GET_BY_ID(getReq, { params: Promise.resolve({ preparationId: prepId }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.preparation.id).toBe(prepId);
    });

    it('returns 404 for non-existent preparation ID', async () => {
      const req = new NextRequest('http://localhost:3000/api/preparations/prep_fake_999');
      const res = await GET_BY_ID(req, { params: Promise.resolve({ preparationId: 'prep_fake_999' }) });

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/preparations/[preparationId]/checklist', () => {
    it('toggles checklist item completion and returns updated checklist state', async () => {
      const doc = await docService.uploadDocument({
        filename: 'api_prep_patch.pdf',
        mimeType: 'application/pdf',
        buffer: createApiTestPdf(),
      });
      await docService.processDocument(doc.id);
      await analysisService.analyzeDocument(doc.id);

      const postReq = new NextRequest('http://localhost:3000/api/preparations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id, purpose: 'Toggle test' }),
      });
      const postRes = await POST(postReq);
      const postData = await postRes.json();
      const prepId = postData.preparation.id;
      const itemId = postData.preparation.checklist[0].id;

      const patchReq = new NextRequest(
        `http://localhost:3000/api/preparations/${prepId}/checklist`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, isCompleted: true }),
        }
      );

      const patchRes = await PATCH_CHECKLIST(patchReq, {
        params: Promise.resolve({ preparationId: prepId }),
      });
      const patchData = await patchRes.json();

      expect(patchRes.status).toBe(200);
      expect(patchData.checklistState[itemId]).toBe(true);
    });
  });
});
