/**
 * Unit & Integration Tests for MatterService (LexiGuide AI Phase 8).
 * Tests Matter Lifecycle, Membership, Safety, and Cascading Guarantees.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DocumentService } from '@/lib/document/service';
import { LocalStorageService } from '@/lib/document/storage';
import { AnalysisService } from '@/lib/analysis/service';
import { MatterService } from '@/lib/matter/service';
import { CitationValidator } from '@/lib/evidence/validator';
import { GeminiService } from '@/lib/ai/gemini';
import { NotFoundError, ValidationError } from '@/lib/utils/errors';
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

describe('Phase 8: MatterService Core & Lifecycle', () => {
  const testStorageDir = path.join(process.cwd(), 'uploads_test_matters');
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
      // Clean up test storage
    }
  });

  describe('Matter Lifecycle', () => {
    it('creates a matter with valid inputs and default jurisdiction provenance', async () => {
      const matter = await matterService.createMatter({
        title: 'Acme SaaS Vendor Dispute',
        description: 'Dispute regarding SLA downtime and contract renewal terms.',
        jurisdiction: 'New York, USA',
        jurisdictionProvenance: 'USER_PROVIDED',
      });

      expect(matter.id).toBeDefined();
      expect(matter.title).toBe('Acme SaaS Vendor Dispute');
      expect(matter.description).toBe('Dispute regarding SLA downtime and contract renewal terms.');
      expect(matter.jurisdiction).toBe('New York, USA');
      expect(matter.jurisdictionProvenance).toBe('USER_PROVIDED');
      expect(matter.status).toBe('ACTIVE');
      expect(matter.documents).toHaveLength(0);
      expect(matter.metrics.totalDocuments).toBe(0);
    });

    it('rejects creation when title is empty', async () => {
      await expect(
        matterService.createMatter({ title: '   ' })
      ).rejects.toThrow(ValidationError);
    });

    it('retrieves an existing matter by ID', async () => {
      const created = await matterService.createMatter({
        title: 'Employment Agreement Audit',
      });

      const retrieved = await matterService.getMatter(created.id);
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.title).toBe('Employment Agreement Audit');
      expect(retrieved.jurisdictionProvenance).toBe('NOT_ESTABLISHED');
    });

    it('throws NotFoundError for non-existent matter ID', async () => {
      await expect(
        matterService.getMatter('matter_non_existent_12345')
      ).rejects.toThrow(NotFoundError);
    });

    it('lists matters filtered by ACTIVE and ARCHIVED status', async () => {
      const active = await matterService.createMatter({ title: 'Active Matter 1' });
      const archived = await matterService.createMatter({ title: 'Archived Matter 1' });
      await matterService.updateMatter(archived.id, { status: 'ARCHIVED' });

      const activeList = await matterService.listMatters('ACTIVE');
      const archivedList = await matterService.listMatters('ARCHIVED');

      expect(activeList.some((m) => m.id === active.id)).toBe(true);
      expect(activeList.some((m) => m.id === archived.id)).toBe(false);

      expect(archivedList.some((m) => m.id === archived.id)).toBe(true);
      expect(archivedList.some((m) => m.id === active.id)).toBe(false);
    });

    it('updates matter details', async () => {
      const created = await matterService.createMatter({ title: 'Original Matter Title' });

      const updated = await matterService.updateMatter(created.id, {
        title: 'Updated Matter Title',
        description: 'New detailed description',
        jurisdiction: 'California, USA',
        jurisdictionProvenance: 'USER_PROVIDED',
      });

      expect(updated.title).toBe('Updated Matter Title');
      expect(updated.description).toBe('New detailed description');
      expect(updated.jurisdiction).toBe('California, USA');
    });
  });

  describe('Document Membership & Role Management', () => {
    it('adds ready documents with specific legal roles', async () => {
      const matter = await matterService.createMatter({ title: 'Corporate Real Estate Lease' });

      const doc1 = await docService.uploadDocument({
        filename: 'master_lease.pdf',
        mimeType: 'application/pdf',
        buffer: createSamplePdf('Master Lease Agreement dated Jan 1 2024'),
      });
      await docService.processDocument(doc1.id);

      const doc2 = await docService.uploadDocument({
        filename: 'amendment_one.pdf',
        mimeType: 'application/pdf',
        buffer: createSamplePdf('First Amendment to Lease Agreement'),
      });
      await docService.processDocument(doc2.id);

      const member1 = await matterService.addDocumentToMatter(
        matter.id,
        doc1.id,
        'PRIMARY_AGREEMENT'
      );
      expect(member1.role).toBe('PRIMARY_AGREEMENT');
      expect(member1.originalFilename).toBe('master_lease.pdf');

      const member2 = await matterService.addDocumentToMatter(
        matter.id,
        doc2.id,
        'AMENDMENT'
      );
      expect(member2.role).toBe('AMENDMENT');

      const detail = await matterService.getMatter(matter.id);
      expect(detail.documents).toHaveLength(2);
      expect(detail.metrics.totalDocuments).toBe(2);
    });

    it('rejects adding non-ready or un-processed documents', async () => {
      const matter = await matterService.createMatter({ title: 'Test Matter' });
      const doc = await docService.uploadDocument({
        filename: 'unprocessed.pdf',
        mimeType: 'application/pdf',
        buffer: createSamplePdf('Raw text'),
      });

      await expect(
        matterService.addDocumentToMatter(matter.id, doc.id, 'SUPPORTING_DOCUMENT')
      ).rejects.toThrow(ValidationError);
    });

    it('rejects adding duplicate document to same matter', async () => {
      const matter = await matterService.createMatter({ title: 'Duplicate Doc Matter' });
      const doc = await docService.uploadDocument({
        filename: 'duplicate_check.pdf',
        mimeType: 'application/pdf',
        buffer: createSamplePdf('Unique content'),
      });
      await docService.processDocument(doc.id);

      await matterService.addDocumentToMatter(matter.id, doc.id, 'SUPPORTING_DOCUMENT');

      await expect(
        matterService.addDocumentToMatter(matter.id, doc.id, 'SUPPORTING_DOCUMENT')
      ).rejects.toThrow(ValidationError);
    });

    it('updates document role within matter', async () => {
      const matter = await matterService.createMatter({ title: 'Role Update Matter' });
      const doc = await docService.uploadDocument({
        filename: 'service_agreement.pdf',
        mimeType: 'application/pdf',
        buffer: createSamplePdf('Service Agreement content'),
      });
      await docService.processDocument(doc.id);

      await matterService.addDocumentToMatter(matter.id, doc.id, 'SUPPORTING_DOCUMENT');

      const updated = await matterService.updateDocumentRole(
        matter.id,
        doc.id,
        'PRIMARY_AGREEMENT'
      );
      expect(updated.role).toBe('PRIMARY_AGREEMENT');
    });

    it('removes document from matter without deleting the physical document', async () => {
      const matter = await matterService.createMatter({ title: 'Document Detach Matter' });
      const doc = await docService.uploadDocument({
        filename: 'preservation_test.pdf',
        mimeType: 'application/pdf',
        buffer: createSamplePdf('Document that must be preserved'),
      });
      await docService.processDocument(doc.id);

      await matterService.addDocumentToMatter(matter.id, doc.id, 'SUPPORTING_DOCUMENT');

      // Remove from matter
      await matterService.removeDocumentFromMatter(matter.id, doc.id);

      const detail = await matterService.getMatter(matter.id);
      expect(detail.documents).toHaveLength(0);

      // Verify physical document in documents table STILL EXISTS and is READY!
      const docAfter = await docService.getDocumentById(doc.id);
      expect(docAfter).toBeDefined();
      expect(docAfter?.status).toBe('READY');
      expect(docAfter?.originalFilename).toBe('preservation_test.pdf');
    });
  });

  describe('Document Deletion Safety & Cascade Isolation', () => {
    it('deleting a matter cascades matter relations but NEVER deletes underlying documents', async () => {
      const matter = await matterService.createMatter({ title: 'Matter To Delete' });
      const doc = await docService.uploadDocument({
        filename: 'safe_keeper.pdf',
        mimeType: 'application/pdf',
        buffer: createSamplePdf('Crucial document that must not be deleted'),
      });
      await docService.processDocument(doc.id);

      await matterService.addDocumentToMatter(matter.id, doc.id, 'PRIMARY_AGREEMENT');
      await matterService.addNote(matter.id, 'Notice Note', 'Remember to check renewal date.');

      // Delete the matter
      await matterService.deleteMatter(matter.id);

      // Matter should be gone
      await expect(matterService.getMatter(matter.id)).rejects.toThrow(NotFoundError);

      // CRITICAL SAFETY: Underlying document STILL EXISTS and was NOT deleted!
      const preservedDoc = await docService.getDocumentById(doc.id);
      expect(preservedDoc).toBeDefined();
      expect(preservedDoc?.id).toBe(doc.id);
      expect(preservedDoc?.status).toBe('READY');
    });
  });

  describe('User Matter Notes', () => {
    it('adds, gets, and deletes user notes for a matter', async () => {
      const matter = await matterService.createMatter({ title: 'Notes Matter' });

      const note1 = await matterService.addNote(
        matter.id,
        'Consultation Goal',
        'Ask counsel if 30-day notice applies before renewal.'
      );

      expect(note1.id).toBeDefined();
      expect(note1.title).toBe('Consultation Goal');
      expect(note1.content).toContain('Ask counsel if 30-day notice');

      const notes = await matterService.getNotes(matter.id);
      expect(notes).toHaveLength(1);
      expect(notes[0].id).toBe(note1.id);

      await matterService.deleteNote(matter.id, note1.id);
      const notesAfter = await matterService.getNotes(matter.id);
      expect(notesAfter).toHaveLength(0);
    });
  });
});
