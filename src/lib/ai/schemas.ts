/**
 * TypeScript definitions and schemas for GenAI structured outputs (LexiGuide AI).
 *
 * Establishes strict domain models for Legal X-Ray analysis, evidence grounding,
 * obligations, material clauses, and review attention areas.
 */

import { EvidenceSourceType } from './safety';

export type AttentionCategory =
  | 'PAYMENT'
  | 'TERMINATION'
  | 'RENEWAL'
  | 'LIABILITY'
  | 'INDEMNITY'
  | 'CONFIDENTIALITY'
  | 'RESTRICTIONS'
  | 'DISPUTE_RESOLUTION'
  | 'PRIVACY'
  | 'DEADLINE'
  | 'OTHER';

export type AttentionLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';

export interface GroundedCitation {
  id: string;
  sourceType: EvidenceSourceType;
  pageNumber: number;
  sectionReference?: string;
  quotedText: string;
  confidenceScore: number;
  isValidated?: boolean;
  discrepancyNote?: string;
}

export interface DocumentOverview {
  documentType: string;
  title: string;
  summary: string;
  governingLaw: string;
  purpose: string;
}

export interface PartyFinding {
  id: string;
  name: string;
  role: string;
  pageNumber: number;
  quotedText: string;
  classification: EvidenceSourceType;
  isValidated?: boolean;
}

export interface DateFinding {
  id: string;
  label: string;
  dateValue: string;
  description: string;
  pageNumber: number;
  quotedText: string;
  classification: EvidenceSourceType;
  isValidated?: boolean;
}

export interface ObligationFinding {
  id: string;
  party: string;
  obligation: string;
  explanation: string;
  conditionOrDeadline?: string;
  attentionLevel: AttentionLevel;
  classification: EvidenceSourceType;
  pageNumber: number;
  quotedText: string;
  sectionReference?: string;
  isValidated?: boolean;
}

export interface RightFinding {
  id: string;
  party: string;
  right: string;
  explanation: string;
  classification: EvidenceSourceType;
  pageNumber: number;
  quotedText: string;
  isValidated?: boolean;
}

export interface FinancialTermFinding {
  id: string;
  term: string;
  amountOrValue: string;
  explanation: string;
  pageNumber: number;
  quotedText: string;
  classification: EvidenceSourceType;
  isValidated?: boolean;
}

export interface MaterialClauseFinding {
  id: string;
  category: AttentionCategory;
  title: string;
  summary: string;
  plainLanguage: string;
  sectionReference?: string;
  pageNumber: number;
  quotedText: string;
  classification: EvidenceSourceType;
  isValidated?: boolean;
}

export interface AttentionAreaFinding {
  id: string;
  category: AttentionCategory;
  attentionLevel: AttentionLevel;
  title: string;
  description: string;
  whyItMatters: string;
  pageNumber: number;
  quotedText: string;
  classification: EvidenceSourceType;
  isValidated?: boolean;
}

export interface LawyerQuestionFinding {
  id: string;
  category: string;
  question: string;
  groundedContext: string;
}

export interface LegalXRayAnalysis {
  documentId: string;
  overview: DocumentOverview;
  parties: PartyFinding[];
  keyDates: DateFinding[];
  obligations: ObligationFinding[];
  rights: RightFinding[];
  financialTerms: FinancialTermFinding[];
  materialClauses: MaterialClauseFinding[];
  attentionAreas: AttentionAreaFinding[];
  lawyerQuestions: LawyerQuestionFinding[];
  validationSummary: {
    totalCitations: number;
    validatedCount: number;
    unverifiedCount: number;
  };
  analyzedAt: string;
  disclaimer: string;
}

export interface LegalAnalysisResult {
  summary: {
    plainLanguage: string;
    documentType: string;
    primaryParties: string[];
    governingLaw?: string;
  };
  keyClauses: MaterialClauseFinding[];
  obligations: ObligationFinding[];
  attentionAreas: AttentionAreaFinding[];
  professionalReviewQuestions: string[];
  disclaimer: string;
}

