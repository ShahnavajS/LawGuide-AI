import { describe, it, expect } from 'vitest';
import {
  createDocumentSourceReference,
  createConsistencySourceReference,
  createUserProvidedSourceReference,
} from '@/lib/evidence/source-reference';

describe('Phase 10: Unified Source Reference Abstraction', () => {
  it('creates document page source reference with exact page and verification metadata', () => {
    const ref = createDocumentSourceReference({
      id: 'ref_doc_1',
      documentId: 'doc_123',
      documentTitle: 'Master Service Agreement',
      pageNumber: 12,
      quotedText: 'Termination may occur upon 30 days written notice.',
      classification: 'DOCUMENT_FACT',
      verificationStatus: 'VERIFIED',
      confidenceCategory: 'HIGH',
      explanation: 'States termination notice period.',
    });

    expect(ref.id).toBe('ref_doc_1');
    expect(ref.sourceType).toBe('DOCUMENT_PAGE');
    expect(ref.displayText).toBe('Master Service Agreement (Page 12)');
    expect(ref.documentId).toBe('doc_123');
    expect(ref.pageNumber).toBe(12);
    expect(ref.quotedText).toBe('Termination may occur upon 30 days written notice.');
    expect(ref.classification).toBe('DOCUMENT_FACT');
    expect(ref.verificationStatus).toBe('VERIFIED');
    expect(ref.confidenceCategory).toBe('HIGH');
    expect(ref.navigationTarget).toEqual({
      docId: 'doc_123',
      page: 12,
    });
  });

  it('creates consistency source reference linking conflicting documents and pages', () => {
    const ref = createConsistencySourceReference({
      findingId: 'cf_999',
      category: 'NOTICE',
      sourceDocId: 'doc_msa',
      sourceDocTitle: 'Master Agreement',
      sourcePage: 12,
      targetDocId: 'doc_sow',
      targetDocTitle: 'Statement of Work',
      targetPage: 4,
    });

    expect(ref.id).toBe('cf_999');
    expect(ref.sourceType).toBe('CONSISTENCY_FINDING');
    expect(ref.displayText).toContain('Consistency Observation: NOTICE');
    expect(ref.displayText).toContain('Master Agreement (p.12)');
    expect(ref.displayText).toContain('Statement of Work (p.4)');
    expect(ref.navigationTarget.tab).toBe('consistency');
    expect(ref.navigationTarget.itemId).toBe('cf_999');
    expect(ref.navigationTarget.page).toBe(12);
  });

  it('creates user-provided source reference and marks it unverified without fabricating document evidence', () => {
    const ref = createUserProvidedSourceReference({
      id: 'note_user_1',
      noteTitle: 'Oral agreement on invoice discount',
      contentExcerpt: 'Client stated invoice was discounted by 10% verbally.',
    });

    expect(ref.id).toBe('note_user_1');
    expect(ref.sourceType).toBe('USER_NOTE');
    expect(ref.displayText).toBe('User Note: "Oral agreement on invoice discount"');
    expect(ref.classification).toBe('USER_PROVIDED');
    expect(ref.verificationStatus).toBe('UNVERIFIED');
    expect(ref.confidenceCategory).toBe('UNVERIFIED');
    expect(ref.documentId).toBeUndefined();
    expect(ref.pageNumber).toBeUndefined();
    expect(ref.navigationTarget.tab).toBe('notes');
    expect(ref.explanation).toContain('Entered directly by user');
  });
});
