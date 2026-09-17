/**
 * Unit & Integration Tests for Matter Search & Matter Q&A (LexiGuide AI Phase 8).
 * Tests Multi-Document Server-Side Page Search and Cross-Document Ask Q&A Safety.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DocumentService } from '@/lib/document/service';
import { LocalStorageService } from '@/lib/document/storage';
import { AnalysisService } from '@/lib/analysis/service';
import { MatterService } from '@/lib/matter/service';
import { CitationValidator } from '@/lib/evidence/validator';
import { GeminiService } from '@/lib/ai/gemini';
import { PROHIBITED_LEGAL_CONCLUSIONS } from '@/lib/ai/safety';
import fs from 'fs/promises';
import path from 'path';

function createSamplePdf(text: string): Buffer {
  const streamContent = `BT /F1 12 Tf 50 700 Td (${text}) Tj ET`;
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
<< /Length ${streamContent.length} >>
stream
${streamContent}
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
0000000350 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
450
%%EOF`;
  return Buffer.from(pdfString);
}

describe('Phase 8: Matter Search & Matter Q&A', () => {
  const testStorageDir = path.join(process.cwd(), 'uploads_test_matter_search');
  let storage: LocalStorageService;
  let docService: DocumentService;
  let analysisService: AnalysisService;
  let matterService: MatterService;

  beforeEach(async () => {
    storage = new LocalStorageService(testStorageDir);
    docService = new DocumentService(storage);

    const offlineGemini = new GeminiService();
    offlineGemini.isConfigured = () => false;

    const validator = new CitationValidator();
    analysisService = new AnalysisService(docService, offlineGemini, validator);
    matterService = new MatterService(
      docService,
      analysisService,
      offlineGemini,
      validator
    );
  });

  afterAll(async () => {
    try {
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch {
      // Clean up
    }
  });

  describe('Multi-Document Server-Side Page Search', () => {
    it('searches across member document pages and highlights snippet matches', async () => {
      const matter = await matterService.createMatter({ title: 'Searchable Matter' });

      const doc1 = await docService.uploadDocument({
        filename: 'Confidentiality_NDA.pdf',
        mimeType: 'application/pdf',
        buffer: createSamplePdf('The recipient shall maintain strict confidentiality of proprietary algorithms.'),
      });
      await docService.processDocument(doc1.id);

      const doc2 = await docService.uploadDocument({
        filename: 'Independent_Contractor_Agreement.pdf',
        mimeType: 'application/pdf',
        buffer: createSamplePdf('Contractor shall invoice for milestone deliverables at end of month.'),
      });
      await docService.processDocument(doc2.id);

      await matterService.addDocumentToMatter(
        matter.id,
        doc1.id,
        'PRIMARY_AGREEMENT'
      );
      await matterService.addDocumentToMatter(
        matter.id,
        doc2.id,
        'SUPPORTING_DOCUMENT'
      );

      // Search for confidentiality
      const results = await matterService.searchMatter(matter.id, 'confidentiality');
      expect(results.query).toBe('confidentiality');
      expect(results.totalMatches).toBeGreaterThanOrEqual(1);

      const doc1Result = results.results.find((r) => r.documentId === doc1.id);
      expect(doc1Result).toBeDefined();
      expect(doc1Result?.documentTitle).toBe(doc1.title);
      expect(doc1Result?.matches.length).toBeGreaterThanOrEqual(1);
      expect(doc1Result?.matches[0].snippet.toLowerCase()).toContain('confidentiality');
      expect(doc1Result?.matches[0].pageNumber).toBe(1);
    });

    it('returns empty matches when query does not appear in any member document', async () => {
      const matter = await matterService.createMatter({ title: 'Empty Search Matter' });
      const doc = await docService.uploadDocument({
        filename: 'Doc_Alpha.pdf',
        mimeType: 'application/pdf',
        buffer: createSamplePdf('Standard general provisions.'),
      });
      await docService.processDocument(doc.id);
      await matterService.addDocumentToMatter(
        matter.id,
        doc.id,
        'PRIMARY_AGREEMENT'
      );

      const results = await matterService.searchMatter(matter.id, 'quantum teleportation protocol');
      expect(results.totalMatches).toBe(0);
      expect(results.results).toHaveLength(0);
    });
  });

  describe('Ask My Matter Q&A & Anti-Adjudication Safety', () => {
    it('answers cross-document questions grounded in member documents', async () => {
      const matter = await matterService.createMatter({ title: 'Q&A Matter' });

      const doc = await docService.uploadDocument({
        filename: 'Service_Level_Agreement.pdf',
        mimeType: 'application/pdf',
        buffer: createSamplePdf('Vendor guarantees 99.9% uptime. Failure results in service credits.'),
      });
      await docService.processDocument(doc.id);
      await analysisService.analyzeDocument(doc.id);

      await matterService.addDocumentToMatter(
        matter.id,
        doc.id,
        'PRIMARY_AGREEMENT'
      );

      const response = await matterService.queryMatter(matter.id, 'What uptime does vendor guarantee?');
      expect(response.answer).toBeDefined();
      expect(response.citations).toBeDefined();
      expect(response.suggestedQuestionsForCounsel.length).toBeGreaterThan(0);
    });

    it('strictly refuses to declare which contract wins or prevails when asked', async () => {
      const matter = await matterService.createMatter({ title: 'Adjudication Question Matter' });

      const doc1 = await docService.uploadDocument({
        filename: 'Contract_1.pdf',
        mimeType: 'application/pdf',
        buffer: createSamplePdf('Notice period is 30 days.'),
      });
      await docService.processDocument(doc1.id);
      await analysisService.analyzeDocument(doc1.id);

      const doc2 = await docService.uploadDocument({
        filename: 'Contract_2.pdf',
        mimeType: 'application/pdf',
        buffer: createSamplePdf('Notice period is 60 days.'),
      });
      await docService.processDocument(doc2.id);
      await analysisService.analyzeDocument(doc2.id);

      await matterService.addDocumentToMatter(
        matter.id,
        doc1.id,
        'PRIMARY_AGREEMENT'
      );
      await matterService.addDocumentToMatter(
        matter.id,
        doc2.id,
        'AMENDMENT'
      );

      // Directly ask who wins / which controls
      const response = await matterService.queryMatter(
        matter.id,
        'Which contract wins: Contract 1 or Contract 2?'
      );

      // Verify answer does NOT claim a winner
      for (const pattern of PROHIBITED_LEGAL_CONCLUSIONS) {
        expect(pattern.test(response.answer)).toBe(false);
      }

      // Verify that it informs user to discuss priority/order of precedence with qualified counsel
      expect(response.answer.toLowerCase()).toMatch(/counsel|legal professional|adjudication|court|order of precedence/);
    });
  });
});
