/**
 * Drizzle ORM Schema for SQLite (LexiGuide AI).
 * Foundational schema supporting document metadata, analyses, citations, chat, and comparisons.
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

/**
 * Documents table: Stores metadata about uploaded legal files.
 * Note: Raw document binaries are stored in the isolated storage system, never directly in SQLite.
 */
export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  originalFilename: text('original_filename').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),
  storagePath: text('storage_path').notNull(),
  pageCount: integer('page_count'),
  documentType: text('document_type'),
  status: text('status', {
    enum: ['UPLOADED', 'PENDING', 'PROCESSING', 'READY', 'FAILED'],
  })
    .notNull()
    .default('UPLOADED'),
  processingError: text('processing_error'),
  geminiFileUri: text('gemini_file_uri'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [index('documents_created_at_idx').on(table.createdAt)]);

export type DocumentRecord = typeof documents.$inferSelect;
export type NewDocumentRecord = typeof documents.$inferInsert;

/**
 * DocumentPages table: Stores extracted page text preserving page boundaries for citations.
 */
export const documentPages = sqliteTable('document_pages', {
  id: text('id').primaryKey(),
  documentId: text('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  pageNumber: integer('page_number').notNull(),
  text: text('text').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [index('document_pages_document_page_idx').on(table.documentId, table.pageNumber)]);

export type DocumentPageRecord = typeof documentPages.$inferSelect;
export type NewDocumentPageRecord = typeof documentPages.$inferInsert;

/**
 * Analyses table: Stores structured legal breakdowns and plain-language summaries.
 */
export const analyses = sqliteTable('analyses', {
  id: text('id').primaryKey(),
  documentId: text('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  summary: text('summary'),
  documentType: text('document_type'),
  governingLaw: text('governing_law'),
  keyClausesJson: text('key_clauses_json'),
  obligationsJson: text('obligations_json'),
  risksJson: text('risks_json'),
  analysisDataJson: text('analysis_data_json'),
  status: text('status', {
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
  })
    .notNull()
    .default('PENDING'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [index('analyses_document_id_idx').on(table.documentId)]);

export type AnalysisRecord = typeof analyses.$inferSelect;
export type NewAnalysisRecord = typeof analyses.$inferInsert;

/**
 * Citations table: Anchors findings directly to document source excerpts.
 */
export const citations = sqliteTable('citations', {
  id: text('id').primaryKey(),
  documentId: text('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  analysisId: text('analysis_id').references(() => analyses.id, { onDelete: 'cascade' }),
  comparisonId: text('comparison_id').references(() => comparisons.id, { onDelete: 'cascade' }),
  preparationId: text('preparation_id').references(() => preparations.id, { onDelete: 'cascade' }),
  sourceType: text('source_type', {
    enum: ['DOCUMENT_FACT', 'AI_INTERPRETATION', 'GENERAL_INFO', 'NEEDS_REVIEW', 'USER_PROVIDED'],
  })
    .notNull()
    .default('DOCUMENT_FACT'),
  pageNumber: integer('page_number'),
  sectionReference: text('section_reference'),
  quotedText: text('quoted_text').notNull(),
  surroundingContext: text('surrounding_context'),
  confidenceScore: real('confidence_score').notNull().default(1.0),
  createdAt: text('created_at').notNull(),
});

export type CitationRecord = typeof citations.$inferSelect;
export type NewCitationRecord = typeof citations.$inferInsert;

/**
 * ChatMessages table: Grounded Q&A conversation history for documents.
 */
export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  documentId: text('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  classification: text('classification', {
    enum: ['DOCUMENT_FACT', 'AI_INTERPRETATION', 'GENERAL_INFO', 'NEEDS_REVIEW'],
  }),
  citationsJson: text('citations_json'),
  createdAt: text('created_at').notNull(),
});

export type ChatMessageRecord = typeof chatMessages.$inferSelect;
export type NewChatMessageRecord = typeof chatMessages.$inferInsert;

/**
 * Comparisons table: Side-by-side diffing between two document versions.
 */
export const comparisons = sqliteTable('comparisons', {
  id: text('id').primaryKey(),
  baseDocumentId: text('base_document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  targetDocumentId: text('target_document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  summary: text('summary'),
  differencesJson: text('differences_json'),
  comparisonDataJson: text('comparison_data_json'),
  processingError: text('processing_error'),
  status: text('status', {
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
  })
    .notNull()
    .default('PENDING'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
}, (table) => [index('comparisons_base_target_idx').on(table.baseDocumentId, table.targetDocumentId)]);

export type ComparisonRecord = typeof comparisons.$inferSelect;
export type NewComparisonRecord = typeof comparisons.$inferInsert;

/**
 * Matters table: Groups related legal documents into a unified matter workspace.
 */
export const matters = sqliteTable('matters', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  jurisdiction: text('jurisdiction'),
  jurisdictionProvenance: text('jurisdiction_provenance', {
    enum: ['DOCUMENT_EXPLICIT', 'USER_PROVIDED', 'NOT_ESTABLISHED'],
  })
    .notNull()
    .default('NOT_ESTABLISHED'),
  status: text('status', {
    enum: ['ACTIVE', 'ARCHIVED'],
  })
    .notNull()
    .default('ACTIVE'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [index('matters_status_updated_at_idx').on(table.status, table.updatedAt)]);

export type MatterRecord = typeof matters.$inferSelect;
export type NewMatterRecord = typeof matters.$inferInsert;

/**
 * MatterDocuments table: Links documents to a matter with role metadata.
 * Removing a link or deleting a matter does NOT delete the physical document.
 */
export const matterDocuments = sqliteTable('matter_documents', {
  id: text('id').primaryKey(),
  matterId: text('matter_id')
    .notNull()
    .references(() => matters.id, { onDelete: 'cascade' }),
  documentId: text('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  role: text('role', {
    enum: [
      'PRIMARY_AGREEMENT',
      'REVISED_AGREEMENT',
      'AMENDMENT',
      'NOTICE',
      'POLICY',
      'ANNEXURE',
      'SUPPORTING_DOCUMENT',
      'OTHER',
    ],
  })
    .notNull()
    .default('SUPPORTING_DOCUMENT'),
  roleSuggestion: text('role_suggestion'),
  roleConfirmed: integer('role_confirmed', { mode: 'boolean' }).notNull().default(false),
  displayOrder: integer('display_order').notNull().default(0),
  addedAt: text('added_at').notNull(),
}, (table) => [
  index('matter_documents_matter_order_idx').on(table.matterId, table.displayOrder, table.addedAt),
  index('matter_documents_document_id_idx').on(table.documentId),
]);

export type MatterDocumentRecord = typeof matterDocuments.$inferSelect;
export type NewMatterDocumentRecord = typeof matterDocuments.$inferInsert;

/**
 * DocumentRelationships table: Stores cross-document references, amendments, and citations.
 */
export const documentRelationships = sqliteTable('document_relationships', {
  id: text('id').primaryKey(),
  matterId: text('matter_id')
    .notNull()
    .references(() => matters.id, { onDelete: 'cascade' }),
  sourceDocumentId: text('source_document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  targetDocumentId: text('target_document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  relationshipType: text('relationship_type', {
    enum: [
      'REFERENCES',
      'AMENDS',
      'INCORPORATES',
      'ATTACHES',
      'MENTIONS',
      'DATES_BACK_TO',
      'RELATED_TO',
    ],
  }).notNull(),
  description: text('description').notNull(),
  sourcePage: integer('source_page'),
  sourceQuote: text('source_quote'),
  targetPage: integer('target_page'),
  targetQuote: text('target_quote'),
  confidence: real('confidence').notNull().default(1.0),
  classification: text('classification', {
    enum: ['DOCUMENT_FACT', 'AI_INTERPRETATION', 'NEEDS_REVIEW'],
  })
    .notNull()
    .default('NEEDS_REVIEW'),
  status: text('status', {
    enum: ['SUGGESTED', 'CONFIRMED', 'REJECTED'],
  })
    .notNull()
    .default('SUGGESTED'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [index('document_relationships_matter_id_idx').on(table.matterId)]);

export type DocumentRelationshipRecord = typeof documentRelationships.$inferSelect;
export type NewDocumentRelationshipRecord = typeof documentRelationships.$inferInsert;

/**
 * MatterNotes table: User-provided notes, background context, and objectives for a matter.
 */
export const matterNotes = sqliteTable('matter_notes', {
  id: text('id').primaryKey(),
  matterId: text('matter_id')
    .notNull()
    .references(() => matters.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  classification: text('classification').notNull().default('USER_PROVIDED'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [index('matter_notes_matter_created_at_idx').on(table.matterId, table.createdAt)]);

export type MatterNoteRecord = typeof matterNotes.$inferSelect;
export type NewMatterNoteRecord = typeof matterNotes.$inferInsert;

/**
 * Preparations table: Structured attorney consultation briefs, checklists, and timelines.
 */
export const preparations = sqliteTable('preparations', {
  id: text('id').primaryKey(),
  briefKind: text('brief_kind', { enum: ['PREPARATION', 'MATTER'] }).notNull().default('PREPARATION'),
  documentId: text('document_id').references(() => documents.id, { onDelete: 'cascade' }),
  comparisonId: text('comparison_id').references(() => comparisons.id, { onDelete: 'cascade' }),
  matterId: text('matter_id').references(() => matters.id, { onDelete: 'cascade' }),
  purpose: text('purpose'),
  userNotesJson: text('user_notes_json'),
  checklistStateJson: text('checklist_state_json'),
  preparationDataJson: text('preparation_data_json'),
  status: text('status', {
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
  })
    .notNull()
    .default('PENDING'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [index('preparations_matter_kind_idx').on(table.matterId, table.briefKind)]);

export type PreparationRecord = typeof preparations.$inferSelect;
export type NewPreparationRecord = typeof preparations.$inferInsert;

/**
 * LegalInformationCache table: Caches educational dossiers and topic explanations.
 */
export const legalInformationCache = sqliteTable('legal_information_cache', {
  id: text('id').primaryKey(),
  cacheKey: text('cache_key').notNull().unique(),
  topic: text('topic').notNull(),
  jurisdictionJson: text('jurisdiction_json'),
  responseJson: text('response_json').notNull(),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),
});

export type LegalInformationCacheRecord = typeof legalInformationCache.$inferSelect;
export type NewLegalInformationCacheRecord = typeof legalInformationCache.$inferInsert;

/**
 * MatterActionItems table: Actionable preparation tasks, follow-up items, and verification checks.
 */
export const matterActionItems = sqliteTable('matter_action_items', {
  id: text('id').primaryKey(),
  matterId: text('matter_id')
    .notNull()
    .references(() => matters.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  type: text('type', {
    enum: [
      'REVIEW_DOCUMENT',
      'REQUEST_DOCUMENT',
      'VERIFY_FACT',
      'VERIFY_TERM',
      'PROVIDE_MISSING_INFORMATION',
      'COLLECT_DOCUMENT',
      'REVIEW_TIMELINE',
      'REVIEW_CONSISTENCY',
      'RESOLVE_DISCREPANCY',
      'ASK_COUNSEL',
      'CONFIRM_USER_CONTEXT',
      'FOLLOW_UP',
      'GENERAL_INFORMATION',
    ],
  }).notNull(),
  status: text('status', {
    enum: ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED'],
  })
    .notNull()
    .default('OPEN'),
  priority: text('priority', {
    enum: ['HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'],
  })
    .notNull()
    .default('MEDIUM'),
  sourceType: text('source_type', {
    enum: [
      'DOCUMENT',
      'LEGAL_XRAY',
      'COMPARISON',
      'RELATIONSHIP',
      'CONSISTENCY',
      'TIMELINE',
      'MISSING_INFO',
      'MATTER_WORKSPACE',
      'USER_NOTE',
      'USER_CREATED',
      'MANUAL',
    ],
  }).notNull(),
  sourceReference: text('source_reference'),
  relatedDocumentId: text('related_document_id').references(() => documents.id, {
    onDelete: 'set null',
  }),
  relatedComparisonId: text('related_comparison_id').references(() => comparisons.id, {
    onDelete: 'set null',
  }),
  relatedRelationshipId: text('related_relationship_id').references(
    () => documentRelationships.id,
    { onDelete: 'set null' }
  ),
  relatedConsistencyFindingId: text('related_consistency_finding_id'),
  userProvided: integer('user_provided', { mode: 'boolean' }).notNull().default(false),
  dueDate: text('due_date'),
  dueDateProvenance: text('due_date_provenance', {
    enum: ['DOCUMENT_STATED', 'USER_PROVIDED', 'CALCULATED_EXPLICIT'],
  }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [index('matter_action_items_matter_created_at_idx').on(table.matterId, table.createdAt)]);

export type MatterActionItemRecord = typeof matterActionItems.$inferSelect;
export type NewMatterActionItemRecord = typeof matterActionItems.$inferInsert;

/**
 * MatterActivity table: Lightweight audit history of matter operations.
 */
export const matterActivity = sqliteTable('matter_activity', {
  id: text('id').primaryKey(),
  matterId: text('matter_id')
    .notNull()
    .references(() => matters.id, { onDelete: 'cascade' }),
  actionType: text('action_type', {
    enum: [
      'DOCUMENT_ATTACHED',
      'DOCUMENT_DETACHED',
      'ROLE_UPDATED',
      'RELATIONSHIPS_SCANNED',
      'RELATIONSHIP_CONFIRMED',
      'RELATIONSHIP_REJECTED',
      'CONSISTENCY_CHECKED',
      'NOTE_ADDED',
      'NOTE_DELETED',
      'ACTION_ITEM_CREATED',
      'ACTION_ITEM_UPDATED',
      'ACTION_ITEM_DELETED',
      'ACTION_ITEM_COMPLETED',
      'ACTION_ITEMS_GENERATED',
      'PREPARATION_BRIEF_GENERATED',
      'EVIDENCE_REVIEWED',
      'EVIDENCE_LEDGER_VIEWED',
      'CITATION_VERIFICATION_RUN',
    ],
  }).notNull(),
  description: text('description').notNull(),
  metadataJson: text('metadata_json'),
  createdAt: text('created_at').notNull(),
}, (table) => [index('matter_activity_matter_created_at_idx').on(table.matterId, table.createdAt)]);

export type MatterActivityRecord = typeof matterActivity.$inferSelect;
export type NewMatterActivityRecord = typeof matterActivity.$inferInsert;

/**
 * MatterEvidence table: Normalized evidence intelligence ledger anchoring findings to source documents & pages.
 */
export const matterEvidence = sqliteTable('matter_evidence', {
  id: text('id').primaryKey(),
  matterId: text('matter_id')
    .notNull()
    .references(() => matters.id, { onDelete: 'cascade' }),
  evidenceType: text('evidence_type', {
    enum: [
      'DOCUMENT_FACT',
      'COMPARISON_EVIDENCE',
      'RELATIONSHIP_EVIDENCE',
      'CONSISTENCY_EVIDENCE',
      'TIMELINE_EVIDENCE',
      'PREPARATION_EVIDENCE',
      'USER_PROVIDED',
      'GENERAL_INFORMATION',
      'AI_INTERPRETATION',
      'NEEDS_REVIEW',
    ],
  }).notNull(),
  documentId: text('document_id').references(() => documents.id, { onDelete: 'cascade' }),
  pageNumber: integer('page_number'),
  quotedText: text('quoted_text'),
  normalizedQuote: text('normalized_quote'),
  classification: text('classification', {
    enum: [
      'DOCUMENT_FACT',
      'AI_INTERPRETATION',
      'GENERAL_INFO',
      'NEEDS_REVIEW',
      'USER_PROVIDED',
    ],
  })
    .notNull()
    .default('DOCUMENT_FACT'),
  verificationStatus: text('verification_status', {
    enum: ['VERIFIED', 'NEEDS_REVIEW', 'UNVERIFIED'],
  })
    .notNull()
    .default('VERIFIED'),
  confidenceCategory: text('confidence_category', {
    enum: ['HIGH', 'MEDIUM', 'LOW', 'UNVERIFIED'],
  })
    .notNull()
    .default('HIGH'),
  sourceReference: text('source_reference'),
  targetDocumentId: text('target_document_id').references(() => documents.id, {
    onDelete: 'set null',
  }),
  targetPageNumber: integer('target_page_number'),
  targetQuote: text('target_quote'),
  usedByJson: text('used_by_json'),
  metadataJson: text('metadata_json'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [index('matter_evidence_matter_id_idx').on(table.matterId)]);

export type MatterEvidenceRecord = typeof matterEvidence.$inferSelect;
export type NewMatterEvidenceRecord = typeof matterEvidence.$inferInsert;
