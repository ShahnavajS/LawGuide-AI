/**
 * Unit tests for Phase 10: Matter Evidence Intelligence & Ledger.
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

function createValidTestPdf(): Buffer {
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
<< /Length 50 >>
stream
BT
/F1 12 Tf
100 700 Td
(Notice period is 30 days written notice.) Tj
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

describe('Phase 10: Matter Evidence Intelligence & Ledger', () => {
  const testStorageDir = path.join(process.cwd(), 'uploads_test_evidence');
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

  it('syncs evidence from documents, consistency findings, relationships, and notes', async () => {
    const matter = await matterService.createMatter({
      title: 'Master Agreement Matter',
      jurisdiction: 'US-DE',
    });

    const doc = await docService.uploadDocument({
      filename: 'MSA_2025.pdf',
      mimeType: 'application/pdf',
      buffer: createValidTestPdf(),
    });
    await docService.processDocument(doc.id);

    // Add document to matter
    await matterService.addDocumentToMatter(matter.id, doc.id, 'PRIMARY_AGREEMENT');

    // Add a user note (USER_PROVIDED evidence)
    await matterService.addNote(
      matter.id,
      'Client Meeting Clarification',
      'Client confirmed that 30-day notice was verbally agreed to be extended to 60 days.'
    );

    // Perform evidence sync
    const syncedEvidence = await matterService.syncMatterEvidence(matter.id);
    expect(syncedEvidence.length).toBeGreaterThan(0);

    // Verify user note became an unverified USER_PROVIDED evidence item
    const noteEvidence = syncedEvidence.find((e) => e.classification === 'USER_PROVIDED');
    expect(noteEvidence).toBeDefined();
    expect(noteEvidence?.evidenceType).toBe('USER_PROVIDED');
    expect(noteEvidence?.verificationStatus).toBe('UNVERIFIED');
    expect(noteEvidence?.confidenceCategory).toBe('UNVERIFIED');
    expect(noteEvidence?.quotedText).toContain('Client confirmed');
  });

  it('is idempotent: running sync multiple times maintains consistency without duplicate records', async () => {
    const matter = await matterService.createMatter({
      title: 'Idempotency Test Matter',
    });

    await matterService.addNote(
      matter.id,
      'Test Note 1',
      'Payment shall be made within 15 calendar days of invoice.'
    );

    const firstSync = await matterService.syncMatterEvidence(matter.id);
    const secondSync = await matterService.syncMatterEvidence(matter.id);

    expect(firstSync.length).toBe(secondSync.length);
    expect(firstSync[0].id).toBe(secondSync[0].id);

    // Verify ledger count matches sync count
    const ledger = await matterService.getMatterEvidenceLedger(matter.id);
    expect(ledger.totalItems).toBe(firstSync.length);
  });

  it('filters evidence ledger by classification, verificationStatus, and search term', async () => {
    const matter = await matterService.createMatter({
      title: 'Ledger Filter Matter',
    });

    await matterService.addNote(
      matter.id,
      'Arbitration Clause Note',
      'Parties agree to binding arbitration in New York.'
    );

    await matterService.addNote(
      matter.id,
      'Governing Law Note',
      'This Agreement is governed by Delaware law.'
    );

    // 1. Unfiltered
    const allLedger = await matterService.getMatterEvidenceLedger(matter.id);
    expect(allLedger.totalItems).toBe(2);

    // 2. Filter by classification
    const userLedger = await matterService.getMatterEvidenceLedger(matter.id, {
      classification: 'USER_PROVIDED',
    });
    expect(userLedger.totalItems).toBe(2);

    const docFactLedger = await matterService.getMatterEvidenceLedger(matter.id, {
      classification: 'DOCUMENT_FACT',
    });
    expect(docFactLedger.totalItems).toBe(0);

    // 3. Filter by verification status
    const unverifiedLedger = await matterService.getMatterEvidenceLedger(matter.id, {
      verificationStatus: 'UNVERIFIED',
    });
    expect(unverifiedLedger.totalItems).toBe(2);

    const verifiedLedger = await matterService.getMatterEvidenceLedger(matter.id, {
      verificationStatus: 'VERIFIED',
    });
    expect(verifiedLedger.totalItems).toBe(0);

    // 4. Search text filter
    const searchArbitration = await matterService.getMatterEvidenceLedger(matter.id, {
      search: 'arbitration',
    });
    expect(searchArbitration.totalItems).toBe(1);
    expect(searchArbitration.items[0].quotedText).toContain('arbitration');

    const searchDelaware = await matterService.getMatterEvidenceLedger(matter.id, {
      search: 'delaware',
    });
    expect(searchDelaware.totalItems).toBe(1);
    expect(searchDelaware.items[0].quotedText).toContain('Delaware');

    const searchNonExistent = await matterService.getMatterEvidenceLedger(matter.id, {
      search: 'nonexistent_term_xyz',
    });
    expect(searchNonExistent.totalItems).toBe(0);
  });

  it('retrieves evidence for a specific document page and verifies authorization', async () => {
    const matterA = await matterService.createMatter({ title: 'Matter A' });
    const matterB = await matterService.createMatter({ title: 'Matter B' });

    const doc = await docService.uploadDocument({
      filename: 'DocA.pdf',
      mimeType: 'application/pdf',
      buffer: createValidTestPdf(),
    });
    await docService.processDocument(doc.id);

    await matterService.addDocumentToMatter(matterA.id, doc.id, 'PRIMARY_AGREEMENT');

    // Valid access under Matter A
    const pageEvidence = await matterService.getDocumentPageEvidence(matterA.id, doc.id, 1);
    expect(pageEvidence.pageNumber).toBe(1);
    expect(pageEvidence.documentTitle).toBe(doc.title);

    // Cross-matter unauthorized access attempt under Matter B should fail
    await expect(
      matterService.getDocumentPageEvidence(matterB.id, doc.id, 1)
    ).rejects.toThrow(NotFoundError);
  });
});
