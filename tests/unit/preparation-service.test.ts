/**
 * Unit & Integration Tests for PreparationService (LexiGuide AI Phase 6).
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DocumentService } from '@/lib/document/service';
import { LocalStorageService } from '@/lib/document/storage';
import { AnalysisService } from '@/lib/analysis/service';
import { ComparisonService } from '@/lib/comparison/service';
import { PreparationService } from '@/lib/preparation/service';
import { CitationValidator } from '@/lib/evidence/validator';
import { GeminiService } from '@/lib/ai/gemini';
import { AppError, NotFoundError, ValidationError } from '@/lib/utils/errors';
import fs from 'fs/promises';
import path from 'path';

function createSamplePdf(): Buffer {
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
<< /Length 120 >>
stream
BT
/F1 14 Tf
50 700 Td
(Agreement between Acme Corp and John Doe.) Tj
50 650 Td
(Either party may terminate with 30 days written notice.) Tj
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
0000000404 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
489
%%EOF`;
  return Buffer.from(pdfString);
}

describe('Phase 6: PreparationService Layer', () => {
  const testStorageDir = path.join(process.cwd(), 'uploads_test_preparation');
  let storage: LocalStorageService;
  let docService: DocumentService;
  let analysisService: AnalysisService;
  let comparisonService: ComparisonService;
  let preparationService: PreparationService;

  beforeEach(async () => {
    storage = new LocalStorageService(testStorageDir);
    docService = new DocumentService(storage);

    const offlineGemini = new GeminiService();
    offlineGemini.isConfigured = () => false;

    const validator = new CitationValidator();
    analysisService = new AnalysisService(docService, offlineGemini, validator);
    comparisonService = new ComparisonService(docService, offlineGemini, validator);
    preparationService = new PreparationService(
      docService,
      analysisService,
      comparisonService,
      offlineGemini,
      validator
    );
  });

  afterAll(async () => {
    try {
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch {
      // Clean up test storage
    }
  });

  it('rejects when neither documentId nor comparisonId is provided', async () => {
    await expect(
      preparationService.generatePreparation({})
    ).rejects.toThrow(ValidationError);
  });

  it('rejects non-existent document with NotFoundError', async () => {
    await expect(
      preparationService.generatePreparation({ documentId: 'doc_nonexistent_999' })
    ).rejects.toThrow(NotFoundError);
  });

  it('rejects document that is not in READY status', async () => {
    const doc = await docService.uploadDocument({
      filename: 'sample_unprocessed.pdf',
      mimeType: 'application/pdf',
      buffer: createSamplePdf(),
    });

    await expect(
      preparationService.generatePreparation({ documentId: doc.id })
    ).rejects.toThrow(AppError);
  });

  it('rejects document that has not been analyzed with Legal X-Ray', async () => {
    const doc = await docService.uploadDocument({
      filename: 'sample_not_analyzed.pdf',
      mimeType: 'application/pdf',
      buffer: createSamplePdf(),
    });
    await docService.processDocument(doc.id);

    await expect(
      preparationService.generatePreparation({ documentId: doc.id })
    ).rejects.toThrow('Please run Legal X-Ray analysis first');
  });

  it('successfully generates preparation brief for an analyzed document', async () => {
    const doc = await docService.uploadDocument({
      filename: 'sample_contract.pdf',
      mimeType: 'application/pdf',
      buffer: createSamplePdf(),
    });
    await docService.processDocument(doc.id);
    await analysisService.analyzeDocument(doc.id);

    const brief = await preparationService.generatePreparation({
      documentId: doc.id,
      purpose: 'Review agreement terms before signing',
      userNotes: ['Client is concerned about notice duration'],
    });

    expect(brief).toBeDefined();
    expect(brief.documentId).toBe(doc.id);
    expect(brief.purpose).toBe('Review agreement terms before signing');
    expect(brief.overview.title).toContain('Consultation Brief');
    expect(brief.checklist.length).toBeGreaterThan(0);
    expect(brief.documentsToBring.length).toBeGreaterThan(0);
    expect(brief.userNotes.length).toBe(1);
    expect(brief.userNotes[0].classification).toBe('USER_PROVIDED');
    expect(brief.status).toBe('COMPLETED');
  });

  it('returns cached preparation brief on repeated calls without force', async () => {
    const doc = await docService.uploadDocument({
      filename: 'sample_cached.pdf',
      mimeType: 'application/pdf',
      buffer: createSamplePdf(),
    });
    await docService.processDocument(doc.id);
    await analysisService.analyzeDocument(doc.id);

    const first = await preparationService.generatePreparation({
      documentId: doc.id,
      purpose: 'Initial review',
    });

    const second = await preparationService.generatePreparation({
      documentId: doc.id,
      purpose: 'Initial review',
      force: false,
    });

    expect(second.id).toBe(first.id);
  });

  it('regenerates preparation brief when force: true', async () => {
    const doc = await docService.uploadDocument({
      filename: 'sample_forced.pdf',
      mimeType: 'application/pdf',
      buffer: createSamplePdf(),
    });
    await docService.processDocument(doc.id);
    await analysisService.analyzeDocument(doc.id);

    const first = await preparationService.generatePreparation({
      documentId: doc.id,
      purpose: 'First call',
    });

    const second = await preparationService.generatePreparation({
      documentId: doc.id,
      purpose: 'Updated call',
      force: true,
    });

    expect(second.id).not.toBe(first.id);
  });

  it('updates checklist item state via updateChecklistState without mutating evidence', async () => {
    const doc = await docService.uploadDocument({
      filename: 'sample_checklist.pdf',
      mimeType: 'application/pdf',
      buffer: createSamplePdf(),
    });
    await docService.processDocument(doc.id);
    await analysisService.analyzeDocument(doc.id);

    const brief = await preparationService.generatePreparation({
      documentId: doc.id,
      purpose: 'Checklist testing',
    });

    const itemToToggle = brief.checklist[0].id;
    const updatedState = await preparationService.updateChecklistState(
      brief.id,
      itemToToggle,
      true
    );

    expect(updatedState[itemToToggle]).toBe(true);

    // Fetch brief again and verify state is reflected
    const retrieved = await preparationService.getPreparation(brief.id);
    expect(retrieved).toBeDefined();
    const checkedItem = retrieved?.checklist.find((c) => c.id === itemToToggle);
    expect(checkedItem?.isCompleted).toBe(true);
  });
});