export interface LegalQAResult {
  answer: string;
  confidence: number;
  classification: EvidenceSourceType;
  citations: GroundedCitation[];
  limitations?: string;
}

export type ComparisonChangeType = 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';

export interface SemanticFieldChange {
  field: string;
  before: string;
  after: string;
  description: string;
}

export interface ComparisonEvidence {
  documentId: string;
  documentTitle?: string;
  pageNumber: number;
  sectionReference?: string;
  quotedText: string;
  classification: EvidenceSourceType;
  isValidated?: boolean;
  discrepancyNote?: string;
}

export interface ComparisonDifferenceItem {
  id: string;
  type: ComparisonChangeType;
  category: AttentionCategory;
  title: string;
  sectionReference?: string;
  baseEvidence?: ComparisonEvidence;
  targetEvidence?: ComparisonEvidence;
  changeSummary: string;
  semanticChanges: SemanticFieldChange[];
  practicalImplications: string;
  attentionLevel: AttentionLevel;
  lawyerQuestion?: string;
  isSubstantive: boolean;
}

export interface ComparisonStatistics {
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  unchangedCount: number;
  substantiveCount: number;
  totalDifferences: number;
}

export interface ComparisonLawyerQuestion {
  id: string;
  category: string;
  question: string;
  groundedContext: string;
}

export interface ComparisonResult {
  id: string;
  baseDocumentId: string;
  targetDocumentId: string;
  summary: {
    plainLanguage: string;
    baseDocumentTitle: string;
    targetDocumentTitle: string;
    baseGoverningLaw?: string;
    targetGoverningLaw?: string;
  };
  statistics: ComparisonStatistics;
  differences: ComparisonDifferenceItem[];
  lawyerQuestions: ComparisonLawyerQuestion[];
  validationSummary: {
    totalCitations: number;
    validatedCount: number;
    unverifiedCount: number;
  };
  comparedAt: string;
  disclaimer: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  processingError?: string;
}

// Backward-compatibility alias for previous imports
export type ComparisonDifference = ComparisonDifferenceItem;

// ============================================================
// Phase 6: Lawyer Consultation Preparation Models
// ============================================================

export type PreparationChecklistCategory =
  | 'BEFORE_CONSULTATION'
  | 'FOR_THE_LAWYER'
  | 'AFTER_CONSULTATION';

export interface PreparationLawyerQuestion {
  id: string;
  category: string;
  question: string;
  whyItMatters?: string;
  groundedContext?: string;
  documentId?: string;
  pageNumber?: number;
  quotedText?: string;
  isCustom?: boolean;
}

export interface PreparationChecklistItem {
  id: string;
  category: PreparationChecklistCategory;
  item: string;
  whyRelevant: string;
  isCompleted: boolean;
}

export interface PreparationDocumentToBring {
  id: string;
  documentName: string;
  reason: string;
  isGeneralSuggestion: boolean;
}

export interface PreparationTimelineEvent {
  id: string;
  label: string;
  dateValue: string;
  description: string;
  pageNumber?: number;
  quotedText?: string;
  documentId?: string;
  documentTitle?: string;
  classification: EvidenceSourceType;
  isValidated?: boolean;
}

export interface PreparationMissingInfoItem {
  id: string;
  item: string;
  whyItMatters: string;
}

export interface PreparationUserNote {
  id: string;
  note: string;
  createdAt: string;
  classification: 'USER_PROVIDED';
}

export interface PreparationKeyFact {
  id: string;
  label: string;
  value: string;
  pageNumber?: number;
  quotedText?: string;
  documentId?: string;
  classification: EvidenceSourceType;
  isValidated?: boolean;
}

export interface PreparationDocumentInfo {
  documentId: string;
  title: string;
  pageCount: number;
  role: 'PRIMARY' | 'BASE' | 'REVISED';
}

