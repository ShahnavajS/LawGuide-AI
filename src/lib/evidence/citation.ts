/**
 * Evidence & Citation Models.
 *
 * Grounding citations bind every AI assertion to verifiable source excerpts.
 */

import { EvidenceSourceType, EVIDENCE_SOURCE_TYPES, EVIDENCE_CLASSIFICATIONS } from '@/lib/ai/safety';

export { EVIDENCE_SOURCE_TYPES, EVIDENCE_CLASSIFICATIONS };
export type { EvidenceSourceType };

export interface Citation {
  id: string;
  documentId: string;
  analysisId?: string;
  sourceType: EvidenceSourceType;
  pageNumber?: number;
  sectionReference?: string;
  quotedText: string;
  surroundingContext?: string;
  confidenceScore: number;
  createdAt: string;
}

export interface CreateCitationInput {
  documentId: string;
  analysisId?: string;
  sourceType: EvidenceSourceType;
  pageNumber?: number;
  sectionReference?: string;
  quotedText: string;
  surroundingContext?: string;
  confidenceScore?: number;
}
