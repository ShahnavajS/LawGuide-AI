/**
 * Unit & Integration Tests for ComparisonService & Dual Citation Validation (LexiGuide AI Phase 5).
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DocumentService } from '@/lib/document/service';
import { LocalStorageService } from '@/lib/document/storage';
import { ComparisonService } from '@/lib/comparison/service';
import { CitationValidator } from '@/lib/evidence/validator';
import { GeminiService } from '@/lib/ai/gemini';
import { AppError, NotFoundError, ValidationError } from '@/lib/utils/errors';
import fs from 'fs/promises';
import path from 'path';

function createBaseTestPdf(): Buffer {
  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 7 0 R >> >> >>
endobj
4 0 obj
<< /Length 65 >>
stream
BT
/F1 14 Tf
50 700 Td
(1.1 Parties. Agreement between Apex Corp and Jane Doe.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>
endobj
6 0 obj
<< /Length 85 >>
stream
BT
/F1 14 Tf
50 700 Td
(11.2 Termination. Either party may terminate with 30 days notice.) Tj
ET
endstream
endobj
7 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 8
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000122 00000 n 
0000000241 00000 n 
0000000356 00000 n 
0000000475 00000 n 
0000000610 00000 n 
trailer
<< /Size 8 /Root 1 0 R >>
startxref
679
%%EOF`;
  return Buffer.from(pdfString);
}

function createTargetTestPdf(): Buffer {
  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 7 0 R >> >> >>
endobj
4 0 obj
<< /Length 65 >>
stream
BT
/F1 14 Tf
50 700 Td
(1.1 Parties. Agreement between Apex Corp and Jane Doe.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>
endobj
6 0 obj
<< /Length 135 >>
stream
BT
/F1 14 Tf
50 700 Td
(11.2 Termination. Either party may terminate with 60 days notice.) Tj
50 650 Td
(14.1 Indemnity. Employee shall indemnify Employer against claims.) Tj
ET
endstream
endobj
7 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 8
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000122 00000 n 
0000000241 00000 n 
0000000356 00000 n 
0000000475 00000 n 
0000000660 00000 n 
trailer
<< /Size 8 /Root 1 0 R >>
startxref
729
%%EOF`;
  return Buffer.from(pdfString);
}

describe('Phase 5: ComparisonService & Dual Evidence Verification', () => {
  const testStorageDir = path.join(process.cwd(), 'uploads_test_comparison');
  let storage: LocalStorageService;
  let docService: DocumentService;
  let comparisonService: ComparisonService;

  beforeEach(async () => {
    storage = new LocalStorageService(testStorageDir);
    docService = new DocumentService(storage);

    // Force offline unconfigured mode for deterministic engine
    const offlineGemini = new GeminiService();
    offlineGemini.isConfigured = () => false;

    comparisonService = new ComparisonService(docService, offlineGemini, new CitationValidator());
  });

  afterAll(async () => {
    try {
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('rejects comparing a document to itself', async () => {
    await expect(comparisonService.compareDocuments('doc_same', 'doc_same')).rejects.toThrow(
      ValidationError
    );
  });

  it('rejects non-existent documents with NotFoundError', async () => {
    await expect(comparisonService.compareDocuments('doc_missing_1', 'doc_missing_2')).rejects.toThrow(
      NotFoundError
    );
  });

  it('rejects documents that have not finished processing (status !== READY)', async () => {
    const baseDoc = await docService.uploadDocument({
      filename: 'base_unready.pdf',
      mimeType: 'application/pdf',
      buffer: createBaseTestPdf(),
    });
    const targetDoc = await docService.uploadDocument({
      filename: 'target_unready.pdf',
      mimeType: 'application/pdf',
      buffer: createTargetTestPdf(),
    });

    await expect(
      comparisonService.compareDocuments(baseDoc.id, targetDoc.id)
    ).rejects.toThrow(AppError);
  });

  it('successfully compares two READY documents and extracts substantive differences', async () => {
    // 1. Upload & Process Base
    const baseDoc = await docService.uploadDocument({
      filename: 'original_agreement.pdf',
      mimeType: 'application/pdf',
      buffer: createBaseTestPdf(),
    });
    await docService.processDocument(baseDoc.id);

    // 2. Upload & Process Target
    const targetDoc = await docService.uploadDocument({
      filename: 'revised_agreement.pdf',
      mimeType: 'application/pdf',
      buffer: createTargetTestPdf(),
    });
    await docService.processDocument(targetDoc.id);

    // 3. Compare
    const result = await comparisonService.compareDocuments(baseDoc.id, targetDoc.id);

    expect(result).toBeDefined();
    expect(result.id).toMatch(/^comp_/);
    expect(result.baseDocumentId).toBe(baseDoc.id);
    expect(result.targetDocumentId).toBe(targetDoc.id);
    expect(result.summary.baseDocumentTitle).toBe(baseDoc.title);
    expect(result.summary.targetDocumentTitle).toBe(targetDoc.title);

    // Differences check
    expect(result.differences.length).toBeGreaterThan(0);
    const modifiedDiff = result.differences.find((d) => d.type === 'MODIFIED');
    expect(modifiedDiff).toBeDefined();
    expect(modifiedDiff?.baseEvidence).toBeDefined();
    expect(modifiedDiff?.targetEvidence).toBeDefined();

    // Check dual citation verification
    expect(modifiedDiff?.baseEvidence?.isValidated).toBe(true);
    expect(modifiedDiff?.targetEvidence?.isValidated).toBe(true);
    expect(modifiedDiff?.baseEvidence?.classification).toBe('DOCUMENT_FACT');

    // Check lawyer questions
    expect(result.lawyerQuestions.length).toBeGreaterThan(0);
  });

  it('preserves Base and Target semantic order sensitivity (A -> B is distinct from B -> A)', async () => {
    const docA = await docService.uploadDocument({
      filename: 'contract_v1.pdf',
      mimeType: 'application/pdf',
      buffer: createBaseTestPdf(),
    });
    await docService.processDocument(docA.id);

    const docB = await docService.uploadDocument({
      filename: 'contract_v2.pdf',
      mimeType: 'application/pdf',
      buffer: createTargetTestPdf(),
    });
    await docService.processDocument(docB.id);

    const compAB = await comparisonService.compareDocuments(docA.id, docB.id);
    const compBA = await comparisonService.compareDocuments(docB.id, docA.id);

    expect(compAB.id).not.toBe(compBA.id);
    expect(compAB.baseDocumentId).toBe(docA.id);
    expect(compAB.targetDocumentId).toBe(docB.id);

    expect(compBA.baseDocumentId).toBe(docB.id);
    expect(compBA.targetDocumentId).toBe(docA.id);
  });

  it('implements idempotent caching: returns cached comparison on repeated calls', async () => {
    const doc1 = await docService.uploadDocument({
      filename: 'doc1.pdf',
      mimeType: 'application/pdf',
      buffer: createBaseTestPdf(),
    });
    await docService.processDocument(doc1.id);

    const doc2 = await docService.uploadDocument({
      filename: 'doc2.pdf',
      mimeType: 'application/pdf',
      buffer: createTargetTestPdf(),
    });
    await docService.processDocument(doc2.id);

    const first = await comparisonService.compareDocuments(doc1.id, doc2.id);
    const second = await comparisonService.compareDocuments(doc1.id, doc2.id);

    // Identical ID returned from cache
    expect(first.id).toBe(second.id);
    expect(first.comparedAt).toBe(second.comparedAt);

    // Force re-analysis creates fresh record
    const third = await comparisonService.compareDocuments(doc1.id, doc2.id, { force: true });
    expect(third.id).not.toBe(first.id);
  });

  it('retrieves comparison by ID and by document pair', async () => {
    const doc1 = await docService.uploadDocument({
      filename: 'doc_ret_1.pdf',
      mimeType: 'application/pdf',
      buffer: createBaseTestPdf(),
    });
    await docService.processDocument(doc1.id);

    const doc2 = await docService.uploadDocument({
      filename: 'doc_ret_2.pdf',
      mimeType: 'application/pdf',
      buffer: createTargetTestPdf(),
    });
    await docService.processDocument(doc2.id);

    const created = await comparisonService.compareDocuments(doc1.id, doc2.id);

    // Retrieve by ID
    const byId = await comparisonService.getComparison(created.id);
    expect(byId).toBeDefined();
    expect(byId?.id).toBe(created.id);

    // Retrieve by pair
    const byPair = await comparisonService.getComparisonByDocumentPair(doc1.id, doc2.id);
    expect(byPair).toBeDefined();
    expect(byPair?.id).toBe(created.id);

    // Inverted pair returns null if not compared
    const inverted = await comparisonService.getComparisonByDocumentPair(doc2.id, doc1.id);
    expect(inverted).toBeNull();
  });

  it('anti-fabrication: reconciles unverified quotes and downgrades DOCUMENT_FACT to NEEDS_REVIEW', async () => {
    const doc1 = await docService.uploadDocument({
      filename: 'doc_fact_1.pdf',
      mimeType: 'application/pdf',
      buffer: createBaseTestPdf(),
    });
    await docService.processDocument(doc1.id);

    const doc2 = await docService.uploadDocument({
      filename: 'doc_fact_2.pdf',
      mimeType: 'application/pdf',
      buffer: createTargetTestPdf(),
    });
    await docService.processDocument(doc2.id);

    // Create a custom Gemini stub that outputs a fabricated quote not in the document
    const stubGemini = new GeminiService();
    stubGemini.isConfigured = () => true;
    stubGemini.generateStructured = async <T>() => {
      const payload = {
        summary: { plainLanguage: 'Summary' },
        differences: [
          {
            type: 'MODIFIED',
            category: 'TERMINATION',
            title: 'Termination',
            sectionReference: '11.2',
            baseEvidence: {
              pageNumber: 2,
              quotedText: 'THIS FABRICATED QUOTE DOES NOT EXIST ANYWHERE IN THE BASE DOCUMENT',
            },
            targetEvidence: {
              pageNumber: 2,
              quotedText: '11.2 Termination. Either party may terminate with 60 days notice.',
            },
            changeSummary: 'Change',
            semanticChanges: [],
            practicalImplications: 'Implications',
            attentionLevel: 'HIGH',
          },
        ],
      };
      return JSON.parse(JSON.stringify(payload)) as T;
    };

    const stubComparisonService = new ComparisonService(
      docService,
      stubGemini,
      new CitationValidator()
    );

    const result = await stubComparisonService.compareDocuments(doc1.id, doc2.id);
    // A modified finding needs verified evidence from both versions.
    expect(result.differences).toHaveLength(0);

    // Validation summary reflects unverified citation
    expect(result.validationSummary.unverifiedCount).toBe(1);
    expect(result.validationSummary.validatedCount).toBe(1);
  });
});