export interface PreparationBrief {
  id: string;
  documentId?: string;
  comparisonId?: string;
  matterId?: string;
  purpose: string;
  overview: {
    title: string;
    documentType: string;
    governingLaw: string;
    purpose: string;
    consultationDate?: string;
  };
  documentsUnderReview: PreparationDocumentInfo[];
  keyFacts: PreparationKeyFact[];
  keyDates: PreparationTimelineEvent[];
  financialTerms: FinancialTermFinding[];
  obligations: ObligationFinding[];
  rights: RightFinding[];
  attentionAreas: AttentionAreaFinding[];
  versionChanges?: ComparisonDifferenceItem[];
  lawyerQuestions: PreparationLawyerQuestion[];
  missingInformation: PreparationMissingInfoItem[];
  documentsToBring: PreparationDocumentToBring[];
  checklist: PreparationChecklistItem[];
  userNotes: PreparationUserNote[];
  validationSummary: {
    totalCitations: number;
    validatedCount: number;
    unverifiedCount: number;
  };
  createdAt: string;
  updatedAt: string;
  disclaimer: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  processingError?: string;
}

/**
 * Phase 8: Matter Domain Schemas
 */
export interface DocumentRelationshipItem {
  id: string;
  matterId: string;
  sourceDocumentId: string;
  sourceDocumentTitle?: string;
  targetDocumentId: string;
  targetDocumentTitle?: string;
  relationshipType: import('./safety').DocumentRelationshipType;
  description: string;
  sourcePage?: number | null;
  sourceQuote?: string | null;
  targetPage?: number | null;
  targetQuote?: string | null;
  confidence: number;
  classification: EvidenceSourceType;
  status: 'SUGGESTED' | 'CONFIRMED' | 'REJECTED';
  isValidated?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConsistencyFinding {
  id: string;
  category: import('./safety').ConsistencyCategory;
  title: string;
  description: string;
  severity: AttentionLevel;
  sourceA: {
    documentId: string;
    documentTitle: string;
    pageNumber?: number | null;
    quotedText?: string | null;
    value: string;
  };
  sourceB: {
    documentId: string;
    documentTitle: string;
    pageNumber?: number | null;
    quotedText?: string | null;
    value: string;
  };
  discussionPoint: string;
}

export interface MatterTimelineEvent {
  id: string;
  dateValue: string;
  formattedDate?: string;
  isEstablished: boolean;
  label: string;
  description: string;
  documentId: string;
  documentTitle: string;
  pageNumber?: number | null;
  quotedText?: string | null;
  classification: EvidenceSourceType;
}

export interface MatterSearchMatch {
  pageNumber: number;
  matchedText: string;
  snippet: string;
}

export interface MatterDocumentSearchResult {
  documentId: string;
  documentTitle: string;
  role: import('./safety').MatterDocumentRole;
  matches: MatterSearchMatch[];
}

export interface MatterSearchResponse {
  query: string;
  totalMatches: number;
  results: MatterDocumentSearchResult[];
}

export interface MatterOverviewMetrics {
  totalDocuments: number;
  analyzedDocuments: number;
  totalComparisons: number;
  totalRelationships: number;
  verifiedRelationships: number;
  openAttentionAreas: number;
  totalInconsistencies: number;
  totalLawyerQuestions: number;
  preparationReadyScore: number;
}

export interface MatterMemberDocument {
  id: string;
  documentId: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  pageCount: number | null;
  status: string;
  role: import('./safety').MatterDocumentRole;
  roleSuggestion?: string | null;
  roleConfirmed: boolean;
  displayOrder: number;
  addedAt: string;
}

export interface MatterDetail {
  id: string;
  title: string;
  description: string | null;
  jurisdiction: string | null;
  jurisdictionProvenance: 'DOCUMENT_EXPLICIT' | 'USER_PROVIDED' | 'NOT_ESTABLISHED';
  status: 'ACTIVE' | 'ARCHIVED';
  documents: MatterMemberDocument[];
  metrics: MatterOverviewMetrics;
  createdAt: string;
  updatedAt: string;
}

export interface MatterQueryCitation {
  documentId: string;
  documentTitle: string;
  pageNumber: number;
  quotedText: string;
}

export interface MatterQueryResponse {
  answer: string;
  citations: MatterQueryCitation[];
  crossDocumentObservations: string[];
  suggestedQuestionsForCounsel: string[];
  disclaimer: string;
  relatedPreparationItems?: Array<{
    id: string;
    title: string;
    itemType: import('./safety').ActionItemType;
    status: import('./safety').ActionItemStatus;
    priority?: import('./safety').ActionItemPriority;
  }>;
}

/**
 * Phase 9: Matter Action Plan & Copilot Schemas
 */
export interface MatterActionItem {
  id: string;
  matterId: string;
  title: string;
  description: string;
  type: import('./safety').ActionItemType;
  status: import('./safety').ActionItemStatus;
  priority: import('./safety').ActionItemPriority;
  sourceType: import('./safety').ActionItemSourceType;
  sourceReference?: string | null;
  relatedDocumentId?: string | null;
  relatedDocumentTitle?: string | null;
  relatedComparisonId?: string | null;
  relatedRelationshipId?: string | null;
  relatedConsistencyFindingId?: string | null;
  userProvided: boolean;
  dueDate?: string | null;
  dueDateProvenance?: import('./safety').DateProvenanceType | null;
  whyThisExists?: string;
  isUserCreated?: boolean;
  evidenceChain?: Array<{
    documentId?: string;
    documentTitle?: string;
    pageNumber?: number;
    quotedText?: string;
    classification: EvidenceSourceType;
    verificationStatus: import('./safety').VerificationStatus;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateActionItemInput {
  title: string;
  description: string;
  type?: import('./safety').ActionItemType;
  priority?: import('./safety').ActionItemPriority;
  sourceType?: import('./safety').ActionItemSourceType;
  sourceReference?: string;
  relatedDocumentId?: string;
  relatedComparisonId?: string;
  relatedRelationshipId?: string;
  relatedConsistencyFindingId?: string;
  userProvided?: boolean;
  dueDate?: string;
  dueDateProvenance?: import('./safety').DateProvenanceType;
}

export interface UpdateActionItemInput {
  title?: string;
  description?: string;
  type?: import('./safety').ActionItemType;
  status?: import('./safety').ActionItemStatus;
  priority?: import('./safety').ActionItemPriority;
  dueDate?: string | null;
  dueDateProvenance?: import('./safety').DateProvenanceType | null;
}

export interface MatterSnapshotMetrics {
  totalDocuments: number;
  analyzedDocuments: number;
  timelineEvents: number;
  verifiedRelationships: number;
  relationshipsNeedingReview: number;
  consistencyFindings: number;
  openActionItems: number;
  completedActionItems: number;
  counselQuestions: number;
  informationGaps: number;
  userNotes: number;
}

export type MatterReadinessState =
  | 'READY_FOR_REVIEW'
  | 'INFORMATION_GAPS'
  | 'ITEMS_TO_VERIFY'
  | 'QUESTIONS_FOR_COUNSEL'
  | 'DOCUMENTS_TO_COLLECT'
  | 'FOLLOW_UP_ITEMS';

export interface MatterReadinessReport {
  matterId: string;
  states: MatterReadinessState[];
  summary: string;
  snapshot: MatterSnapshotMetrics;
  recommendations: string[];
}

export interface CounselQuestionItem {
  id: string;
  category: string;
  question: string;
  rationale: string;
  sourceType: 'DOCUMENT' | 'CONSISTENCY' | 'RELATIONSHIP' | 'USER_CONTEXT';
  sourceReference?: string | null;
  documentId?: string | null;
  documentTitle?: string | null;
  pageNumber?: number | null;
  quotedText?: string | null;
  isUserProvided: boolean;
  relatedFindingId?: string | null;
  verificationStatus?: import('./safety').VerificationStatus;
}

export interface CounselQuestionsResponse {
  matterId: string;
  questions: CounselQuestionItem[];
  disclaimer: string;
}

export interface MatterActivityItem {
  id: string;
  matterId: string;
  actionType: import('./safety').MatterActivityType;
  description: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface MatterBriefResponse {
  matterId: string;
  preparationId: string;
  title: string;
  summary: string;
  parties: string[];
  documents: Array<{ id: string; title: string; role: string; status: string }>;
  timeline: Array<{ date: string; label: string; docTitle?: string }>;
  keyFactualPoints: Array<{
    fact: string;
    page?: number;
    docTitle?: string;
    classification: EvidenceSourceType;
    verificationStatus?: import('./safety').VerificationStatus;
    isUserProvided?: boolean;
  }>;
  consistencySummary: Array<{
    category: string;
    finding: string;
    discussionPoint: string;
    sourceDocTitle?: string;
    sourcePage?: number;
    targetDocTitle?: string;
    targetPage?: number;
  }>;
  counselQuestions: CounselQuestionItem[];
  actionItems: Array<{ id: string; title: string; status: string; priority: string; sourceType?: string }>;
  userNotes: Array<{ title: string; content: string; classification?: string }>;
  disclaimer: string;
}

/**
 * Phase 10: Normalized Evidence Intelligence & Source Map Types
 */
export interface MatterEvidenceItem {
  id: string;
  matterId: string;
  evidenceType: import('./safety').EvidenceType;
  documentId?: string | null;
  documentTitle?: string | null;
  pageNumber?: number | null;
  quotedText?: string | null;
  normalizedQuote?: string | null;
  classification: EvidenceSourceType;
  verificationStatus: import('./safety').VerificationStatus;
  confidenceCategory: import('./safety').ConfidenceCategory;
  sourceReference?: string | null;
  targetDocumentId?: string | null;
  targetDocumentTitle?: string | null;
  targetPageNumber?: number | null;
  targetQuote?: string | null;
  usedBy: Array<{
    type: 'CONSISTENCY' | 'QUESTION' | 'ACTION_ITEM' | 'RELATIONSHIP' | 'BRIEF' | 'TIMELINE';
    id: string;
    title: string;
  }>;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceCoverageMetrics {
  totalDocuments: number;
  documentsWithVerifiedEvidence: number;
  totalEvidenceItems: number;
  verifiedEvidenceCount: number;
  needsReviewEvidenceCount: number;
  userProvidedCount: number;
  findingsWithCitations: { withCitations: number; total: number };
  counselQuestionsWithEvidence: { withEvidence: number; total: number };
  actionItemsWithEvidence: { withEvidence: number; total: number };
  pagesReferenced: number;
}

export interface DocumentPageEvidenceNode {
  pageNumber: number;
  hasText: boolean;
  evidenceItems: MatterEvidenceItem[];
}

export interface DocumentSourceMapNode {
  documentId: string;
  title: string;
  role: string;
  pageCount: number;
  pagesWithEvidence: DocumentPageEvidenceNode[];
  totalEvidenceCount: number;
  verifiedEvidenceCount: number;
  needsReviewCount: number;
  consistencyFindingsCount: number;
  relationshipsCount: number;
  counselQuestionsCount: number;
  actionItemsCount: number;
}

export interface MatterSourceMapResponse {
  matterId: string;
  coverage: EvidenceCoverageMetrics;
  documents: DocumentSourceMapNode[];
  unlinkedEvidenceCount: number;
}

export interface EvidenceLedgerResponse {
  matterId: string;
  totalItems: number;
  items: MatterEvidenceItem[];
  filtersApplied: {
    classification?: string;
    verificationStatus?: string;
    documentId?: string;
    search?: string;
  };
}




