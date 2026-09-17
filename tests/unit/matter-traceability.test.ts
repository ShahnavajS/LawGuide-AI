/**
 * Unit tests for Phase 10: Traceability across Action Items, Questions, and Briefs.
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

describe('Phase 10: Traceable Legal Record & Action Item Provenance', () => {
  const testStorageDir = path.join(process.cwd(), 'uploads_test_traceability');
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

  it('populates whyThisExists and evidenceChain for user-created action items', async () => {
    const matter = await matterService.createMatter({
      title: 'Traceability Test Matter',
    });

    const item = await matterService.createActionItem(matter.id, {
      title: 'Consult specialist on Delaware tax implications',
      description: 'Review Section 8 tax allocation.',
      type: 'ASK_COUNSEL',
      priority: 'HIGH',
      sourceType: 'USER_CREATED',
      userProvided: true,
    });

    // Retrieve via getActionItems
    const items = await matterService.getActionItems(matter.id);
    const retrieved = items.find((i) => i.id === item.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.isUserCreated).toBe(true);
    expect(retrieved?.whyThisExists).toBe('User-created preparation task.');
  });

  it('populates whyThisExists and evidenceChain when action item references a document', async () => {
    const matter = await matterService.createMatter({
      title: 'Doc Traceability Matter',
    });

    const doc = await docService.uploadDocument({
      filename: 'Lease.pdf',
      mimeType: 'application/pdf',
      buffer: createValidTestPdf('Commercial Lease. Tenant shall carry liability insurance.'),
    });
    await docService.processDocument(doc.id);

    await matterService.addDocumentToMatter(matter.id, doc.id, 'PRIMARY_AGREEMENT');

    const item = await matterService.createActionItem(matter.id, {
      title: 'Verify insurance coverage requirements',
      description: 'Confirm minimum general liability amount with carrier.',
      type: 'COLLECT_DOCUMENT',
      priority: 'MEDIUM',
      relatedDocumentId: doc.id,
      sourceType: 'DOCUMENT',
    });

    const items = await matterService.getActionItems(matter.id);
    const retrieved = items.find((i) => i.id === item.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.relatedDocumentTitle).toBe(doc.title);
    expect(retrieved?.whyThisExists).toContain(`Generated from Legal X-Ray analysis of ${doc.title}`);
    expect(retrieved?.evidenceChain).toBeDefined();
    expect(retrieved?.evidenceChain?.[0].documentTitle).toBe(doc.title);
  });

  it('brief dossier includes member document references and structure', async () => {
    const matter = await matterService.createMatter({
      title: 'Brief Dossier Provenance Matter',
    });

    const doc = await docService.uploadDocument({
      filename: 'EmploymentAgreement.pdf',
      mimeType: 'application/pdf',
      buffer: createValidTestPdf('Employment Contract. Non-compete period is 2 years.'),
    });
    await docService.processDocument(doc.id);

    await matterService.addDocumentToMatter(matter.id, doc.id, 'PRIMARY_AGREEMENT');

    const brief = await matterService.generateMatterBrief(matter.id);
    expect(brief.matterId).toBe(matter.id);
    expect(brief.title).toContain('Brief Dossier Provenance Matter');
    expect(brief.documents).toHaveLength(1);
    expect(brief.documents[0].title).toBe(doc.title);
    expect(brief.disclaimer).toBeDefined();
  });
});
