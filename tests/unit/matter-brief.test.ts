/**
 * Unit tests for Matter Consultation Brief Dossier (Phase 9).
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { DocumentService } from '@/lib/document/service';
import { LocalStorageService } from '@/lib/document/storage';
import { AnalysisService } from '@/lib/analysis/service';
import { MatterService } from '@/lib/matter/service';
import { getDb, schema } from '@/lib/db';
import { CitationValidator } from '@/lib/evidence/validator';
import { GeminiService } from '@/lib/ai/gemini';
import type { LegalXRayAnalysis } from '@/lib/ai/schemas';
import { eq } from 'drizzle-orm';
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

describe('Phase 9: Matter Brief Dossier Generation & Persistence', () => {
  const testStorageDir = path.join(process.cwd(), 'uploads_test_brief');
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

  it('generates, persists, caches, and regenerates a comprehensive consultation brief', async () => {
    const doc = await docService.uploadDocument({
      filename: 'brief-doc.pdf',
      mimeType: 'application/pdf',
      buffer: createSamplePdf('Consultation Brief Test Document.'),
    });
    await docService.processDocument(doc.id);

    const matter = await matterService.createMatter({
      title: 'Dossier Synthesis Matter',
      jurisdiction: 'California, USA',
    });

    await matterService.addDocumentToMatter(matter.id, doc.id, 'PRIMARY_AGREEMENT');

    await matterService.createActionItem(matter.id, {
      title: 'Action Item For Brief',
      description: 'Check filing requirements.',
    });

    // 1. Initially no brief exists
    const initialBrief = await matterService.getMatterBrief(matter.id);
    expect(initialBrief).toBeNull();

    // 2. Generate brief
    const brief = await matterService.generateMatterBrief(matter.id);
    expect(brief).toBeDefined();
    expect(brief.matterId).toBe(matter.id);
    expect(brief.preparationId).toBeDefined();
    expect(brief.title).toContain('Dossier Synthesis Matter');
    expect(brief.summary).toBeDefined();
    expect(brief.documents.length).toBe(1);
    expect(brief.actionItems.length).toBe(1);
    expect(brief.disclaimer).toBeDefined();

    // 3. Retrieve cached brief
    const cachedBrief = await matterService.getMatterBrief(matter.id);
    expect(cachedBrief).not.toBeNull();
    expect(cachedBrief?.preparationId).toBe(brief.preparationId);

    // 4. Force regenerate brief
    const regeneratedBrief = await matterService.generateMatterBrief(matter.id, { force: true });
    expect(regeneratedBrief).toBeDefined();
    expect(regeneratedBrief.matterId).toBe(matter.id);
    expect(regeneratedBrief.preparationId).not.toBe(brief.preparationId);
    expect(getDb().select({ id: schema.preparations.id }).from(schema.preparations).get()?.id)
      .toBe(regeneratedBrief.preparationId);
  });

  it('retains the previous matter brief when regeneration fails to persist', async () => {
    const matter = await matterService.createMatter({ title: 'Atomic matter brief' });
    const original = await matterService.generateMatterBrief(matter.id);
    const sqlite = getDb().$client;
    sqlite.exec("CREATE TRIGGER fail_matter_brief_replace BEFORE INSERT ON preparations WHEN NEW.brief_kind = 'MATTER' BEGIN SELECT RAISE(ABORT, 'injected failure'); END");
    try {
      await expect(matterService.generateMatterBrief(matter.id, { force: true }))
        .rejects.toThrow('injected failure');
    } finally {
      sqlite.exec('DROP TRIGGER fail_matter_brief_replace');
    }
    expect((await matterService.getMatterBrief(matter.id))?.preparationId).toBe(original.preparationId);
  });

  it('builds one brief without triggering a hidden counsel-question provider call', async () => {
    const generateStructured = vi.fn();
    const configuredGemini = {
      isConfigured: () => true,
      generateStructured,
    } as unknown as GeminiService;
    const service = new MatterService(
      docService,
      analysisService,
      configuredGemini,
      new CitationValidator()
    );
    const matter = await service.createMatter({ title: 'Single operation brief' });

    const brief = await service.generateMatterBrief(matter.id);

    expect(brief.counselQuestions.length).toBeGreaterThan(0);
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it('does not promote unverified analysis claims into verified matter facts', async () => {
    const doc = await docService.uploadDocument({
      filename: 'review-needed.pdf',
      mimeType: 'application/pdf',
      buffer: createSamplePdf('Agreement text without a date.'),
    });
    await docService.processDocument(doc.id);
    const analysis = await analysisService.analyzeDocument(doc.id);
    const stored = getDb().select().from(schema.analyses)
      .where(eq(schema.analyses.documentId, doc.id)).get();
    expect(stored).toBeDefined();
    const modified: LegalXRayAnalysis = {
      ...analysis,
      parties: [{ id: 'unverified_party', name: 'Invented Party', role: 'Buyer', pageNumber: 1, quotedText: 'not in document', classification: 'NEEDS_REVIEW', isValidated: false }],
      keyDates: [{ id: 'unverified_date', label: 'Effective date', dateValue: 'January 1', description: '', pageNumber: 1, quotedText: 'not in document', classification: 'NEEDS_REVIEW', isValidated: false }],
    };
    getDb().update(schema.analyses).set({ analysisDataJson: JSON.stringify(modified) })
      .where(eq(schema.analyses.id, stored!.id)).run();
    const matter = await matterService.createMatter({ title: 'Citation classification' });
    await matterService.addDocumentToMatter(matter.id, doc.id);
    const brief = await matterService.generateMatterBrief(matter.id);
    expect(brief.parties).not.toContain('Invented Party');
    expect(brief.keyFactualPoints[0]).toMatchObject({
      classification: 'NEEDS_REVIEW',
      verificationStatus: 'NEEDS_REVIEW',
      quotedText: 'not in document',
    });
  });
});
