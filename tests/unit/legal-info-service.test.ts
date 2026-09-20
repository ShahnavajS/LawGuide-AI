/**
 * Unit Tests for LegalInformationService (LexiGuide AI Phase 7).
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { LegalInformationService } from '@/lib/legal-info/service';
import { DocumentService } from '@/lib/document/service';
import { LocalStorageService } from '@/lib/document/storage';
import { AnalysisService } from '@/lib/analysis/service';
import { LEGAL_INFO_MODES, JURISDICTION_SOURCE_TYPES, EVIDENCE_SOURCE_TYPES } from '@/lib/ai/safety';
import { POST as legalInfoQueryHandler } from '@/app/api/legal-info/query/route';
import { authenticatedRequest } from '../helpers/authenticated-request';
import path from 'path';
import fs from 'fs/promises';

function createTestPdf(): Buffer {
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
<< /Length 160 >>
stream
BT
/F1 14 Tf
50 700 Td
(Master Services Agreement governed by Laws of India.) Tj
0 -50 Td
(Either party may terminate this agreement with 30 days written notice.) Tj
0 -50 Td
(Contractor shall defend and indemnify Client against all third-party claims.) Tj
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
0000000444 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
529
%%EOF`;
  return Buffer.from(pdfString);
}

describe('Phase 7: LegalInformationService Layer', () => {
  const testStorageDir = path.join(process.cwd(), 'uploads_test_legal_info');
  let storage: LocalStorageService;
  let docService: DocumentService;
  let analysisService: AnalysisService;
  let legalInfoService: LegalInformationService;

  beforeEach(async () => {
    storage = new LocalStorageService(testStorageDir);
    docService = new DocumentService(storage);
    analysisService = new AnalysisService();
    legalInfoService = new LegalInformationService();
  });

  afterAll(async () => {
    try {
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('retrieves general educational dossier for a valid topic without document evidence', async () => {
    const dossier = await legalInfoService.getLegalInformation({
      topic: 'INDEMNIFICATION',
      userJurisdiction: { country: 'India' },
    });

    expect(dossier).toBeDefined();
    expect(dossier.topic).toBe('INDEMNIFICATION');
    expect(dossier.topicLabel).toBe('Indemnification');
    expect(dossier.mode).toBe(LEGAL_INFO_MODES.GENERAL_LEGAL_INFO);
    expect(dossier.jurisdiction.country).toBe('India');
    expect(dossier.jurisdiction.source).toBe(JURISDICTION_SOURCE_TYPES.USER_PROVIDED_JURISDICTION);
    expect(dossier.sources.length).toBeGreaterThan(0);
    expect(dossier.importantLimitations.length).toBeGreaterThan(0);
    expect(dossier.questionsForCounsel.length).toBeGreaterThan(0);
  });

  it('throws descriptive error for unknown topics', async () => {
    await expect(
      legalInfoService.getLegalInformation({ topic: 'UNRECOGNIZED_ALIEN_LAW' })
    ).rejects.toThrow('Unknown legal topic');
  });

  it('returns a safe not-found response without echoing an unknown topic', async () => {
    const secretTopic = 'UNKNOWN_TOPIC_WITH_PRIVATE_CONTEXT_123';
    const request = authenticatedRequest('http://localhost/api/legal-info/query', {
      method: 'POST',
      body: JSON.stringify({ topic: secretTopic, question: 'What does this mean?' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await legalInfoQueryHandler(request);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(JSON.stringify(body)).not.toContain(secretTopic);
  });

  it('grounds document evidence and elevates mode to MY_DOCUMENT when document contains clause', async () => {
    // 1. Upload and analyze document
    const fileBuffer = createTestPdf();
    const doc = await docService.uploadDocument({
      filename: 'consulting_india.pdf',
      mimeType: 'application/pdf',
      buffer: fileBuffer,
    });
    await docService.processDocument(doc.id);
    await analysisService.analyzeDocument(doc.id, { force: false });

    // 2. Fetch legal info for TERMINATION with documentId
    const dossier = await legalInfoService.getLegalInformation({
      topic: 'TERMINATION',
      documentId: doc.id,
    });

    expect(dossier).toBeDefined();
    expect(dossier.mode).toBe(LEGAL_INFO_MODES.MY_DOCUMENT);
    expect(dossier.documentEvidence.length).toBeGreaterThan(0);

    const firstEvidence = dossier.documentEvidence[0];
    expect(firstEvidence.documentId).toBe(doc.id);
    expect(firstEvidence.pageNumber).toBe(1);
    expect(firstEvidence.classification).toBe(EVIDENCE_SOURCE_TYPES.DOCUMENT_FACT);
    expect(firstEvidence.isValidated).toBe(true);
  });

  it('answers controlled concept questions with separate document facts and general legal principles', async () => {
    const fileBuffer = createTestPdf();
    const doc = await docService.uploadDocument({
      filename: 'services.pdf',
      mimeType: 'application/pdf',
      buffer: fileBuffer,
    });
    await docService.processDocument(doc.id);
    await analysisService.analyzeDocument(doc.id, { force: false });

    const res = await legalInfoService.answerConceptQuestion({
      topic: 'TERMINATION',
      question: 'What notice is required to end the agreement?',
      documentId: doc.id,
    });

    expect(res).toBeDefined();
    expect(res.topic).toBe('TERMINATION');
    expect(res.documentAnswer).toBeDefined();
    expect(res.generalLegalInfo).toBeDefined();
    expect(res.generalLegalInfo.sources.length).toBeGreaterThan(0);
    expect(res.questionsForCounsel.length).toBeGreaterThan(0);
    expect(res.limitations.length).toBeGreaterThan(0);
  });

  it('retrieves authoritative legal aid resources for India', () => {
    const aid = legalInfoService.getLegalAid('India');
    expect(aid.length).toBeGreaterThan(0);
    expect(aid.some((a) => a.id === 'NALSA_INDIA')).toBe(true);
    expect(aid.some((a) => a.helpline === '15100')).toBe(true);
  });
});
