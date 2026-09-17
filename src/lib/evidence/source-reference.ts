/**
 * Unified Source Reference & Normalized Evidence Object Model for LexiGuide AI.
 *
 * Provides a standardized provenance abstraction linking any finding, action item,
 * counsel question, brief section, or Q&A answer directly back to its source document,
 * exact page, and verbatim verified text.
 */

import {
  EvidenceType,
  EvidenceSourceType,
  VerificationStatus,
  ConfidenceCategory,
} from '@/lib/ai/safety';

export type UnifiedSourceType =
  | 'DOCUMENT_PAGE'
  | 'LEGAL_XRAY'
  | 'COMPARISON'
  | 'RELATIONSHIP'
  | 'CONSISTENCY_FINDING'
  | 'TIMELINE_EVENT'
  | 'LEGAL_INFO_TOPIC'
  | 'USER_NOTE'
  | 'USER_CREATED'
  | 'MATTER_FINDING';

export interface NavigationTarget {
  tab?: 'overview' | 'documents' | 'relationships' | 'consistency' | 'timeline' | 'actionPlan' | 'sourceMap' | 'questions' | 'prepare' | 'ask' | 'notes';
  docId?: string;
  page?: number;
  itemId?: string;
  topicId?: string;
  comparisonId?: string;
}

export interface UnifiedSourceReference {
  id: string;
  sourceType: UnifiedSourceType;
  displayText: string;
  documentId?: string;
  documentTitle?: string;
  pageNumber?: number;
  quotedText?: string;
  normalizedQuote?: string;
  classification: EvidenceSourceType;
  verificationStatus: VerificationStatus;
  confidenceCategory: ConfidenceCategory;
  navigationTarget: NavigationTarget;
  explanation?: string;
  createdAt: string;
}

/**
 * Normalized internal Evidence Reference model.
 */
export interface EvidenceReference {
  id: string;
  matterId?: string;
  evidenceType: EvidenceType;
  documentId?: string;
  documentTitle?: string;
  pageNumber?: number;
  quotedText?: string;
  normalizedQuote?: string;
  classification: EvidenceSourceType;
  verificationStatus: VerificationStatus;
  confidenceCategory: ConfidenceCategory;
  sourceReference?: string;
  targetDocumentId?: string;
  targetDocumentTitle?: string;
  targetPageNumber?: number;
  targetQuote?: string;
  usedBy: Array<{
    type: 'CONSISTENCY' | 'QUESTION' | 'ACTION_ITEM' | 'RELATIONSHIP' | 'BRIEF' | 'TIMELINE';
    id: string;
    title: string;
  }>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Factory helpers to construct standardized UnifiedSourceReferences.
 */
export function createDocumentSourceReference(params: {
  id: string;
  documentId: string;
  documentTitle: string;
  pageNumber?: number;
  quotedText?: string;
  classification?: EvidenceSourceType;
  verificationStatus?: VerificationStatus;
  confidenceCategory?: ConfidenceCategory;
  explanation?: string;
}): UnifiedSourceReference {
  const pageStr = params.pageNumber ? `Page ${params.pageNumber}` : 'General';
  return {
    id: params.id,
    sourceType: 'DOCUMENT_PAGE',
    displayText: `${params.documentTitle} (${pageStr})`,
    documentId: params.documentId,
    documentTitle: params.documentTitle,
    pageNumber: params.pageNumber,
    quotedText: params.quotedText,
    classification: params.classification || 'DOCUMENT_FACT',
    verificationStatus: params.verificationStatus || 'VERIFIED',
    confidenceCategory: params.confidenceCategory || 'HIGH',
    navigationTarget: {
      docId: params.documentId,
      page: params.pageNumber,
    },
    explanation: params.explanation,
    createdAt: new Date().toISOString(),
  };
}

export function createConsistencySourceReference(params: {
  findingId: string;
  category: string;
  sourceDocId?: string;
  sourceDocTitle?: string;
  sourcePage?: number;
  targetDocId?: string;
  targetDocTitle?: string;
  targetPage?: number;
}): UnifiedSourceReference {
  const sourcePart = params.sourceDocTitle ? `${params.sourceDocTitle} (p.${params.sourcePage || '?'})` : 'Document A';
  const targetPart = params.targetDocTitle ? `${params.targetDocTitle} (p.${params.targetPage || '?'})` : 'Document B';
  return {
    id: params.findingId,
    sourceType: 'CONSISTENCY_FINDING',
    displayText: `Consistency Observation: ${params.category} (${sourcePart} ↔ ${targetPart})`,
    documentId: params.sourceDocId,
    documentTitle: params.sourceDocTitle,
    pageNumber: params.sourcePage,
    classification: 'DOCUMENT_FACT',
    verificationStatus: 'VERIFIED',
    confidenceCategory: 'HIGH',
    navigationTarget: {
      tab: 'consistency',
      itemId: params.findingId,
      docId: params.sourceDocId,
      page: params.sourcePage,
    },
    explanation: `Discrepancy identified between ${sourcePart} and ${targetPart}.`,
    createdAt: new Date().toISOString(),
  };
}

export function createUserProvidedSourceReference(params: {
  id: string;
  noteTitle: string;
  contentExcerpt?: string;
}): UnifiedSourceReference {
  return {
    id: params.id,
    sourceType: 'USER_NOTE',
    displayText: `User Note: "${params.noteTitle}"`,
    quotedText: params.contentExcerpt,
    classification: 'USER_PROVIDED',
    verificationStatus: 'UNVERIFIED',
    confidenceCategory: 'UNVERIFIED',
    navigationTarget: {
      tab: 'notes',
      itemId: params.id,
    },
    explanation: 'Entered directly by user as contextual background; not independently verified against documents.',
    createdAt: new Date().toISOString(),
  };
}
