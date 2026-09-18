import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AnalysisService } from '@/lib/analysis/service';
import { DocumentService } from '@/lib/document/service';
import { LocalStorageService } from '@/lib/document/storage';
import { getDb, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { NotFoundError } from '@/lib/utils/errors';
import fs from 'fs/promises';
import path from 'path';

function createMultiPageTestPdf(): Buffer {
  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 9 0 R >> >> >>
endobj
4 0 obj
<< /Length 54 >>
stream
BT
/F1 18 Tf
50 700 Td
(LexiGuide Test Document. Page 1) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 9 0 R >> >> >>
endobj
6 0 obj
<< /Length 59 >>
stream
BT
/F1 18 Tf
50 700 Td
(Termination. Thirty days notice.) Tj
ET
endstream
endobj
7 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 8 0 R /Resources << /Font << /F1 9 0 R >> >> >>
endobj
8 0 obj
<< /Length 58 >>
stream
BT
/F1 18 Tf
50 700 Td
(Confidentiality. Remain secret.) Tj
ET
endstream
endobj
9 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 10
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000130 00000 n 
0000000249 00000 n 
0000000354 00000 n 
0000000473 00000 n 
0000000583 00000 n 
0000000702 00000 n 
0000000811 00000 n 
trailer
<< /Size 10 /Root 1 0 R >>
startxref
880
%%EOF`;
  return Buffer.from(pdfString);
}

describe('Phase 4: Legal X-Ray Analysis Service & Lifecycle', () => {
  const testStorageDir = './test-analysis-uploads';
  let storage: LocalStorageService;
  let docService: DocumentService;
  let analysisService: AnalysisService;
  let readyDocId = '';
  let uploadedDocId = '';

  beforeAll(async () => {
    storage = new LocalStorageService(testStorageDir);
    docService = new DocumentService(storage);
    analysisService = new AnalysisService(docService);
    getDb();

    // 1. Create and process a multi-page document to READY
    const readyDoc = await docService.uploadDocument({
      filename: 'Standard_Master_Agreement.pdf',
      mimeType: 'application/pdf',
      buffer: createMultiPageTestPdf(),
    });
    readyDocId = readyDoc.id;
    await docService.processDocument(readyDocId);

    // 2. Create an unprocessed document (in UPLOADED state)
    const rawDoc = await docService.uploadDocument({
      filename: 'Unprocessed_Draft.pdf',
      mimeType: 'application/pdf',
      buffer: createMultiPageTestPdf(),
    });
    uploadedDocId = rawDoc.id;
  });

  afterAll(async () => {
    if (readyDocId) {
      try {
        await docService.deleteDocument(readyDocId);
      } catch {
        // Ignore
      }
    }
    if (uploadedDocId) {
      try {
        await docService.deleteDocument(uploadedDocId);
      } catch {
        // Ignore
      }
    }
    const resolved = path.resolve(process.cwd(), testStorageDir);
    await fs.rm(resolved, { recursive: true, force: true });
  });

  it('rejects analysis of a non-existent document ID with NotFoundError', async () => {
    await expect(analysisService.analyzeDocument('doc_non_existent_12345')).rejects.toThrow(
      NotFoundError
    );
  });

  it('rejects analysis of an un-processed UPLOADED document with DOCUMENT_NOT_READY', async () => {
    await expect(analysisService.analyzeDocument(uploadedDocId)).rejects.toThrow(
      /Document is not ready for analysis/
    );
  });

  it('successfully generates and persists evidence-grounded Legal X-Ray analysis for a READY document', async () => {
    const analysis = await analysisService.analyzeDocument(readyDocId);

    expect(analysis).toBeDefined();
    expect(analysis.documentId).toBe(readyDocId);
    expect(analysis.overview.title).toContain('Standard Master Agreement');
    expect(analysis.overview.summary).toBeDefined();
    expect(analysis.overview.governingLaw).toBe('Governing law was not identified in this document.');

    // Offline mode may expose source excerpts, but must not invent obligations.
    expect(analysis.obligations).toHaveLength(0);
    expect(analysis.materialClauses.length).toBeGreaterThan(0);

    // Verification summary should reflect ground truth
    expect(analysis.validationSummary.totalCitations).toBeGreaterThan(0);
    expect(analysis.validationSummary.validatedCount).toBeGreaterThan(0);

    // Citations must be grounded on existing pages
    for (const ob of analysis.obligations) {
      expect(ob.pageNumber).toBeGreaterThanOrEqual(1);
      expect(ob.pageNumber).toBeLessThanOrEqual(3);
    }

    expect(analysis.lawyerQuestions).toHaveLength(0);
  });

  it('retrieves stored Legal X-Ray analysis idempotently without re-generating', async () => {
    // 1. Get via getAnalysis
    const stored = await analysisService.getAnalysis(readyDocId);
    expect(stored).not.toBeNull();
    expect(stored?.documentId).toBe(readyDocId);

    // 2. Calling analyzeDocument without force returns identical cached analysis
    const cached = await analysisService.analyzeDocument(readyDocId);
    expect(cached.analyzedAt).toBe(stored?.analyzedAt);
    expect(cached.overview.summary).toBe(stored?.overview.summary);
  });

  it('allows forced re-analysis to update results cleanly', async () => {
    const initial = await analysisService.getAnalysis(readyDocId);
    expect(initial).not.toBeNull();

    // Forced re-analysis
    const refreshed = await analysisService.analyzeDocument(readyDocId, { force: true });
    expect(refreshed.documentId).toBe(readyDocId);
    expect(refreshed.overview.title).toBe(initial?.overview.title);
  });

  it('keeps citations owned by other workflows during forced reanalysis', async () => {
    const citationId = 'external_citation_preserved_on_reanalysis';
    getDb().insert(schema.citations).values({
      id: citationId,
      documentId: readyDocId,
      sourceType: 'DOCUMENT_FACT',
      pageNumber: 1,
      quotedText: 'LexiGuide Test Document. Page 1',
      confidenceScore: 1,
      createdAt: new Date().toISOString(),
    }).run();

    await analysisService.analyzeDocument(readyDocId, { force: true });
    expect(getDb().select().from(schema.citations).where(eq(schema.citations.id, citationId)).get()).toBeDefined();
  });

  it('preserves document status as READY even if AI analysis encounters an error', async () => {
    // Mock a failing Gemini service
    const failingGemini = {
      isConfigured: () => true,
      generateText: async () => {
        throw new Error('API Rate limit exceeded.');
      },
      generateStructured: async () => {
        throw new Error('API Rate limit exceeded.');
      },
      uploadFile: async () => null,
    };

    const failingAnalysisService = new AnalysisService(
      docService,
      failingGemini as unknown as typeof analysisService['gemini']
    );

    // Attempt analysis with failing provider
    await expect(
      failingAnalysisService.analyzeDocument(readyDocId, { force: true })
    ).rejects.toThrow(/Analysis generation failed/);

    // CRITICAL REQUIREMENT: Document processing status must remain READY!
    const doc = await docService.getDocumentById(readyDocId);
    expect(doc.status).toBe('READY');
  });

  it('downgrades fabricated citations to NEEDS_REVIEW when quote is not on page', async () => {
    // Mock AI output proposing a fabricated quote
    const hallucinatingGemini = {
      isConfigured: () => true,
      generateText: async () => '',
      uploadFile: async () => null,
      generateStructured: async () => ({
        overview: {
          documentType: 'Commercial Contract',
          title: 'Contract',
          summary: 'A test contract.',
          governingLaw: 'Governing law was not identified in this document.',
        },
        parties: [],
        keyDates: [],
        obligations: [
          {
            id: 'ob_fake',
            party: 'Vendor',
            obligation: 'Pay unlimited damages upon any breach.',
            explanation: 'Vendor assumes total liability.',
            attentionLevel: 'HIGH' as const,
            pageNumber: 2,
            // FABRICATED QUOTE: Does not exist on Page 2!
            quotedText: 'Vendor shall pay one hundred billion dollars for any defect.',
          },
        ],
        rights: [],
        financialTerms: [],
        materialClauses: [],
        attentionAreas: [],
        lawyerQuestions: [],
      }),
    };

    const antiFabricationService = new AnalysisService(
      docService,
      hallucinatingGemini as unknown as typeof analysisService['gemini']
    );

    const result = await antiFabricationService.analyzeDocument(readyDocId, { force: true });

    // The obligation must be downgraded to NEEDS_REVIEW
    expect(result.obligations[0].classification).toBe('NEEDS_REVIEW');
    expect(result.obligations[0].isValidated).toBe(false);
    expect(result.validationSummary.unverifiedCount).toBe(1);
  });
});
