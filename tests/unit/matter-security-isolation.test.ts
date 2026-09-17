/**
 * Unit tests for Phase 10: Matter Security Isolation & Multi-tenant boundary checks.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DocumentService } from '@/lib/document/service';
import { LocalStorageService } from '@/lib/document/storage';
import { AnalysisService } from '@/lib/analysis/service';
import { MatterService } from '@/lib/matter/service';
import { CitationValidator } from '@/lib/evidence/validator';
import { GeminiService } from '@/lib/ai/gemini';
import { NotFoundError } from '@/lib/utils/errors';
import fs from 'fs/promises';
import path from 'path';

function createSamplePdf(content: string = 'Sample text'): Buffer {
  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${content.length + 20} >>
stream
BT
/F1 12 Tf
100 700 Td
(${content}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000234 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
350
%%EOF`;
  return Buffer.from(pdfString);
}

describe('Phase 10: Matter Security & Data Isolation', () => {
  const testStorageDir = path.join(process.cwd(), 'uploads_test_isolation');
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
      // Clean up test directory
    }
  });

  it('prevents cross-matter data leakage in Evidence Ledger and Source Map', async () => {
    // Create Matter 1
    const matter1 = await matterService.createMatter({
      title: 'Company Alpha Acquisition',
    });

    const doc1 = await docService.uploadDocument({
      filename: 'Alpha_NDA.pdf',
      mimeType: 'application/pdf',
      buffer: createSamplePdf('Alpha Secret Agreement. Price is $50,000,000.'),
    });
    await docService.processDocument(doc1.id);

    await matterService.addDocumentToMatter(matter1.id, doc1.id, 'PRIMARY_AGREEMENT');

    await matterService.addNote(
      matter1.id,
      'Alpha Secret Valuation',
      'Confidential valuation notes for Alpha.'
    );

    // Create Matter 2
    const matter2 = await matterService.createMatter({
      title: 'Company Beta Joint Venture',
    });

    const doc2 = await docService.uploadDocument({
      filename: 'Beta_JV.pdf',
      mimeType: 'application/pdf',
      buffer: createSamplePdf('Beta Public Partnership. Terms are standard.'),
    });
    await docService.processDocument(doc2.id);

    await matterService.addDocumentToMatter(matter2.id, doc2.id, 'PRIMARY_AGREEMENT');

    await matterService.addNote(
      matter2.id,
      'Beta Discussion',
      'Discussion with Beta executives.'
    );

    // Verify Matter 1 Ledger does not contain Matter 2 evidence
    const ledger1 = await matterService.getMatterEvidenceLedger(matter1.id);
    expect(ledger1.items.some((i) => i.quotedText?.includes('Beta'))).toBe(false);
    expect(ledger1.items.some((i) => i.documentTitle === 'Beta_JV.pdf')).toBe(false);

    // Verify Matter 2 Ledger does not contain Matter 1 evidence
    const ledger2 = await matterService.getMatterEvidenceLedger(matter2.id);
    expect(ledger2.items.some((i) => i.quotedText?.includes('Alpha'))).toBe(false);
    expect(ledger2.items.some((i) => i.documentTitle === 'Alpha_NDA.pdf')).toBe(false);

    // Verify Source Maps do not leak documents across matters
    const sourceMap1 = await matterService.getMatterSourceMap(matter1.id);
    expect(sourceMap1.documents.some((d) => d.documentId === doc2.id)).toBe(false);

    const sourceMap2 = await matterService.getMatterSourceMap(matter2.id);
    expect(sourceMap2.documents.some((d) => d.documentId === doc1.id)).toBe(false);

    // Verify cross-matter page evidence access is strictly denied
    await expect(
      matterService.getDocumentPageEvidence(matter2.id, doc1.id, 1)
    ).rejects.toThrow(NotFoundError);

    await expect(
      matterService.getDocumentPageEvidence(matter1.id, doc2.id, 1)
    ).rejects.toThrow(NotFoundError);
  });
});
