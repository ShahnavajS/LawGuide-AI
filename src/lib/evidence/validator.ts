/**
 * Evidence Validation Engine for LexiGuide AI.
 *
 * Verifies that AI-generated citations and quotations actually exist in the
 * processed document pages without fabricating verification.
 */

import { EvidenceSourceType } from './citation';
import { VerificationStatus, ConfidenceCategory } from '@/lib/ai/safety';

export type CitationMatchType =
  | 'EXACT'
  | 'NORMALIZED_WHITESPACE'
  | 'QUOTE_PARTIAL'
  | 'NOT_FOUND'
  | 'INVALID_PAGE'
  | 'DOCUMENT_MISMATCH';

export interface CitationValidationResult {
  citationId: string;
  isValidated: boolean;
  matchType: CitationMatchType;
  matchConfidence: number;
  matchedPageNumber?: number;
  discrepancyNote?: string;
  // Phase 10: Structured verification metadata
  exactMatch: boolean;
  normalizedMatch: boolean;
  wrongPage: boolean;
  substringMatch: boolean;
  verificationStatus: VerificationStatus;
  confidenceCategory: ConfidenceCategory;
  sourcePage?: number;
  matchedText?: string;
}

export interface PageEvidenceSource {
  pageNumber: number;
  text: string;
}

