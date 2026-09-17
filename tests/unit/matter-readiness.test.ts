/**
 * Unit tests for Matter Readiness States & Snapshot Metrics (Phase 9).
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

describe('Phase 9: Matter Readiness & Snapshot Metrics', () => {
  const testStorageDir = path.join(process.cwd(), 'uploads_test_readiness');
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

  it('computes objective snapshot metrics and readiness states accurately', async () => {
    const doc = await docService.uploadDocument({
      filename: 'employment-contract.pdf',
      mimeType: 'application/pdf',
      buffer: createSamplePdf('Employment Agreement between TechCorp and Jane Doe.'),
    });
    await docService.processDocument(doc.id);

    const matter = await matterService.createMatter({
      title: 'Jane Doe Onboarding Matter',
    });

    await matterService.addDocumentToMatter(matter.id, doc.id, 'PRIMARY_AGREEMENT');

    await matterService.createActionItem(matter.id, {
      title: 'Verify stock option vesting schedule',
      description: 'Check 4-year schedule with 1-year cliff.',
      priority: 'HIGH',
      type: 'VERIFY_TERM',
    });

    await matterService.addNote(
      matter.id,
      'HR Contact Details',
      'Spoke with Sarah in HR on Sept 15.'
    );

    const report = await matterService.getMatterReadiness(matter.id);

    expect(report.matterId).toBe(matter.id);
    expect(report.snapshot.totalDocuments).toBe(1);
    expect(report.snapshot.openActionItems).toBe(1);
    expect(report.snapshot.completedActionItems).toBe(0);
    expect(report.snapshot.userNotes).toBe(1);

    // States should include ITEMS_TO_VERIFY due to open action item
    expect(report.states).toContain('ITEMS_TO_VERIFY');

    // Recommendations should be populated with actionable guidance
    expect(report.recommendations.length).toBeGreaterThan(0);

    // CRITICAL: Anti-Adjudication verification — no win-rate, probability, or odds in the report
    const reportString = JSON.stringify(report).toLowerCase();
    expect(reportString).not.toContain('win rate');
    expect(reportString).not.toContain('probability of success');
    expect(reportString).not.toContain('score:');
    expect(reportString).not.toContain('likelihood of winning');
  });

  it('transitions readiness state to READY_FOR_REVIEW when all action items are completed', async () => {
    const matter = await matterService.createMatter({
      title: 'Completed Matter',
    });

    const item = await matterService.createActionItem(matter.id, {
      title: 'Review checklist',
      description: 'All items checked.',
    });

    await matterService.updateActionItem(matter.id, item.id, {
      status: 'COMPLETED',
    });

    const report = await matterService.getMatterReadiness(matter.id);
    expect(report.snapshot.openActionItems).toBe(0);
    expect(report.snapshot.completedActionItems).toBe(1);
    expect(report.states).toContain('READY_FOR_REVIEW');
  });
});
