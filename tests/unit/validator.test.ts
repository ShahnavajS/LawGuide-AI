import { describe, it, expect } from 'vitest';
import { CitationValidator } from '@/lib/evidence/validator';

describe('Phase 4: Citation Validator & Evidence Grounding', () => {
  const validator = new CitationValidator();

  const mockPages = [
    {
      pageNumber: 1,
      text: 'MASTER SERVICES AGREEMENT\nThis Agreement is entered into by and between Acme Corp and Beta LLC.',
    },
    {
      pageNumber: 2,
      text: 'TERMINATION AND NOTICE\nEither party may terminate this agreement by providing thirty (30) days prior written notice.',
    },
    {
      pageNumber: 3,
      text: 'CONFIDENTIALITY OBLIGATIONS\nEach party agrees to hold all Proprietary Information in strict confidence for five (5) years.',
    },
    {
      pageNumber: 4,
      text: '', // Empty or scanned page
    },
  ];

  it('validates an exact quote on the cited page with 1.0 confidence', () => {
    const result = validator.validateCitationAgainstPages(
      {
        pageNumber: 2,
        quotedText: 'Either party may terminate this agreement by providing thirty (30) days prior written notice.',
      },
      mockPages
    );

    expect(result.isValidated).toBe(true);
    expect(result.matchType).toBe('EXACT');
    expect(result.matchConfidence).toBe(1.0);
    expect(result.matchedPageNumber).toBe(2);
  });

  it('validates a quote with whitespace differences caused by PDF extraction', () => {
    // Quote has newlines and extra spaces compared to raw page text
    const result = validator.validateCitationAgainstPages(
      {
        pageNumber: 3,
        quotedText: 'Each  party agrees to hold all\nProprietary Information in strict confidence',
      },
      mockPages
    );

    expect(result.isValidated).toBe(true);
    expect(result.matchType).toBe('NORMALIZED_WHITESPACE');
    expect(result.matchConfidence).toBe(0.95);
    expect(result.matchedPageNumber).toBe(3);
  });

  it('preserves numbers, parentheticals, and punctuation during verification', () => {
    const result = validator.validateCitationAgainstPages(
      {
        pageNumber: 2,
        quotedText: 'thirty (30) days prior written notice.',
      },
      mockPages
    );

    expect(result.isValidated).toBe(true);
    expect(result.matchType).toBe('EXACT');
  });

  it('rejects a fabricated quote that does not exist on the page', () => {
    const result = validator.validateCitationAgainstPages(
      {
        pageNumber: 2,
        quotedText: 'Immediate termination without any notice is allowed.',
      },
      mockPages
    );

    expect(result.isValidated).toBe(false);
    expect(result.matchType).toBe('NOT_FOUND');
    expect(result.discrepancyNote).toContain('could not be verified');
  });

  it('rejects citations pointing to non-existent page numbers', () => {
    const result = validator.validateCitationAgainstPages(
      {
        pageNumber: 99,
        quotedText: 'Any text here',
      },
      mockPages
    );

    expect(result.isValidated).toBe(false);
    expect(result.matchType).toBe('INVALID_PAGE');
    expect(result.discrepancyNote).toContain('does not exist');
  });

  it('rejects citations referencing an empty or scanned page without text', () => {
    const result = validator.validateCitationAgainstPages(
      {
        pageNumber: 4,
        quotedText: 'Claimed scanned text',
      },
      mockPages
    );

    expect(result.isValidated).toBe(false);
    expect(result.matchType).toBe('NOT_FOUND');
    expect(result.discrepancyNote).toContain('no extractable text');
  });

  it('detects when quoted text was cited on the wrong page', () => {
    // Quote is on Page 3, but citation claimed Page 1
    const result = validator.validateCitationAgainstPages(
      {
        pageNumber: 1,
        quotedText: 'Proprietary Information in strict confidence',
      },
      mockPages
    );

    expect(result.isValidated).toBe(false);
    expect(result.matchType).toBe('NOT_FOUND');
    expect(result.matchedPageNumber).toBe(3);
    expect(result.discrepancyNote).toContain('found on Page 3, not cited Page 1');
  });

  it('detects partial quote matches and flags discrepancy', () => {
    const result = validator.validateCitationAgainstPages(
      {
        pageNumber: 3,
        quotedText: 'Each party agrees to hold all Proprietary Information and will pay ten million dollars penalty',
      },
      mockPages
    );

    expect(result.isValidated).toBe(false);
    expect(result.matchType).toBe('QUOTE_PARTIAL');
    expect(result.discrepancyNote).toContain('partial segment');
  });

  it('reconciles classification by downgrading unverified DOCUMENT_FACT to NEEDS_REVIEW', () => {
    const failedVal = {
      citationId: 'cit_1',
      isValidated: false,
      matchType: 'NOT_FOUND' as const,
      matchConfidence: 0,
      discrepancyNote: 'Quote missing from source text.',
    };

    const reconciliation = validator.reconcileClassification('DOCUMENT_FACT', failedVal);
    expect(reconciliation.reconciledType).toBe('NEEDS_REVIEW');
    expect(reconciliation.discrepancyNote).toBe('Quote missing from source text.');
  });

  it('preserves DOCUMENT_FACT classification when quote validation succeeds', () => {
    const successVal = {
      citationId: 'cit_2',
      isValidated: true,
      matchType: 'EXACT' as const,
      matchConfidence: 1.0,
    };

    const reconciliation = validator.reconcileClassification('DOCUMENT_FACT', successVal);
    expect(reconciliation.reconciledType).toBe('DOCUMENT_FACT');
    expect(reconciliation.discrepancyNote).toBeUndefined();
  });

  describe('Phase 10: Structured Verification Metadata', () => {
    it('populates exactMatch, verificationStatus, and confidenceCategory on exact match', () => {
      const result = validator.validateCitationAgainstPages(
        { pageNumber: 2, quotedText: 'Either party may terminate this agreement' },
        mockPages
      );
      expect(result.isValidated).toBe(true);
      expect(result.exactMatch).toBe(true);
      expect(result.normalizedMatch).toBe(true);
      expect(result.wrongPage).toBe(false);
      expect(result.substringMatch).toBe(false);
      expect(result.verificationStatus).toBe('VERIFIED');
      expect(result.confidenceCategory).toBe('HIGH');
      expect(result.sourcePage).toBe(2);
      expect(result.matchedText).toBe('Either party may terminate this agreement');
    });

    it('populates normalizedMatch on whitespace differences while marking exactMatch as false', () => {
      const result = validator.validateCitationAgainstPages(
        { pageNumber: 1, quotedText: 'MASTER SERVICES   AGREEMENT\nThis   Agreement' },
        mockPages
      );
      expect(result.isValidated).toBe(true);
      expect(result.exactMatch).toBe(false);
      expect(result.normalizedMatch).toBe(true);
      expect(result.verificationStatus).toBe('VERIFIED');
      expect(result.confidenceCategory).toBe('HIGH');
    });

    it('identifies wrongPage when text exists on another page and sets NEEDS_REVIEW', () => {
      const result = validator.validateCitationAgainstPages(
        { pageNumber: 1, quotedText: 'CONFIDENTIALITY OBLIGATIONS' },
        mockPages
      );
      expect(result.isValidated).toBe(false);
      expect(result.wrongPage).toBe(true);
      expect(result.sourcePage).toBe(3);
      expect(result.verificationStatus).toBe('NEEDS_REVIEW');
      expect(result.confidenceCategory).toBe('MEDIUM');
    });

    it('marks substringMatch and LOW confidence for partial quotes', () => {
      const result = validator.validateCitationAgainstPages(
        { pageNumber: 2, quotedText: 'Either party may terminate this agreement with non-existent fabricated conditions' },
        mockPages
      );
      expect(result.isValidated).toBe(false);
      expect(result.substringMatch).toBe(true);
      expect(result.verificationStatus).toBe('NEEDS_REVIEW');
      expect(result.confidenceCategory).toBe('LOW');
    });

    it('marks UNVERIFIED for non-existent text', () => {
      const result = validator.validateCitationAgainstPages(
        { pageNumber: 2, quotedText: 'Completely absent legal paragraph not anywhere.' },
        mockPages
      );
      expect(result.isValidated).toBe(false);
      expect(result.exactMatch).toBe(false);
      expect(result.verificationStatus).toBe('UNVERIFIED');
      expect(result.confidenceCategory).toBe('UNVERIFIED');
    });
  });
});