export class CitationValidator {
  /**
   * Validates a citation against document pages.
   */
  public validateCitationAgainstPages(
    citation: {
      id?: string;
      pageNumber?: number | null;
      quotedText: string;
      documentId?: string;
    },
    pages: PageEvidenceSource[]
  ): CitationValidationResult {
    const citationId = citation.id || 'temp_cit';

    // 1. Quoted text check
    const trimmedQuote = (citation.quotedText || '').trim();
    if (!trimmedQuote) {
      return {
        citationId,
        isValidated: false,
        matchType: 'NOT_FOUND',
        matchConfidence: 0,
        exactMatch: false,
        normalizedMatch: false,
        wrongPage: false,
        substringMatch: false,
        verificationStatus: 'UNVERIFIED',
        confidenceCategory: 'UNVERIFIED',
        discrepancyNote: 'Citation contains no quoted text to verify.',
      };
    }

    // 2. Page existence check
    const pageNum = citation.pageNumber;
    if (pageNum == null || pageNum <= 0 || !Number.isInteger(pageNum)) {
      return {
        citationId,
        isValidated: false,
        matchType: 'INVALID_PAGE',
        matchConfidence: 0,
        exactMatch: false,
        normalizedMatch: false,
        wrongPage: false,
        substringMatch: false,
        verificationStatus: 'UNVERIFIED',
        confidenceCategory: 'UNVERIFIED',
        discrepancyNote: `Invalid page number specified: ${pageNum}.`,
      };
    }

    const targetPage = pages.find((p) => p.pageNumber === pageNum);
    if (!targetPage) {
      return {
        citationId,
        isValidated: false,
        matchType: 'INVALID_PAGE',
        matchConfidence: 0,
        exactMatch: false,
        normalizedMatch: false,
        wrongPage: false,
        substringMatch: false,
        verificationStatus: 'UNVERIFIED',
        confidenceCategory: 'UNVERIFIED',
        discrepancyNote: `Page ${pageNum} does not exist in the document (document has ${pages.length} pages).`,
      };
    }

    // 3. Check for empty or scanned page
    const pageText = targetPage.text || '';
    if (pageText.trim().length === 0) {
      return {
        citationId,
        isValidated: false,
        matchType: 'NOT_FOUND',
        matchConfidence: 0,
        matchedPageNumber: pageNum,
        sourcePage: pageNum,
        exactMatch: false,
        normalizedMatch: false,
        wrongPage: false,
        substringMatch: false,
        verificationStatus: 'UNVERIFIED',
        confidenceCategory: 'UNVERIFIED',
        discrepancyNote: `Page ${pageNum} has no extractable text (may be an image or scanned page).`,
      };
    }

    // 4. Exact match check
    if (pageText.includes(trimmedQuote)) {
      return {
        citationId,
        isValidated: true,
        matchType: 'EXACT',
        matchConfidence: 1.0,
        matchedPageNumber: pageNum,
        sourcePage: pageNum,
        matchedText: trimmedQuote,
        exactMatch: true,
        normalizedMatch: true,
        wrongPage: false,
        substringMatch: false,
        verificationStatus: 'VERIFIED',
        confidenceCategory: 'HIGH',
      };
    }

    // 5. Normalized whitespace match (PDF extraction artifacts: newlines, multiple spaces)
    // Preserves all punctuation, numbers, casing, and words.
    const normPage = pageText.replace(/\s+/g, ' ').trim();
    const normQuote = trimmedQuote.replace(/\s+/g, ' ').trim();

    if (normPage.includes(normQuote)) {
      return {
        citationId,
        isValidated: true,
        matchType: 'NORMALIZED_WHITESPACE',
        matchConfidence: 0.95,
        matchedPageNumber: pageNum,
        sourcePage: pageNum,
        matchedText: normQuote,
        exactMatch: false,
        normalizedMatch: true,
        wrongPage: false,
        substringMatch: false,
        verificationStatus: 'VERIFIED',
        confidenceCategory: 'HIGH',
      };
    }

    // 6. Check if quote appears on an adjacent or another page in the document
    for (const otherPage of pages) {
      if (otherPage.pageNumber === pageNum) continue;
      const otherNorm = (otherPage.text || '').replace(/\s+/g, ' ').trim();
      if (otherNorm.includes(normQuote)) {
        return {
          citationId,
          isValidated: false,
          matchType: 'NOT_FOUND',
          matchConfidence: 0.5,
          matchedPageNumber: otherPage.pageNumber,
          sourcePage: otherPage.pageNumber,
          matchedText: normQuote,
          exactMatch: false,
          normalizedMatch: true,
          wrongPage: true,
          substringMatch: false,
          verificationStatus: 'NEEDS_REVIEW',
          confidenceCategory: 'MEDIUM',
          discrepancyNote: `Quoted text was found on Page ${otherPage.pageNumber}, not cited Page ${pageNum}.`,
        };
      }
    }

    // 7. Check for partial quote match (if substantial leading words match sequentially)
    const quoteWords = normQuote.split(' ').filter(Boolean);
    if (quoteWords.length >= 4) {
      const subLen = Math.max(3, Math.floor(quoteWords.length * 0.5));
      const subQuote = quoteWords.slice(0, subLen).join(' ');
      if (normPage.includes(subQuote)) {
        return {
          citationId,
          isValidated: false,
          matchType: 'QUOTE_PARTIAL',
          matchConfidence: 0.4,
          matchedPageNumber: pageNum,
          sourcePage: pageNum,
          matchedText: subQuote,
          exactMatch: false,
          normalizedMatch: false,
          wrongPage: false,
          substringMatch: true,
          verificationStatus: 'NEEDS_REVIEW',
          confidenceCategory: 'LOW',
          discrepancyNote: 'Only a partial segment of the quote was located on the cited page.',
        };
      }
    }

    // 8. Quote not found on page
    return {
      citationId,
      isValidated: false,
      matchType: 'NOT_FOUND',
      matchConfidence: 0,
      matchedPageNumber: pageNum,
      sourcePage: pageNum,
      exactMatch: false,
      normalizedMatch: false,
      wrongPage: false,
      substringMatch: false,
      verificationStatus: 'UNVERIFIED',
      confidenceCategory: 'UNVERIFIED',
      discrepancyNote: `Quoted text could not be verified in the text of Page ${pageNum}.`,
    };
  }

  /**
   * Reconciles a proposed citation's evidence classification:
   * If validation fails, downgrades DOCUMENT_FACT to NEEDS_REVIEW to prevent fabricated claims.
   */
  public reconcileClassification(
    sourceType: EvidenceSourceType,
    validation: { isValidated: boolean; discrepancyNote?: string }
  ): { reconciledType: EvidenceSourceType; discrepancyNote?: string } {
    if (validation.isValidated) {
      return { reconciledType: sourceType };
    }

    // If unverified, never allow DOCUMENT_FACT
    if (sourceType === 'DOCUMENT_FACT') {
      return {
        reconciledType: 'NEEDS_REVIEW',
        discrepancyNote:
          validation.discrepancyNote || 'Unverified citation: Quote could not be confirmed in source text.',
      };
    }

    return {
      reconciledType: sourceType,
      discrepancyNote: validation.discrepancyNote,
    };
  }
}

export const citationValidator = new CitationValidator();
