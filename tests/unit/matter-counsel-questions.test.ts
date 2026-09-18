/**
 * Unit tests for Counsel Questions Generation & Neutrality (Phase 9).
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DocumentService } from '@/lib/document/service';
import { LocalStorageService } from '@/lib/document/storage';
import { AnalysisService } from '@/lib/analysis/service';
import { MatterService } from '@/lib/matter/service';
import { CitationValidator } from '@/lib/evidence/validator';
import { GeminiService } from '@/lib/ai/gemini';
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

describe('Phase 9: Counsel Questions Generation & Anti-Adjudication Neutrality', () => {
  const testStorageDir = path.join(process.cwd(), 'uploads_test_questions');
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

  it('generates neutral, non-adjudicative counsel questions grounded in matter data', async () => {
    const doc1 = await docService.uploadDocument({
      filename: 'contract-a.pdf',
      mimeType: 'application/pdf',
      buffer: createSamplePdf('Contract A with 30-day termination clause.'),
    });
    await docService.processDocument(doc1.id);

    const doc2 = await docService.uploadDocument({
      filename: 'contract-b.pdf',
      mimeType: 'application/pdf',
      buffer: createSamplePdf('Contract B with immediate termination clause.'),
    });
    await docService.processDocument(doc2.id);

    const matter = await matterService.createMatter({
      title: 'Termination Discrepancy Matter',
    });

    await matterService.addDocumentToMatter(matter.id, doc1.id, 'PRIMARY_AGREEMENT');
    await matterService.addDocumentToMatter(matter.id, doc2.id, 'AMENDMENT');

    const res = await matterService.generateCounselQuestions(matter.id);

    expect(res.matterId).toBe(matter.id);
    expect(res.questions.length).toBeGreaterThan(0);
    expect(res.disclaimer).toBeDefined();

    for (const q of res.questions) {
      expect(q.id).toBeDefined();
      expect(q.category).toBeDefined();
      expect(q.question).toBeDefined();
      expect(q.rationale).toBeDefined();

      // Ensure question is framed neutrally without declaring who wins
      const qLower = q.question.toLowerCase();
      expect(qLower).not.toContain('who wins');
      expect(qLower).not.toContain('which party will prevail');
      expect(qLower).not.toContain('you should sue');
    }
  });

  it('drops model questions with foreign or fabricated citations', async () => {
    const matterA = await matterService.createMatter({ title: 'Counsel matter A' });
    const matterB = await matterService.createMatter({ title: 'Counsel matter B' });
    const docA = await docService.uploadDocument({
      filename: 'alpha.pdf', mimeType: 'application/pdf',
      buffer: createSamplePdf('Alpha source text for counsel.'),
    });
    const docB = await docService.uploadDocument({
      filename: 'beta.pdf', mimeType: 'application/pdf',
      buffer: createSamplePdf('Beta private source text.'),
    });
    await docService.processDocument(docA.id);
    await docService.processDocument(docB.id);
    await matterService.addDocumentToMatter(matterA.id, docA.id);
    await matterService.addDocumentToMatter(matterB.id, docB.id);

    const fakeGemini = {
      isConfigured: () => true,
      generateStructured: async () => [
        { question: 'What does the Beta document require?', sourceType: 'DOCUMENT', documentId: docB.id,
          documentTitle: docB.title, pageNumber: 1, quotedText: 'Beta private source text.' },
        { question: 'Does a fabricated Alpha clause apply?', sourceType: 'DOCUMENT', documentId: docA.id,
          pageNumber: 1, quotedText: 'This clause was never written.' },
        { question: 'What should counsel clarify about the Alpha text?', sourceType: 'DOCUMENT',
          documentId: docA.id, documentTitle: 'Spoofed title', pageNumber: 1,
          quotedText: 'Alpha source text for counsel.', isUserProvided: true },
      ],
    } as unknown as GeminiService;
    const service = new MatterService(docService, analysisService, fakeGemini, new CitationValidator());
    const result = await service.generateCounselQuestions(matterA.id);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].documentId).toBe(docA.id);
    expect(result.questions[0].documentTitle).toBe(docA.title);
    expect(result.questions[0].isUserProvided).toBe(false);
  });
});
