/**
 * Unit tests for automatic action item generation and deduplication (Phase 9).
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

describe('Phase 9: Automatic Action Item Generation & Deduplication', () => {
  const testStorageDir = path.join(process.cwd(), 'uploads_test_generation');
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

  it('automatically derives action items for member documents, relationships, and consistency findings', async () => {
    // 1. Create two documents
    const doc1 = await docService.uploadDocument({
      filename: 'service-agreement.pdf',
      mimeType: 'application/pdf',
      buffer: createSamplePdf('Master Services Agreement. Notice period shall be 30 days written notice.'),
    });
    await docService.processDocument(doc1.id);

    const doc2 = await docService.uploadDocument({
      filename: 'amendment-one.pdf',
      mimeType: 'application/pdf',
      buffer: createSamplePdf('Amendment No 1 to Master Services Agreement. Notice period is 60 days.'),
    });
    await docService.processDocument(doc2.id);

    // 2. Create Matter and add documents
    const matter = await matterService.createMatter({
      title: 'Vendor Contract Review',
    });

    await matterService.addDocumentToMatter(matter.id, doc1.id, 'PRIMARY_AGREEMENT');
    await matterService.addDocumentToMatter(matter.id, doc2.id, 'AMENDMENT');

    // 3. Generate action items
    const generated = await matterService.generateActionItems(matter.id);
    expect(generated.items.length).toBeGreaterThan(0);
    expect(generated.createdCount).toBeGreaterThan(0);

    // Member document review tasks should exist
    const docReviewTasks = generated.items.filter((item) => item.type === 'REQUEST_DOCUMENT' || item.type === 'VERIFY_TERM');
    expect(docReviewTasks.length).toBeGreaterThanOrEqual(1);

    // Check that activity trail logged action items generation
    const activity = await matterService.getActivity(matter.id);
    const genLog = activity.find((a) => a.actionType === 'ACTION_ITEMS_GENERATED');
    expect(genLog).toBeDefined();
  });

  it('deduplicates tasks when generateActionItems is called repeatedly', async () => {
    const doc = await docService.uploadDocument({
      filename: 'nda.pdf',
      mimeType: 'application/pdf',
      buffer: createSamplePdf('Mutual Non-Disclosure Agreement. Term is two years.'),
    });
    await docService.processDocument(doc.id);

    const matter = await matterService.createMatter({
      title: 'Deduplication Test Matter',
    });

    await matterService.addDocumentToMatter(matter.id, doc.id, 'PRIMARY_AGREEMENT');

    // First generation
    const firstRun = await matterService.generateActionItems(matter.id);
    const countAfterFirst = firstRun.items.length;
    expect(countAfterFirst).toBeGreaterThan(0);

    // Second generation should detect existing titles and not produce duplicates
    const secondRun = await matterService.generateActionItems(matter.id);
    expect(secondRun.items.length).toBe(countAfterFirst);
    expect(secondRun.createdCount).toBe(0);

    // Verify all item IDs in the matter remain unique
    const allItems = await matterService.getActionItems(matter.id);
    const uniqueIds = new Set(allItems.map((i) => i.id));
    expect(uniqueIds.size).toBe(allItems.length);
  });
});
