/**
 * Unit tests for Phase 10: Matter Source Map Hierarchy & Coverage Metrics.
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

function createValidTestPdf(content: string = 'Sample text'): Buffer {
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
<< /Length ${content.length + 20} >>
stream
BT
/F1 12 Tf
100 700 Td
(${content}) Tj
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
0000000334 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
400
%%EOF`;
  return Buffer.from(pdfString);
}

describe('Phase 10: Matter Source Map Hierarchy & Coverage Metrics', () => {
  const testStorageDir = path.join(process.cwd(), 'uploads_test_sourcemap');
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

  it('generates a complete Source Map hierarchy with coverage metrics', async () => {
    const matter = await matterService.createMatter({
      title: 'Acquisition Matter',
      jurisdiction: 'US-NY',
    });

    // Create Document 1
    const doc1 = await docService.uploadDocument({
      filename: 'APA.pdf',
      mimeType: 'application/pdf',
      buffer: createValidTestPdf('Asset Purchase Agreement. Closing on October 1.'),
    });
    await docService.processDocument(doc1.id);

    // Create Document 2
    const doc2 = await docService.uploadDocument({
      filename: 'Escrow.pdf',
      mimeType: 'application/pdf',
      buffer: createValidTestPdf('Escrow Agreement. Escrow release upon closing.'),
    });
    await docService.processDocument(doc2.id);

    await matterService.addDocumentToMatter(matter.id, doc1.id, 'PRIMARY_AGREEMENT');
    await matterService.addDocumentToMatter(matter.id, doc2.id, 'SUPPORTING_DOCUMENT');

    // Add a user note (unlinked evidence)
    await matterService.addNote(
      matter.id,
      'Due Diligence Question',
      'Seller claims escrow balance was confirmed with Bank of America.'
    );

    // Create an action item linked to doc1
    await matterService.createActionItem(matter.id, {
      title: 'Verify closing deadline in APA',
      description: 'Check Section 12.1 against lender commitment letter.',
      type: 'VERIFY_TERM',
      priority: 'HIGH',
      relatedDocumentId: doc1.id,
      sourceType: 'DOCUMENT',
    });

    const sourceMap = await matterService.getMatterSourceMap(matter.id);

    // Verify response structure
    expect(sourceMap.matterId).toBe(matter.id);
    expect(sourceMap.documents).toHaveLength(2);
    expect(sourceMap.coverage).toBeDefined();

    // Verify coverage metrics
    expect(sourceMap.coverage.totalDocuments).toBe(2);
    expect(sourceMap.coverage.userProvidedCount).toBe(1);
    expect(sourceMap.unlinkedEvidenceCount).toBe(1);
    expect(sourceMap.coverage.actionItemsWithEvidence.total).toBe(1);
    expect(sourceMap.coverage.actionItemsWithEvidence.withEvidence).toBe(1);
    expect(sourceMap.evidenceItems).toHaveLength(sourceMap.coverage.totalEvidenceItems);
    expect(sourceMap.evidenceItems.some((item) => item.classification === 'USER_PROVIDED')).toBe(true);

    // Verify Document nodes
    const apaNode = sourceMap.documents.find((d) => d.documentId === doc1.id);
    expect(apaNode).toBeDefined();
    expect(apaNode?.title).toBe(doc1.title);
    expect(apaNode?.role).toBe('PRIMARY_AGREEMENT');
  });

  it('accurately tracks unlinked vs document-anchored evidence items', async () => {
    const matter = await matterService.createMatter({
      title: 'Evidence Anchoring Matter',
    });

    // Only add a user note
    await matterService.addNote(
      matter.id,
      'Unanchored Context',
      'Oral discussion regarding payment terms on March 15.'
    );

    const sourceMap = await matterService.getMatterSourceMap(matter.id);
    expect(sourceMap.unlinkedEvidenceCount).toBe(1);
    expect(sourceMap.coverage.userProvidedCount).toBe(1);
    expect(sourceMap.coverage.totalEvidenceItems).toBe(1);
    expect(sourceMap.coverage.documentsWithVerifiedEvidence).toBe(0);
  });
});
