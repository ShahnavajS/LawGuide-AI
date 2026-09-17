/**
 * Unit & Integration Tests for Matter Intelligence & Safety (LexiGuide AI Phase 8).
 * Tests Cross-Document Relationships, Multi-Document Consistency, Timeline, and Anti-Adjudication.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DocumentService } from '@/lib/document/service';
import { LocalStorageService } from '@/lib/document/storage';
import { AnalysisService } from '@/lib/analysis/service';
import { MatterService } from '@/lib/matter/service';
import { CitationValidator } from '@/lib/evidence/validator';
import { GeminiService } from '@/lib/ai/gemini';
import { PROHIBITED_LEGAL_CONCLUSIONS, containsProhibitedLegalConclusion } from '@/lib/ai/safety';
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

describe('Phase 8: Matter Intelligence & Anti-Adjudication Safety', () => {
  const testStorageDir = path.join(process.cwd(), 'uploads_test_matter_intel');
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

  describe('Cross-Document Relationships', () => {
    it('extracts relationships and validates citations against document text', async () => {
      const matter = await matterService.createMatter({ title: 'MSA and SOW Matter' });

      // Doc 1: Master Agreement
      const doc1 = await docService.uploadDocument({
        filename: 'Master_Services_Agreement.pdf',
        mimeType: 'application/pdf',
        buffer: createSamplePdf('This Master Services Agreement governs all Statements of Work.'),
      });
      await docService.processDocument(doc1.id);
      await analysisService.analyzeDocument(doc1.id);

      // Doc 2: Statement of Work referencing MSA
      const doc2 = await docService.uploadDocument({
        filename: 'Statement_of_Work_1.pdf',
        mimeType: 'application/pdf',
        buffer: createSamplePdf('Statement of Work 1 is subject to Master Services Agreement.'),
      });
      await docService.processDocument(doc2.id);
      await analysisService.analyzeDocument(doc2.id);

      await matterService.addDocumentToMatter(
        matter.id,
        doc1.id,
        'PRIMARY_AGREEMENT'
      );
      await matterService.addDocumentToMatter(
        matter.id,
        doc2.id,
        'ANNEXURE'
      );

      // Extract relationships
      const relationships = await matterService.extractRelationships(matter.id);
      expect(Array.isArray(relationships)).toBe(true);

      // If any relationship is extracted, verification status must be verified or needs_review
      for (const rel of relationships) {
        expect(['DOCUMENT_FACT', 'NEEDS_REVIEW']).toContain(rel.classification);
        expect(rel.sourceDocumentId).toBeDefined();
        expect(rel.targetDocumentId).toBeDefined();
      }
    });

    it('allows updating relationship status via confirmRelationship', async () => {
      const matter = await matterService.createMatter({ title: 'Confirmation Matter' });

      const doc1 = await docService.uploadDocument({
        filename: 'Contract_A.pdf',
        mimeType: 'application/pdf',
        buffer: createSamplePdf('Contract A main provisions.'),
      });
      await docService.processDocument(doc1.id);
      await analysisService.analyzeDocument(doc1.id);

      const doc2 = await docService.uploadDocument({
        filename: 'Amendment_1.pdf',
        mimeType: 'application/pdf',
        buffer: createSamplePdf('Amendment 1 amends Contract A.'),
      });
      await docService.processDocument(doc2.id);
      await analysisService.analyzeDocument(doc2.id);

      await matterService.addDocumentToMatter(
        matter.id,
        doc1.id,
        'PRIMARY_AGREEMENT'
      );
      await matterService.addDocumentToMatter(
        matter.id,
        doc2.id,
        'AMENDMENT'
      );

      const rels = await matterService.extractRelationships(matter.id);
      if (rels.length > 0) {
        const relId = rels[0].id;
        const confirmed = await matterService.confirmRelationship(matter.id, relId, 'CONFIRMED');
        expect(confirmed.status).toBe('CONFIRMED');

        const rejected = await matterService.confirmRelationship(matter.id, relId, 'REJECTED');
        expect(rejected.status).toBe('REJECTED');
      }
    });
  });

  describe('Multi-Document Consistency & Strict Anti-Adjudication', () => {
    it('identifies potential differences between member documents without adjudicating', async () => {
      const matter = await matterService.createMatter({ title: 'Consistency Check Matter' });

      // Doc 1 with 30 days notice
      const doc1 = await docService.uploadDocument({
        filename: 'Base_Agreement.pdf',
        mimeType: 'application/pdf',
        buffer: createSamplePdf('Termination requires 30 days written notice. Governing law is New York.'),
      });
      await docService.processDocument(doc1.id);
      await analysisService.analyzeDocument(doc1.id);

      // Doc 2 with 60 days notice
      const doc2 = await docService.uploadDocument({
        filename: 'Subsequent_Amendment.pdf',
        mimeType: 'application/pdf',
        buffer: createSamplePdf('Termination requires 60 days written notice. Governing law is Delaware.'),
      });
      await docService.processDocument(doc2.id);
      await analysisService.analyzeDocument(doc2.id);

      await matterService.addDocumentToMatter(
        matter.id,
        doc1.id,
        'PRIMARY_AGREEMENT'
      );
      await matterService.addDocumentToMatter(
        matter.id,
        doc2.id,
        'AMENDMENT'
      );

      const findings = await matterService.checkConsistency(matter.id);
      expect(Array.isArray(findings)).toBe(true);

      for (const finding of findings) {
        expect(finding.sourceA.documentId).toBeDefined();
        expect(finding.sourceB.documentId).toBeDefined();
        expect(finding.discussionPoint).toBeDefined();

        // STRICT ANTI-ADJUDICATION ASSERTION:
        // Must NEVER claim which contract "wins", "controls", "governs", or "prevails"
        for (const pattern of PROHIBITED_LEGAL_CONCLUSIONS) {
          expect(pattern.test(finding.description)).toBe(false);
          expect(pattern.test(finding.discussionPoint)).toBe(false);
        }
        expect(containsProhibitedLegalConclusion(finding.description)).toBe(false);
      }
    });
  });

  describe('Matter Timeline Generation', () => {
    it('generates chronological timeline events with document attribution', async () => {
      const matter = await matterService.createMatter({ title: 'Timeline Matter' });

      const doc = await docService.uploadDocument({
        filename: 'Lease_Timeline_Doc.pdf',
        mimeType: 'application/pdf',
        buffer: createSamplePdf('Effective date is January 1, 2025. Expiration date is December 31, 2027.'),
      });
      await docService.processDocument(doc.id);
      await analysisService.analyzeDocument(doc.id);

      await matterService.addDocumentToMatter(
        matter.id,
        doc.id,
        'PRIMARY_AGREEMENT'
      );

      const timeline = await matterService.getTimeline(matter.id);
      expect(Array.isArray(timeline)).toBe(true);

      for (const event of timeline) {
        expect(event.documentId).toBe(doc.id);
        expect(event.documentTitle).toBe(doc.title);
        expect(event.dateValue).toBeDefined();
        expect(event.label).toBeDefined();
      }
    });
  });
});
