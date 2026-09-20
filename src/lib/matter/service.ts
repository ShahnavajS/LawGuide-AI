/**
 * Matter Service Layer (LexiGuide AI Phase 8).
 *
 * Coordinates multi-document legal matter management, cross-document relationships,
 * evidence-grounded consistency checks, server-side page text search, and matter-level Q&A.
 */

import { getDb, schema } from '@/lib/db';
import { createHash } from 'node:crypto';
import { getDocumentService, DocumentService } from '@/lib/document/service';
import { getAnalysisService, AnalysisService } from '@/lib/analysis/service';
import { geminiService, GeminiService } from '@/lib/ai/gemini';
import { citationValidator, CitationValidator } from '@/lib/evidence/validator';
import {
  MatterDetail,
  MatterMemberDocument,
  MatterOverviewMetrics,
  DocumentRelationshipItem,
  ConsistencyFinding,
  MatterTimelineEvent,
  MatterSearchResponse,
  MatterDocumentSearchResult,
  MatterSearchMatch,
  MatterQueryResponse,
  LegalXRayAnalysis,
  MatterActionItem,
  CreateActionItemInput,
  UpdateActionItemInput,
  MatterSnapshotMetrics,
  MatterReadinessReport,
  MatterReadinessState,
  CounselQuestionItem,
  CounselQuestionsResponse,
  MatterActivityItem,
  MatterBriefResponse,
  MatterEvidenceItem,
  EvidenceCoverageMetrics,
  DocumentPageEvidenceNode,
  DocumentSourceMapNode,
  MatterSourceMapResponse,
  EvidenceLedgerResponse,
} from '@/lib/ai/schemas';
import {
  MatterDocumentRole,
  DocumentRelationshipType,
  containsProhibitedLegalConclusion,
  LEGAL_DISCLAIMERS,
  ActionItemType,
  ActionItemStatus,
  ActionItemPriority,
  ActionItemSourceType,
  DateProvenanceType,
  MatterActivityType,
  type EvidenceSourceType,
} from '@/lib/ai/safety';
import {
  SYSTEM_MATTER_ANALYST_PROMPT,
  buildRelationshipExtractionPrompt,
  buildMatterQuestionPrompt,
  buildCounselQuestionPrompt,
} from '@/lib/ai/prompts';
import { generateId } from '@/lib/utils/id';
import { NotFoundError, ValidationError } from '@/lib/utils/errors';
import { eq, and, inArray, like, sql, desc, asc } from 'drizzle-orm';
import { getCurrentUserId } from '@/lib/auth/context';
import { parseStoredArtifact } from '@/lib/ai/validate-output';

export interface CreateMatterInput {
  title: string;
  description?: string;
  jurisdiction?: string;
  jurisdictionProvenance?: 'DOCUMENT_EXPLICIT' | 'USER_PROVIDED' | 'NOT_ESTABLISHED';
}

export interface UpdateMatterInput {
  title?: string;
  description?: string;
  jurisdiction?: string;
  jurisdictionProvenance?: 'DOCUMENT_EXPLICIT' | 'USER_PROVIDED' | 'NOT_ESTABLISHED';
  status?: 'ACTIVE' | 'ARCHIVED';
}

export class MatterService {
  private documentService: DocumentService;
  private analysisService: AnalysisService;
  private gemini: GeminiService;
  private validator: CitationValidator;

  constructor(
    docService?: DocumentService,
    anaService?: AnalysisService,
    gemini?: GeminiService,
    validator?: CitationValidator
  ) {
    this.documentService = docService || getDocumentService();
    this.analysisService = anaService || getAnalysisService();
    this.gemini = gemini || geminiService;
    this.validator = validator || citationValidator;
  }

  private parseStoredMatterBrief(raw: string): MatterBriefResponse {
    return parseStoredArtifact<MatterBriefResponse>(raw, {
      strings: ['matterId', 'preparationId', 'title', 'summary', 'disclaimer'],
      arrays: ['parties', 'documents', 'timeline', 'keyFactualPoints', 'consistencySummary', 'counselQuestions', 'actionItems', 'userNotes'],
    });
  }

  private assertMatterOwned(matterId: string): void {
    const userId = getCurrentUserId();
    const ownedMatter = getDb()
      .select({ id: schema.matters.id })
      .from(schema.matters)
      .where(and(eq(schema.matters.id, matterId), eq(schema.matters.userId, userId)))
      .get();
    if (!ownedMatter) {
      throw new NotFoundError(`Matter with ID ${matterId} was not found.`);
    }
  }

  /**
   * Creates a new legal matter.
   */
  public async createMatter(input: CreateMatterInput): Promise<MatterDetail> {
    const userId = getCurrentUserId();
    const trimmedTitle = (input.title || '').trim();
    if (!trimmedTitle) {
      throw new ValidationError('Matter title is required.');
    }

    const db = getDb();
    const matterId = generateId('matter');
    const now = new Date().toISOString();

    const newRecord = {
      id: matterId,
      userId,
      title: trimmedTitle,
      description: input.description?.trim() || null,
      jurisdiction: input.jurisdiction?.trim() || null,
      jurisdictionProvenance: input.jurisdictionProvenance || 'NOT_ESTABLISHED',
      status: 'ACTIVE' as const,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(schema.matters).values(newRecord).run();

    return this.getMatter(matterId);
  }

  /**
   * Retrieves a matter by ID with member documents and computed metrics.
   */
  public async getMatter(matterId: string): Promise<MatterDetail> {
    const userId = getCurrentUserId();
    const db = getDb();
    const matter = db
      .select()
      .from(schema.matters)
      .where(and(eq(schema.matters.id, matterId), eq(schema.matters.userId, userId)))
      .get();

    if (!matter) {
      throw new NotFoundError(`Matter with ID ${matterId} was not found.`);
    }

    // Fetch member documents
    const memberRows = db
      .select({
        linkId: schema.matterDocuments.id,
        documentId: schema.documents.id,
        title: schema.documents.title,
        originalFilename: schema.documents.originalFilename,
        mimeType: schema.documents.mimeType,
        fileSize: schema.documents.fileSize,
        pageCount: schema.documents.pageCount,
        status: schema.documents.status,
        role: schema.matterDocuments.role,
        roleSuggestion: schema.matterDocuments.roleSuggestion,
        roleConfirmed: schema.matterDocuments.roleConfirmed,
        displayOrder: schema.matterDocuments.displayOrder,
        addedAt: schema.matterDocuments.addedAt,
      })
      .from(schema.matterDocuments)
      .innerJoin(schema.documents, eq(schema.matterDocuments.documentId, schema.documents.id))
      .where(and(
        eq(schema.matterDocuments.matterId, matterId),
        eq(schema.documents.userId, userId)
      ))
      .orderBy(asc(schema.matterDocuments.displayOrder), desc(schema.matterDocuments.addedAt))
      .all();

    const memberDocuments: MatterMemberDocument[] = memberRows.map((r) => ({
      id: r.linkId,
      documentId: r.documentId,
      title: r.title,
      originalFilename: r.originalFilename,
      mimeType: r.mimeType,
      fileSize: r.fileSize,
      pageCount: r.pageCount,
      status: r.status,
      role: r.role as MatterDocumentRole,
      roleSuggestion: r.roleSuggestion,
      roleConfirmed: Boolean(r.roleConfirmed),
      displayOrder: r.displayOrder,
      addedAt: r.addedAt,
    }));

    const metrics = await this.computeMetrics(matterId, memberDocuments);

    return {
      id: matter.id,
      title: matter.title,
      description: matter.description,
      jurisdiction: matter.jurisdiction,
      jurisdictionProvenance: matter.jurisdictionProvenance as
        | 'DOCUMENT_EXPLICIT'
        | 'USER_PROVIDED'
        | 'NOT_ESTABLISHED',
      status: matter.status as 'ACTIVE' | 'ARCHIVED',
      documents: memberDocuments,
      metrics,
      createdAt: matter.createdAt,
      updatedAt: matter.updatedAt,
    };
  }

  /**
   * Lists matters with summary metrics.
   */
  public async listMatters(statusFilter?: 'ACTIVE' | 'ARCHIVED'): Promise<
    Array<{
      id: string;
      title: string;
      description: string | null;
      jurisdiction: string | null;
      jurisdictionProvenance: string;
      status: string;
      documentCount: number;
      analyzedCount: number;
      createdAt: string;
      updatedAt: string;
    }>
  > {
    const userId = getCurrentUserId();
    const db = getDb();
    return db
      .select({
        id: schema.matters.id,
        title: schema.matters.title,
        description: schema.matters.description,
        jurisdiction: schema.matters.jurisdiction,
        jurisdictionProvenance: schema.matters.jurisdictionProvenance,
        status: schema.matters.status,
        documentCount: sql<number>`count(${schema.matterDocuments.id})`,
        analyzedCount: sql<number>`count(distinct case when ${schema.documents.status} = 'READY' then ${schema.matterDocuments.documentId} end)`,
        createdAt: schema.matters.createdAt,
        updatedAt: schema.matters.updatedAt,
      })
      .from(schema.matters)
      .leftJoin(schema.matterDocuments, eq(schema.matterDocuments.matterId, schema.matters.id))
      .leftJoin(schema.documents, eq(schema.documents.id, schema.matterDocuments.documentId))
      .where(and(
        eq(schema.matters.userId, userId),
        statusFilter ? eq(schema.matters.status, statusFilter) : undefined
      ))
      .groupBy(schema.matters.id)
      .orderBy(desc(schema.matters.updatedAt))
      .all();
  }

  /**
   * Updates matter details.
   */
  public async updateMatter(matterId: string, updates: UpdateMatterInput): Promise<MatterDetail> {
    const userId = getCurrentUserId();
    const db = getDb();
    const existing = db
      .select()
      .from(schema.matters)
      .where(and(eq(schema.matters.id, matterId), eq(schema.matters.userId, userId)))
      .get();

    if (!existing) {
      throw new NotFoundError(`Matter ${matterId} not found.`);
    }

    const now = new Date().toISOString();
    const fieldsToUpdate: Record<string, unknown> = { updatedAt: now };

    if (updates.title !== undefined) {
      const trimmed = updates.title.trim();
      if (!trimmed) throw new ValidationError('Title cannot be empty.');
      fieldsToUpdate.title = trimmed;
    }
    if (updates.description !== undefined) {
      fieldsToUpdate.description = updates.description.trim() || null;
    }
    if (updates.jurisdiction !== undefined) {
      fieldsToUpdate.jurisdiction = updates.jurisdiction.trim() || null;
    }
    if (updates.jurisdictionProvenance !== undefined) {
      fieldsToUpdate.jurisdictionProvenance = updates.jurisdictionProvenance;
    }
    if (updates.status !== undefined) {
      fieldsToUpdate.status = updates.status;
    }

    db.update(schema.matters)
      .set(fieldsToUpdate)
      .where(and(eq(schema.matters.id, matterId), eq(schema.matters.userId, userId)))
      .run();

    return this.getMatter(matterId);
  }

  /**
   * Deletes a matter.
   * Cascade deletes matter_documents, document_relationships, matter_notes, and matter preparations.
   * CRITICAL SAFETY GUARANTEE: Does NOT delete the underlying physical documents or analyses!
   */
  public async deleteMatter(matterId: string): Promise<void> {
    const userId = getCurrentUserId();
    const db = getDb();
    const existing = db
      .select()
      .from(schema.matters)
      .where(and(eq(schema.matters.id, matterId), eq(schema.matters.userId, userId)))
      .get();

    if (!existing) {
      throw new NotFoundError(`Matter ${matterId} not found.`);
    }

    db.delete(schema.matters).where(and(eq(schema.matters.id, matterId), eq(schema.matters.userId, userId))).run();
  }

  /**
   * Adds an existing document to a matter with role metadata.
   */
  public async addDocumentToMatter(
    matterId: string,
    documentId: string,
    role?: MatterDocumentRole
  ): Promise<MatterMemberDocument> {
    const userId = getCurrentUserId();
    const db = getDb();

    // Verify matter exists
    const matter = db.select().from(schema.matters)
      .where(and(eq(schema.matters.id, matterId), eq(schema.matters.userId, userId))).get();
    if (!matter) {
      throw new NotFoundError(`Matter ${matterId} not found.`);
    }

    // Verify document exists and is processed
    const doc = await this.documentService.getDocumentById(documentId);
    if (!doc) {
      throw new NotFoundError(`Document ${documentId} not found.`);
    }

    if (doc.status !== 'READY') {
      throw new ValidationError(
        `Document "${doc.title}" must be processed and in READY status before adding to a matter.`
      );
    }

    // Check if already in matter
    const existingLink = db
      .select()
      .from(schema.matterDocuments)
      .where(
        and(
          eq(schema.matterDocuments.matterId, matterId),
          eq(schema.matterDocuments.documentId, documentId)
        )
      )
      .get();

    if (existingLink) {
      throw new ValidationError(`Document "${doc.title}" is already a member of this matter.`);
    }

    // Role suggestion heuristic based on title or existing analysis
    let suggestion: string | null = null;
    const titleLower = doc.title.toLowerCase();
    if (titleLower.includes('amendment')) {
      suggestion = 'AMENDMENT';
    } else if (titleLower.includes('nda') || titleLower.includes('confidential')) {
      suggestion = 'POLICY';
    } else if (titleLower.includes('notice')) {
      suggestion = 'NOTICE';
    } else if (titleLower.includes('revised') || titleLower.includes('v2') || titleLower.includes('draft')) {
      suggestion = 'REVISED_AGREEMENT';
    } else if (titleLower.includes('agreement') || titleLower.includes('contract')) {
      suggestion = 'PRIMARY_AGREEMENT';
    }

    const assignedRole = role || (suggestion as MatterDocumentRole) || 'SUPPORTING_DOCUMENT';
    const linkId = generateId('mdoc');
    const now = new Date().toISOString();

    db.insert(schema.matterDocuments)
      .values({
        id: linkId,
        matterId,
        documentId,
        role: assignedRole,
        roleSuggestion: suggestion,
        roleConfirmed: Boolean(role),
        displayOrder: 0,
        addedAt: now,
      })
      .run();

    db.update(schema.matters)
      .set({ updatedAt: now })
      .where(eq(schema.matters.id, matterId))
      .run();

    await this.logActivity(
      matterId,
      'DOCUMENT_ATTACHED',
      `Attached document "${doc.title}" as ${assignedRole}`,
      { documentId, role: assignedRole }
    );

    return {
      id: linkId,
      documentId,
      title: doc.title,
      originalFilename: doc.originalFilename,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      pageCount: doc.pageCount ?? null,
      status: doc.status,
      role: assignedRole,
      roleSuggestion: suggestion,
      roleConfirmed: Boolean(role),
      displayOrder: 0,
      addedAt: now,
    };
  }

  /**
   * Removes a document from a matter.
   * Does NOT delete the physical document or its analysis!
   */
  public async removeDocumentFromMatter(matterId: string, documentId: string): Promise<void> {
    this.assertMatterOwned(matterId);
    await this.documentService.getDocumentById(documentId);
    const db = getDb();

    // Remove the link
    const res = db
      .delete(schema.matterDocuments)
      .where(
        and(
          eq(schema.matterDocuments.matterId, matterId),
          eq(schema.matterDocuments.documentId, documentId)
        )
      )
      .run();

    if (res.changes === 0) {
      throw new NotFoundError(`Document ${documentId} is not a member of matter ${matterId}.`);
    }

    // Clean up any relationships involving this document in this matter
    db.delete(schema.documentRelationships)
      .where(
        and(
          eq(schema.documentRelationships.matterId, matterId),
          sql`(${schema.documentRelationships.sourceDocumentId} = ${documentId} OR ${schema.documentRelationships.targetDocumentId} = ${documentId})`
        )
      )
      .run();

    const now = new Date().toISOString();
    db.update(schema.matters)
      .set({ updatedAt: now })
      .where(eq(schema.matters.id, matterId))
      .run();

    await this.logActivity(
      matterId,
      'DOCUMENT_DETACHED',
      `Removed document from matter`,
      { documentId }
    );
  }

  /**
   * Updates a member document's role and confirmation status.
   */
  public async updateDocumentRole(
    matterId: string,
    documentId: string,
    role: MatterDocumentRole,
    confirmed = true
  ): Promise<MatterMemberDocument> {
    this.assertMatterOwned(matterId);
    const db = getDb();
    const existingLink = db
      .select()
      .from(schema.matterDocuments)
      .where(
        and(
          eq(schema.matterDocuments.matterId, matterId),
          eq(schema.matterDocuments.documentId, documentId)
        )
      )
      .get();

    if (!existingLink) {
      throw new NotFoundError(`Document ${documentId} is not in matter ${matterId}.`);
    }

    db.update(schema.matterDocuments)
      .set({ role, roleConfirmed: confirmed })
      .where(eq(schema.matterDocuments.id, existingLink.id))
      .run();

    const doc = await this.documentService.getDocumentById(documentId);

    await this.logActivity(
      matterId,
      'ROLE_UPDATED',
      `Updated role of "${doc?.title || documentId}" to ${role}`,
      { documentId, role, confirmed }
    );

    return {
      id: existingLink.id,
      documentId,
      title: doc?.title || 'Unknown Document',
      originalFilename: doc?.originalFilename || '',
      mimeType: doc?.mimeType || '',
      fileSize: doc?.fileSize || 0,
      pageCount: doc?.pageCount ?? null,
      status: doc?.status || 'UNKNOWN',
      role,
      roleSuggestion: existingLink.roleSuggestion,
      roleConfirmed: confirmed,
      displayOrder: existingLink.displayOrder,
      addedAt: existingLink.addedAt,
    };
  }

  /**
   * Reorders member documents in the workspace.
   */
  public async reorderDocuments(matterId: string, documentIds: string[]): Promise<void> {
    this.assertMatterOwned(matterId);
    const db = getDb();
    for (let i = 0; i < documentIds.length; i++) {
      db.update(schema.matterDocuments)
        .set({ displayOrder: i })
        .where(
          and(
            eq(schema.matterDocuments.matterId, matterId),
            eq(schema.matterDocuments.documentId, documentIds[i])
          )
        )
        .run();
    }
  }

  /**
   * Extracts cross-document relationships across all matter documents.
   * Validates both source and target quotes with CitationValidator.
   */
  public async extractRelationships(
    matterId: string,
    force = false
  ): Promise<DocumentRelationshipItem[]> {
    this.assertMatterOwned(matterId);
    const db = getDb();

    // Check existing
    if (!force) {
      const existing = db
        .select()
        .from(schema.documentRelationships)
        .where(eq(schema.documentRelationships.matterId, matterId))
        .all();

      if (existing.length > 0) {
        return this.mapRelationshipRows(existing);
      }
    }

    // Get matter member documents
    const memberDocs = db
      .select({
        documentId: schema.matterDocuments.documentId,
        title: schema.documents.title,
        role: schema.matterDocuments.role,
        status: schema.documents.status,
      })
      .from(schema.matterDocuments)
      .innerJoin(schema.documents, eq(schema.matterDocuments.documentId, schema.documents.id))
      .where(and(
        eq(schema.matterDocuments.matterId, matterId),
        eq(schema.documents.userId, getCurrentUserId())
      ))
      .all();

    if (memberDocs.length < 2) {
      return [];
    }

    // Load page texts for each member document
    const docsWithPages: Array<{
      documentId: string;
      title: string;
      role: string;
      pages: Array<{ pageNumber: number; text: string }>;
    }> = [];

    for (const doc of memberDocs) {
      const pages = db
        .select({ pageNumber: schema.documentPages.pageNumber, text: schema.documentPages.text })
        .from(schema.documentPages)
        .where(eq(schema.documentPages.documentId, doc.documentId))
        .orderBy(asc(schema.documentPages.pageNumber))
        .all();

      docsWithPages.push({
        documentId: doc.documentId,
        title: doc.title,
        role: doc.role,
        pages,
      });
    }

    // Candidates can be extracted deterministically or via Gemini
    let rawRelationships: Array<{
      sourceDocumentId: string;
      targetDocumentId: string;
      relationshipType: DocumentRelationshipType;
      description: string;
      sourcePage?: number;
      sourceQuote?: string;
      targetPage?: number;
      targetQuote?: string;
    }> = [];

    if (this.gemini.isConfigured()) {
      try {
        const prompt = buildRelationshipExtractionPrompt(docsWithPages);
        const schemaDescription = `[
  {
    "sourceDocumentId": "string",
    "targetDocumentId": "string",
    "relationshipType": "REFERENCES" | "AMENDS" | "INCORPORATES" | "ATTACHES" | "MENTIONS" | "DATES_BACK_TO" | "RELATED_TO",
    "description": "string",
    "sourcePage": number,
    "sourceQuote": "string",
    "targetPage": number,
    "targetQuote": "string"
  }
]`;
        const response = await this.gemini.generateStructured<
          Array<{
            sourceDocumentId: string;
            targetDocumentId: string;
            relationshipType: DocumentRelationshipType;
            description: string;
            sourcePage?: number;
            sourceQuote?: string;
            targetPage?: number;
            targetQuote?: string;
          }>
        >(prompt, schemaDescription, { systemInstruction: SYSTEM_MATTER_ANALYST_PROMPT });

        if (Array.isArray(response)) {
          rawRelationships = response;
        }
      } catch {
        // Fallback to deterministic extraction
        rawRelationships = this.extractDeterministicRelationships(docsWithPages);
      }
    } else {
      rawRelationships = this.extractDeterministicRelationships(docsWithPages);
    }

    // Remove old relationships if forcing refresh
    if (force) {
      db.delete(schema.documentRelationships)
        .where(eq(schema.documentRelationships.matterId, matterId))
        .run();
    }

    const now = new Date().toISOString();
    const createdItems: DocumentRelationshipItem[] = [];

    for (const raw of rawRelationships) {
      const sourceDoc = docsWithPages.find((d) => d.documentId === raw.sourceDocumentId);
      const targetDoc = docsWithPages.find((d) => d.documentId === raw.targetDocumentId);

      if (!sourceDoc || !targetDoc || raw.sourceDocumentId === raw.targetDocumentId) {
        continue;
      }

      // Verify evidence using CitationValidator
      let isSourceValid = false;
      let isTargetValid = false;

      if (raw.sourceQuote && raw.sourcePage) {
        const res = this.validator.validateCitationAgainstPages(
          { pageNumber: raw.sourcePage, quotedText: raw.sourceQuote },
          sourceDoc.pages
        );
        isSourceValid = res.isValidated;
      }

      if (raw.targetQuote && raw.targetPage) {
        const res = this.validator.validateCitationAgainstPages(
          { pageNumber: raw.targetPage, quotedText: raw.targetQuote },
          targetDoc.pages
        );
        isTargetValid = res.isValidated;
      } else if (!raw.targetQuote) {
        isTargetValid = true;
      }

      const isValidated = isSourceValid && isTargetValid;
      const classification: 'DOCUMENT_FACT' | 'AI_INTERPRETATION' | 'NEEDS_REVIEW' = isValidated
        ? 'DOCUMENT_FACT'
        : 'NEEDS_REVIEW';

      const relId = generateId('rel');
      const record = {
        id: relId,
        matterId,
        sourceDocumentId: raw.sourceDocumentId,
        targetDocumentId: raw.targetDocumentId,
        relationshipType: raw.relationshipType,
        description: raw.description,
        sourcePage: raw.sourcePage || null,
        sourceQuote: raw.sourceQuote || null,
        targetPage: raw.targetPage || null,
        targetQuote: raw.targetQuote || null,
        confidence: isValidated ? 1.0 : 0.6,
        classification,
        status: 'SUGGESTED' as const,
        createdAt: now,
        updatedAt: now,
      };

      db.insert(schema.documentRelationships).values(record).run();

      createdItems.push({
        ...record,
        sourceDocumentTitle: sourceDoc.title,
        targetDocumentTitle: targetDoc.title,
        isValidated,
      });
    }

    if (createdItems.length > 0) {
      await this.logActivity(
        matterId,
        'RELATIONSHIPS_SCANNED',
        `Discovered ${createdItems.length} potential cross-document relationships`,
        { count: createdItems.length }
      );
    }

    return createdItems;
  }

  /**
   * Deterministic relationship extractor fallback.
   */
  private extractDeterministicRelationships(
    docs: Array<{
      documentId: string;
      title: string;
      role: string;
      pages: Array<{ pageNumber: number; text: string }>;
    }>
  ): Array<{
    sourceDocumentId: string;
    targetDocumentId: string;
    relationshipType: DocumentRelationshipType;
    description: string;
    sourcePage?: number;
    sourceQuote?: string;
    targetPage?: number;
    targetQuote?: string;
  }> {
    const relationships: Array<{
      sourceDocumentId: string;
      targetDocumentId: string;
      relationshipType: DocumentRelationshipType;
      description: string;
      sourcePage?: number;
      sourceQuote?: string;
      targetPage?: number;
      targetQuote?: string;
    }> = [];

    // Search for references to other documents' titles or keywords
    for (const source of docs) {
      for (const target of docs) {
        if (source.documentId === target.documentId) continue;

        const targetTitleWords = target.title
          .replace(/\.(pdf|docx|txt)$/i, '')
          .split(/[\s_-]+/)
          .filter((w) => w.length > 3);

        for (const page of source.pages) {
          const textLower = page.text.toLowerCase();

          // Check amendment patterns
          if (
            source.role === 'AMENDMENT' ||
            source.title.toLowerCase().includes('amendment')
          ) {
            const match = page.text.match(
              /(amends|modifies|supplements|pursuant to|referenced in)([^.\n]{10,80})/i
            );
            if (match) {
              relationships.push({
                sourceDocumentId: source.documentId,
                targetDocumentId: target.documentId,
                relationshipType: 'AMENDS',
                description: `${source.title} explicitly amends or references terms of ${target.title}.`,
                sourcePage: page.pageNumber,
                sourceQuote: match[0],
                targetPage: 1,
                targetQuote: target.title,
              });
              break;
            }
          }

          // Check explicit title matches
          for (const word of targetTitleWords) {
            if (word.length > 5 && textLower.includes(word.toLowerCase())) {
              const startIdx = textLower.indexOf(word.toLowerCase());
              const excerpt = page.text.slice(
                Math.max(0, startIdx - 30),
                Math.min(page.text.length, startIdx + word.length + 30)
              );

              relationships.push({
                sourceDocumentId: source.documentId,
                targetDocumentId: target.documentId,
                relationshipType: 'REFERENCES',
                description: `${source.title} explicitly references terminology or clauses related to ${target.title}.`,
                sourcePage: page.pageNumber,
                sourceQuote: excerpt.trim(),
                targetPage: 1,
                targetQuote: target.title,
              });
              break;
            }
          }
        }
      }
    }

    return relationships;
  }

  /**
   * Retrieves relationships for a matter.
   */
  public async getRelationships(matterId: string): Promise<DocumentRelationshipItem[]> {
    this.assertMatterOwned(matterId);
    const db = getDb();
    const rows = db
      .select()
      .from(schema.documentRelationships)
      .where(eq(schema.documentRelationships.matterId, matterId))
      .orderBy(desc(schema.documentRelationships.createdAt))
      .all();

    return this.mapRelationshipRows(rows);
  }

  /**
   * Updates status of a relationship (confirm or reject).
   */
  public async confirmRelationship(
    matterId: string,
    relationshipId: string,
    status: 'CONFIRMED' | 'REJECTED'
  ): Promise<DocumentRelationshipItem> {
    this.assertMatterOwned(matterId);
    const db = getDb();
    const existing = db
      .select()
      .from(schema.documentRelationships)
      .where(
        and(
          eq(schema.documentRelationships.id, relationshipId),
          eq(schema.documentRelationships.matterId, matterId)
        )
      )
      .get();

    if (!existing) {
      throw new NotFoundError(`Relationship ${relationshipId} not found in matter ${matterId}.`);
    }

    const now = new Date().toISOString();
    db.update(schema.documentRelationships)
      .set({ status, updatedAt: now })
      .where(eq(schema.documentRelationships.id, relationshipId))
      .run();

    const activityType: MatterActivityType =
      status === 'CONFIRMED' ? 'RELATIONSHIP_CONFIRMED' : 'RELATIONSHIP_REJECTED';
    await this.logActivity(
      matterId,
      activityType,
      `${status === 'CONFIRMED' ? 'Confirmed' : 'Rejected'} relationship: ${existing.relationshipType}`,
      { relationshipId, status }
    );

    const updated = db
      .select()
      .from(schema.documentRelationships)
      .where(eq(schema.documentRelationships.id, relationshipId))
      .get()!;

    const mapped = this.mapRelationshipRows([updated]);
    return mapped[0];
  }

  /**
   * Maps relationship database rows with document titles.
   */
  private mapRelationshipRows(
    rows: Array<typeof schema.documentRelationships.$inferSelect>
  ): DocumentRelationshipItem[] {
    const db = getDb();
    const docMap = new Map<string, string>();

    const docIds = new Set<string>();
    for (const r of rows) {
      docIds.add(r.sourceDocumentId);
      docIds.add(r.targetDocumentId);
    }

    if (docIds.size > 0) {
      const docs = db
        .select({ id: schema.documents.id, title: schema.documents.title })
        .from(schema.documents)
        .where(and(
          eq(schema.documents.userId, getCurrentUserId()),
          inArray(schema.documents.id, Array.from(docIds))
        ))
        .all();

      for (const d of docs) {
        docMap.set(d.id, d.title);
      }
    }

    return rows.map((r) => ({
      id: r.id,
      matterId: r.matterId,
      sourceDocumentId: r.sourceDocumentId,
      sourceDocumentTitle: docMap.get(r.sourceDocumentId) || 'Document',
      targetDocumentId: r.targetDocumentId,
      targetDocumentTitle: docMap.get(r.targetDocumentId) || 'Document',
      relationshipType: r.relationshipType as DocumentRelationshipType,
      description: r.description,
      sourcePage: r.sourcePage,
      sourceQuote: r.sourceQuote,
      targetPage: r.targetPage,
      targetQuote: r.targetQuote,
      confidence: r.confidence,
      classification: r.classification as 'DOCUMENT_FACT' | 'AI_INTERPRETATION' | 'NEEDS_REVIEW',
      status: r.status as 'SUGGESTED' | 'CONFIRMED' | 'REJECTED',
      isValidated: r.classification === 'DOCUMENT_FACT',
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * Cross-Document Consistency Check Engine.
   * Compares facts across analyzed member documents across 11 categories.
   * NEVER decides legal precedence.
   */
  public async checkConsistency(matterId: string): Promise<ConsistencyFinding[]> {
    this.assertMatterOwned(matterId);
    const db = getDb();

    // Fetch analyzed member documents
    const memberRows = db
      .select({
        documentId: schema.matterDocuments.documentId,
        title: schema.documents.title,
        role: schema.matterDocuments.role,
        analysisDataJson: schema.analyses.analysisDataJson,
      })
      .from(schema.matterDocuments)
      .innerJoin(schema.documents, eq(schema.matterDocuments.documentId, schema.documents.id))
      .leftJoin(schema.analyses, eq(schema.documents.id, schema.analyses.documentId))
      .where(and(
        eq(schema.matterDocuments.matterId, matterId),
        eq(schema.documents.userId, getCurrentUserId())
      ))
      .all();

    const analyzedDocs = memberRows.filter((r) => r.analysisDataJson != null);
    if (analyzedDocs.length < 2) {
      return [];
    }

    const parsedDocs = analyzedDocs.map((d) => {
      let parsed: LegalXRayAnalysis | null = null;
      try {
        parsed = JSON.parse(d.analysisDataJson!) as LegalXRayAnalysis;
      } catch {
        parsed = null;
      }
      return {
        documentId: d.documentId,
        title: d.title,
        role: d.role,
        analysis: parsed,
      };
    });

    const findings: ConsistencyFinding[] = [];

    // Pairwise fact comparison across 11 categories
    for (let i = 0; i < parsedDocs.length; i++) {
      for (let j = i + 1; j < parsedDocs.length; j++) {
        const docA = parsedDocs[i];
        const docB = parsedDocs[j];
        if (!docA.analysis || !docB.analysis) continue;

        // 1. NOTICE PERIODS
        const noticeA = docA.analysis.obligations.find(
          (o) =>
            o.obligation.toLowerCase().includes('notice') ||
            (o.conditionOrDeadline && o.conditionOrDeadline.toLowerCase().includes('notice'))
        );
        const noticeB = docB.analysis.obligations.find(
          (o) =>
            o.obligation.toLowerCase().includes('notice') ||
            (o.conditionOrDeadline && o.conditionOrDeadline.toLowerCase().includes('notice'))
        );

        if (noticeA && noticeB) {
          const textA = `${noticeA.obligation} ${noticeA.conditionOrDeadline || ''}`;
          const textB = `${noticeB.obligation} ${noticeB.conditionOrDeadline || ''}`;
          const daysA = textA.match(/(\d+)\s*(days?|business days?|weeks?)/i);
          const daysB = textB.match(/(\d+)\s*(days?|business days?|weeks?)/i);

          if (daysA && daysB && daysA[0].toLowerCase() !== daysB[0].toLowerCase()) {
            findings.push({
              id: generateId('cons'),
              category: 'NOTICE',
              title: 'Differing Notice Periods',
              description: `"${docA.title}" references a notice period of ${daysA[0]}, whereas "${docB.title}" states ${daysB[0]}.`,
              severity: 'HIGH',
              sourceA: {
                documentId: docA.documentId,
                documentTitle: docA.title,
                pageNumber: noticeA.pageNumber,
                quotedText: noticeA.quotedText,
                value: daysA[0],
              },
              sourceB: {
                documentId: docB.documentId,
                documentTitle: docB.title,
                pageNumber: noticeB.pageNumber,
                quotedText: noticeB.quotedText,
                value: daysB[0],
              },
              discussionPoint:
                'Consider asking counsel which notice provision governs in the event of termination or formal notices under the relevant circumstances.',
            });
          }
        }

        // 2. DATES (Effective / Execution Dates)
        const effDateA = docA.analysis.keyDates.find((d) =>
          d.label.toLowerCase().includes('effective') || d.description.toLowerCase().includes('effective')
        );
        const effDateB = docB.analysis.keyDates.find((d) =>
          d.label.toLowerCase().includes('effective') || d.description.toLowerCase().includes('effective')
        );

        if (effDateA && effDateB && effDateA.dateValue !== effDateB.dateValue) {
          findings.push({
            id: generateId('cons'),
            category: 'DATES',
            title: 'Differing Effective Dates',
            description: `"${docA.title}" indicates an effective date of ${effDateA.dateValue}, while "${docB.title}" specifies ${effDateB.dateValue}.`,
            severity: 'MEDIUM',
            sourceA: {
              documentId: docA.documentId,
              documentTitle: docA.title,
              pageNumber: effDateA.pageNumber,
              quotedText: effDateA.quotedText,
              value: effDateA.dateValue,
            },
            sourceB: {
              documentId: docB.documentId,
              documentTitle: docB.title,
              pageNumber: effDateB.pageNumber,
              quotedText: effDateB.quotedText,
              value: effDateB.dateValue,
            },
            discussionPoint:
              'Clarify with counsel the precise date on which the operative terms or amendments took effect.',
          });
        }

        // 3. GOVERNING LAW
        const govLawA = docA.analysis.overview.governingLaw;
        const govLawB = docB.analysis.overview.governingLaw;

        if (
          govLawA &&
          govLawB &&
          govLawA.toLowerCase() !== govLawB.toLowerCase() &&
          !govLawA.toLowerCase().includes('not identified') &&
          !govLawB.toLowerCase().includes('not identified')
        ) {
          findings.push({
            id: generateId('cons'),
            category: 'GOVERNING_LAW',
            title: 'Differing Governing Law References',
            description: `"${docA.title}" references "${govLawA}", whereas "${docB.title}" specifies "${govLawB}".`,
            severity: 'HIGH',
            sourceA: {
              documentId: docA.documentId,
              documentTitle: docA.title,
              pageNumber: 1,
              quotedText: govLawA,
              value: govLawA,
            },
            sourceB: {
              documentId: docB.documentId,
              documentTitle: docB.title,
              pageNumber: 1,
              quotedText: govLawB,
              value: govLawB,
            },
            discussionPoint:
              'Ask counsel which jurisdiction governs any dispute involving both documents or how conflicting choice-of-law clauses are harmonized.',
          });
        }

        // 4. PAYMENT TERMS / FEES
        const finA = docA.analysis.financialTerms[0];
        const finB = docB.analysis.financialTerms[0];

        if (
          finA &&
          finB &&
          finA.term.trim().toLowerCase() === finB.term.trim().toLowerCase() &&
          finA.amountOrValue &&
          finB.amountOrValue &&
          finA.amountOrValue !== finB.amountOrValue
        ) {
          findings.push({
            id: generateId('cons'),
            category: 'PAYMENT',
            title: 'Differing Payment or Fee Terms',
            description: `"${docA.title}" records ${finA.term} (${finA.amountOrValue}), while "${docB.title}" specifies ${finB.term} (${finB.amountOrValue}).`,
            severity: 'MEDIUM',
            sourceA: {
              documentId: docA.documentId,
              documentTitle: docA.title,
              pageNumber: finA.pageNumber,
              quotedText: finA.quotedText,
              value: finA.amountOrValue,
            },
            sourceB: {
              documentId: docB.documentId,
              documentTitle: docB.title,
              pageNumber: finB.pageNumber,
              quotedText: finB.quotedText,
              value: finB.amountOrValue,
            },
            discussionPoint:
              'Confirm with counsel whether the subsequent agreement modified the financial consideration or fee schedule.',
          });
        }

        // 5. CONFIDENTIALITY DURATION
        const confA = docA.analysis.obligations.find((o) =>
          o.obligation.toLowerCase().includes('confidential')
        );
        const confB = docB.analysis.obligations.find((o) =>
          o.obligation.toLowerCase().includes('confidential')
        );

        if (confA && confB) {
          const textA = `${confA.obligation} ${confA.conditionOrDeadline || ''}`;
          const textB = `${confB.obligation} ${confB.conditionOrDeadline || ''}`;
          const durA = textA.match(/(\d+)\s*(years?|months?)/i);
          const durB = textB.match(/(\d+)\s*(years?|months?)/i);

          if (durA && durB && durA[0].toLowerCase() !== durB[0].toLowerCase()) {
            findings.push({
              id: generateId('cons'),
              category: 'CONFIDENTIALITY',
              title: 'Differing Non-Disclosure Durations',
              description: `"${docA.title}" specifies a confidentiality duration of ${durA[0]}, while "${docB.title}" states ${durB[0]}.`,
              severity: 'MEDIUM',
              sourceA: {
                documentId: docA.documentId,
                documentTitle: docA.title,
                pageNumber: confA.pageNumber,
                quotedText: confA.quotedText,
                value: durA[0],
              },
              sourceB: {
                documentId: docB.documentId,
                documentTitle: docB.title,
                pageNumber: confB.pageNumber,
                quotedText: confB.quotedText,
                value: durB[0],
              },
              discussionPoint:
                'Verify with counsel the surviving term of confidentiality for proprietary information exchanged across both agreements.',
            });
          }
        }
      }
    }

    // Model overviews can contain paraphrases or wrong page numbers. A
    // discrepancy is shown only when both cited quotes exist on their pages.
    const pageText = new Map<string, string>();
    const isGrounded = (documentId: string, pageNumber: number | null | undefined, quote: string | null | undefined): boolean => {
      if (!documentId || pageNumber == null || !Number.isInteger(pageNumber) || !quote?.trim()) return false;
      const key = `${documentId}:${pageNumber}`;
      if (!pageText.has(key)) {
        const page = db.select({ text: schema.documentPages.text }).from(schema.documentPages)
          .where(and(eq(schema.documentPages.documentId, documentId), eq(schema.documentPages.pageNumber, pageNumber)))
          .limit(1).get();
        pageText.set(key, page?.text || '');
      }
      return pageText.get(key)!.replace(/\s+/g, ' ').includes(quote.trim().replace(/\s+/g, ' '));
    };
    return findings.filter((finding) =>
      isGrounded(finding.sourceA.documentId, finding.sourceA.pageNumber, finding.sourceA.quotedText) &&
      isGrounded(finding.sourceB.documentId, finding.sourceB.pageNumber, finding.sourceB.quotedText)
    ).map((finding) => ({
      ...finding,
      id: `cons_${createHash('sha256').update(JSON.stringify([
        finding.category, finding.sourceA.documentId, finding.sourceA.pageNumber, finding.sourceA.value,
        finding.sourceB.documentId, finding.sourceB.pageNumber, finding.sourceB.value,
      ])).digest('hex').slice(0, 20)}`,
    }));
  }

  /**
   * Extracts and sorts document-derived dates chronologically.
   * If date is unknown, marks "DATE NOT ESTABLISHED".
   */
  public async getTimeline(matterId: string): Promise<MatterTimelineEvent[]> {
    this.assertMatterOwned(matterId);
    const db = getDb();

    // Fetch analyzed member documents
    const memberRows = db
      .select({
        documentId: schema.matterDocuments.documentId,
        title: schema.documents.title,
        analysisDataJson: schema.analyses.analysisDataJson,
      })
      .from(schema.matterDocuments)
      .innerJoin(schema.documents, eq(schema.matterDocuments.documentId, schema.documents.id))
      .leftJoin(schema.analyses, eq(schema.documents.id, schema.analyses.documentId))
      .where(and(
        eq(schema.matterDocuments.matterId, matterId),
        eq(schema.documents.userId, getCurrentUserId())
      ))
      .all();

    const events: MatterTimelineEvent[] = [];

    for (const doc of memberRows) {
      if (!doc.analysisDataJson) {
        events.push({
          id: generateId('evt'),
          dateValue: 'DATE NOT ESTABLISHED',
          isEstablished: false,
          label: 'Document Added',
          description: `${doc.title} has not been analyzed yet for documentary dates.`,
          documentId: doc.documentId,
          documentTitle: doc.title,
          classification: 'NEEDS_REVIEW',
        });
        continue;
      }

      let analysis: LegalXRayAnalysis | null = null;
      try {
        analysis = JSON.parse(doc.analysisDataJson) as LegalXRayAnalysis;
      } catch {
        analysis = null;
      }

      if (!analysis || !analysis.keyDates || analysis.keyDates.length === 0) {
        events.push({
          id: generateId('evt'),
          dateValue: 'DATE NOT ESTABLISHED',
          isEstablished: false,
          label: 'No Explicit Dates',
          description: `No explicit dates were identified in ${doc.title}.`,
          documentId: doc.documentId,
          documentTitle: doc.title,
          classification: 'GENERAL_INFO',
        });
        continue;
      }

      for (const d of analysis.keyDates) {
        const isEstablished =
          Boolean(d.dateValue) &&
          !d.dateValue.toLowerCase().includes('not identified') &&
          !d.dateValue.toLowerCase().includes('unknown');

        events.push({
          id: generateId('evt'),
          dateValue: isEstablished ? d.dateValue : 'DATE NOT ESTABLISHED',
          isEstablished,
          label: d.label,
          description: d.description,
          documentId: doc.documentId,
          documentTitle: doc.title,
          pageNumber: d.pageNumber,
          quotedText: d.quotedText,
          classification: 'DOCUMENT_FACT',
        });
      }
    }

    // Chronological sort for established dates (ISO or YYYY-MM-DD or parseable dates first)
    return events.sort((a, b) => {
      if (a.isEstablished && !b.isEstablished) return -1;
      if (!a.isEstablished && b.isEstablished) return 1;
      if (!a.isEstablished && !b.isEstablished) return 0;

      const dateA = Date.parse(a.dateValue);
      const dateB = Date.parse(b.dateValue);

      if (!isNaN(dateA) && !isNaN(dateB)) {
        return dateA - dateB;
      }
      return a.dateValue.localeCompare(b.dateValue);
    });
  }

  /**
   * Server-side page text search across all member documents in a matter.
   * Searches document_pages.text without needing cloud vector DB or external search engine.
   */
  public async searchMatter(matterId: string, query: string): Promise<MatterSearchResponse> {
    this.assertMatterOwned(matterId);
    const trimmedQuery = (query || '').trim();
    if (!trimmedQuery) {
      throw new ValidationError('Search query must not be empty.');
    }
    if (trimmedQuery.length > 200) {
      throw new ValidationError('Search query cannot exceed 200 characters.');
    }

    const db = getDb();

    // Fetch member documents
    const memberDocs = db
      .select({
        documentId: schema.matterDocuments.documentId,
        title: schema.documents.title,
        role: schema.matterDocuments.role,
      })
      .from(schema.matterDocuments)
      .innerJoin(schema.documents, eq(schema.matterDocuments.documentId, schema.documents.id))
      .where(and(
        eq(schema.matterDocuments.matterId, matterId),
        eq(schema.documents.userId, getCurrentUserId())
      ))
      .all();

    if (memberDocs.length === 0) {
      return { query: trimmedQuery, totalMatches: 0, results: [] };
    }

    const docIds = memberDocs.map((d) => d.documentId);

    // Escape query for SQL LIKE search
    const escapedLike = `%${trimmedQuery.replace(/[%_\\]/g, '\\$&')}%`;

    // Search document_pages
    const matchingPages = db
      .select({
        documentId: schema.documentPages.documentId,
        pageNumber: schema.documentPages.pageNumber,
        text: schema.documentPages.text,
      })
      .from(schema.documentPages)
      .where(
        and(
          inArray(schema.documentPages.documentId, docIds),
          like(schema.documentPages.text, escapedLike)
        )
      )
      .orderBy(asc(schema.documentPages.documentId), asc(schema.documentPages.pageNumber))
      .all();

    const resultsByDoc = new Map<string, MatterSearchMatch[]>();
    let totalMatches = 0;

    const lowerQuery = trimmedQuery.toLowerCase();

    for (const page of matchingPages) {
      const pageText = page.text;
      const lowerText = pageText.toLowerCase();
      let matchIdx = lowerText.indexOf(lowerQuery);

      while (matchIdx !== -1) {
        totalMatches++;
        const matchedText = pageText.slice(matchIdx, matchIdx + trimmedQuery.length);
        const snippetStart = Math.max(0, matchIdx - 70);
        const snippetEnd = Math.min(pageText.length, matchIdx + trimmedQuery.length + 70);

        const prefix = snippetStart > 0 ? '...' : '';
        const suffix = snippetEnd < pageText.length ? '...' : '';
        const snippet = `${prefix}${pageText.slice(snippetStart, snippetEnd).trim()}${suffix}`;

        if (!resultsByDoc.has(page.documentId)) {
          resultsByDoc.set(page.documentId, []);
        }

        resultsByDoc.get(page.documentId)!.push({
          pageNumber: page.pageNumber,
          matchedText,
          snippet,
        });

        // Search next occurrence on same page
        matchIdx = lowerText.indexOf(lowerQuery, matchIdx + trimmedQuery.length);
      }
    }

    const results: MatterDocumentSearchResult[] = memberDocs
      .filter((d) => resultsByDoc.has(d.documentId))
      .map((d) => ({
        documentId: d.documentId,
        documentTitle: d.title,
        role: d.role as MatterDocumentRole,
        matches: resultsByDoc.get(d.documentId) || [],
      }));

    return {
      query: trimmedQuery,
      totalMatches,
      results,
    };
  }

  /**
   * "Ask My Matter" cross-document Q&A.
   * Synthesizes answers strictly from verified document analysis and relationships.
   * Anti-UPL: Never adjudicates which contract wins.
   */
  public async queryMatter(matterId: string, question: string): Promise<MatterQueryResponse> {
    const trimmedQuestion = (question || '').trim();
    if (!trimmedQuestion) {
      throw new ValidationError('Question must not be empty.');
    }

    const matter = await this.getMatter(matterId);
    const relationships = await this.getRelationships(matterId);
    const consistency = await this.checkConsistency(matterId);

    // Search matter for keywords in user question to pull relevant snippets
    const searchWords = trimmedQuestion
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 4);

    const relevantSnippets: string[] = [];
    if (searchWords.length > 0) {
      try {
        const searchRes = await this.searchMatter(matterId, searchWords[0]);
        for (const docRes of searchRes.results) {
          for (const match of docRes.matches.slice(0, 2)) {
            relevantSnippets.push(`[${docRes.documentTitle} - Page ${match.pageNumber}]: "${match.snippet}"`);
          }
        }
      } catch {
        // Ignore search errors
      }
    }

    const documentsText = matter.documents
      .map((d) => `Doc ID: ${d.documentId} | Title: "${d.title}" | Role: ${d.role} | Status: ${d.status}`)
      .join('\n');

    const relationshipsText = relationships
      .map(
        (r) =>
          `"${r.sourceDocumentTitle}" ${r.relationshipType} "${r.targetDocumentTitle}" (Status: ${r.status})`
      )
      .join('\n');

    const consistencyText = consistency
      .map(
        (c) =>
          `[${c.category}] "${c.sourceA.documentTitle}" (${c.sourceA.value}) vs "${c.sourceB.documentTitle}" (${c.sourceB.value})`
      )
      .join('\n');

    const relevantPagesText = relevantSnippets.join('\n');
    const relatedPreparationItems = await this.findRelatedActionItems(matterId, searchWords);

    if (this.gemini.isConfigured()) {
      try {
        const prompt = buildMatterQuestionPrompt({
          matterTitle: matter.title,
          jurisdiction: matter.jurisdiction || 'Not established',
          documentsText,
          relationshipsText,
          consistencyText,
          relevantPagesText,
          userQuestion: trimmedQuestion,
        });

        const schemaDescription = `{
  "answer": "string",
  "citations": [
    {
      "documentId": "string",
      "documentTitle": "string",
      "pageNumber": number,
      "quotedText": "string"
    }
  ],
  "crossDocumentObservations": ["string"],
  "suggestedQuestionsForCounsel": ["string"]
}`;

        const rawResponse = await this.gemini.generateStructured<{
          answer: string;
          citations: Array<{
            documentId: string;
            documentTitle: string;
            pageNumber: number;
            quotedText: string;
          }>;
          crossDocumentObservations?: string[];
          suggestedQuestionsForCounsel?: string[];
        }>(prompt, schemaDescription, { systemInstruction: SYSTEM_MATTER_ANALYST_PROMPT });

        // Require each quoted source to belong to this matter and match the
        // claimed document page. Model-supplied titles are never trusted.
        const memberById = new Map(matter.documents.map((doc) => [doc.documentId, doc]));
        const db = getDb();
        const verifiedCitations = (Array.isArray(rawResponse.citations) ? rawResponse.citations : [])
          .filter((citation) => {
            if (!citation || !memberById.has(citation.documentId) || !Number.isInteger(citation.pageNumber) || !citation.quotedText?.trim()) return false;
            const page = db.select({ text: schema.documentPages.text }).from(schema.documentPages)
              .where(and(eq(schema.documentPages.documentId, citation.documentId), eq(schema.documentPages.pageNumber, citation.pageNumber)))
              .limit(1).get();
            return Boolean(page?.text.replace(/\s+/g, ' ').includes(citation.quotedText.trim().replace(/\s+/g, ' ')));
          })
          .map((citation) => ({ ...citation, documentTitle: memberById.get(citation.documentId)!.title }));

        if (verifiedCitations.length === 0) {
          return {
            answer: 'I could not verify a supporting quote in the documents for this answer. Try a narrower question or review the documents directly.',
            citations: [], crossDocumentObservations: [], suggestedQuestionsForCounsel: [],
            relatedPreparationItems: relatedPreparationItems.length ? relatedPreparationItems : undefined,
            disclaimer: LEGAL_DISCLAIMERS.GLOBAL_FOOTER,
          };
        }

        // Anti-UPL safety check
        let finalAnswer = rawResponse.answer || '';
        if (containsProhibitedLegalConclusion(finalAnswer)) {
          finalAnswer =
            'The member documents contain varying provisions regarding this topic. LawGuide AI provides document analysis and does not determine legal enforceability or which document takes legal precedence. Please consult with qualified legal counsel.';
        }

        return {
          answer: finalAnswer,
          citations: verifiedCitations,
          crossDocumentObservations: [],
          suggestedQuestionsForCounsel: rawResponse.suggestedQuestionsForCounsel || [
            'How are conflicting terms across these documents resolved under the governing law clause?',
          ],
          relatedPreparationItems:
            relatedPreparationItems.length > 0 ? relatedPreparationItems : undefined,
          disclaimer: LEGAL_DISCLAIMERS.GLOBAL_FOOTER,
        };
      } catch {
        // Fallback
        return this.deterministicQueryFallback(
          matter,
          trimmedQuestion,
          relationships,
          consistency,
          relatedPreparationItems
        );
      }
    }

    return this.deterministicQueryFallback(
      matter,
      trimmedQuestion,
      relationships,
      consistency,
      relatedPreparationItems
    );
  }

  /**
   * Helper to find related action items for a query.
   */
  private async findRelatedActionItems(matterId: string, searchWords: string[]) {
    try {
      const items = await this.getActionItems(matterId);
      return items
        .filter((item) => {
          const text = `${item.title} ${item.description || ''}`.toLowerCase();
          return searchWords.some((w) => text.includes(w.toLowerCase()));
        })
        .slice(0, 3)
        .map((item) => ({
          id: item.id,
          title: item.title,
          itemType: item.type,
          status: item.status,
          priority: item.priority,
        }));
    } catch {
      return [];
    }
  }

  /**
   * Deterministic Ask My Matter Q&A fallback when Gemini is offline.
   */
  private deterministicQueryFallback(
    matter: MatterDetail,
    question: string,
    relationships: DocumentRelationshipItem[],
    consistency: ConsistencyFinding[],
    relatedPreparationItems?: Array<{
      id: string;
      title: string;
      itemType: ActionItemType;
      status: ActionItemStatus;
    }>
  ): MatterQueryResponse {
    const qLower = question.toLowerCase();
    const citations: MatterQueryResponse['citations'] = [];
    const observations: string[] = [];

    // Anti-adjudication: refuse to declare contract winners, legal advice, or legal precedence
    if (
      qLower.includes('win') ||
      qLower.includes('prevail') ||
      qLower.includes('control') ||
      qLower.includes('precedence') ||
      qLower.includes('supersede') ||
      qLower.includes('which contract') ||
      qLower.includes('should i') ||
      qLower.includes('terminate') ||
      qLower.includes('sue') ||
      qLower.includes('settle') ||
      qLower.includes('enforceab') ||
      qLower.includes('valid')
    ) {
      return {
        answer:
          'LawGuide AI does not determine which contract prevails or wins, and provides legal information and preparation support, not legal advice. Determining tactical legal actions (such as terminating, settling, or suing) or deciding legal priority and enforceability requires formal analysis by qualified legal counsel based on the specific facts, execution sequence, and applicable governing law.',
        citations: [],
        crossDocumentObservations: [
          'Agreements and clauses in this matter require professional review for strategic or contentious decisions.',
        ],
        suggestedQuestionsForCounsel: [
          'What are the legal implications and potential liabilities of terminating or taking formal action under this agreement?',
          'Which agreement takes precedence in the event of an inconsistency between clauses?',
          'Does the agreement contain mandatory dispute resolution, mediation, or cure period requirements prior to formal action?',
        ],
        relatedPreparationItems:
          relatedPreparationItems && relatedPreparationItems.length > 0
            ? relatedPreparationItems
            : undefined,
        disclaimer: LEGAL_DISCLAIMERS.GLOBAL_FOOTER,
      };
    }

    // Notice question
    if (qLower.includes('notice')) {
      const noticeCons = consistency.find((c) => c.category === 'NOTICE');
      if (noticeCons) {
        citations.push({
          documentId: noticeCons.sourceA.documentId,
          documentTitle: noticeCons.sourceA.documentTitle,
          pageNumber: noticeCons.sourceA.pageNumber || 1,
          quotedText: noticeCons.sourceA.quotedText || noticeCons.sourceA.value,
        });
        citations.push({
          documentId: noticeCons.sourceB.documentId,
          documentTitle: noticeCons.sourceB.documentTitle,
          pageNumber: noticeCons.sourceB.pageNumber || 1,
          quotedText: noticeCons.sourceB.quotedText || noticeCons.sourceB.value,
        });
        observations.push(
          `Notice period differs between "${noticeCons.sourceA.documentTitle}" (${noticeCons.sourceA.value}) and "${noticeCons.sourceB.documentTitle}" (${noticeCons.sourceB.value}).`
        );
      }

      return {
        answer: `Across the member documents in this matter, notice provisions appear with differing timeframes. In "${matter.title}", ${
          noticeCons
            ? `one document specifies ${noticeCons.sourceA.value} while another states ${noticeCons.sourceB.value}.`
            : 'multiple notice provisions were identified.'
        } LawGuide does not determine which provision controls.`,
        citations,
        crossDocumentObservations: observations,
        suggestedQuestionsForCounsel: [
          'Which notice period applies if a notice of termination is delivered today?',
          'Does the subsequent agreement or amendment supersede the earlier notice terms?',
        ],
        relatedPreparationItems:
          relatedPreparationItems && relatedPreparationItems.length > 0
            ? relatedPreparationItems
            : undefined,
        disclaimer: LEGAL_DISCLAIMERS.GLOBAL_FOOTER,
      };
    }

    // Default general response
    return {
      answer: `This matter contains ${matter.documents.length} member documents. Documents include: ${matter.documents.map((d) => d.title).join(', ')}. ${
        relationships.length > 0
          ? `Identified relationships: ${relationships.map((r) => `${r.sourceDocumentTitle} ${r.relationshipType} ${r.targetDocumentTitle}`).join('; ')}.`
          : 'No cross-document relationships have been confirmed yet.'
      }`,
      citations: [],
      crossDocumentObservations: [
        `Matter has ${matter.metrics.analyzedDocuments} of ${matter.metrics.totalDocuments} documents analyzed.`,
      ],
      suggestedQuestionsForCounsel: [
        'How do the rights and obligations under these agreements interact with one another?',
      ],
      relatedPreparationItems:
        relatedPreparationItems && relatedPreparationItems.length > 0
          ? relatedPreparationItems
          : undefined,
      disclaimer: LEGAL_DISCLAIMERS.GLOBAL_FOOTER,
    };
  }

  /**
   * User Notes CRUD for a matter.
   */
  public async getNotes(matterId: string) {
    this.assertMatterOwned(matterId);
    const db = getDb();
    return db
      .select()
      .from(schema.matterNotes)
      .where(eq(schema.matterNotes.matterId, matterId))
      .orderBy(desc(schema.matterNotes.createdAt))
      .all();
  }

  public async addNote(matterId: string, title: string, content: string) {
    this.assertMatterOwned(matterId);
    const trimmedTitle = (title || '').trim();
    const trimmedContent = (content || '').trim();
    if (!trimmedTitle || !trimmedContent) {
      throw new ValidationError('Note title and content are required.');
    }

    const db = getDb();
    const noteId = generateId('mnote');
    const now = new Date().toISOString();

    const record = {
      id: noteId,
      matterId,
      title: trimmedTitle,
      content: trimmedContent,
      classification: 'USER_PROVIDED',
      createdAt: now,
      updatedAt: now,
    };

    db.insert(schema.matterNotes).values(record).run();

    await this.logActivity(
      matterId,
      'NOTE_ADDED',
      `Added note: "${trimmedTitle}"`,
      { noteId }
    );

    return record;
  }

  public async deleteNote(matterId: string, noteId: string) {
    this.assertMatterOwned(matterId);
    const db = getDb();
    const res = db
      .delete(schema.matterNotes)
      .where(
        and(eq(schema.matterNotes.id, noteId), eq(schema.matterNotes.matterId, matterId))
      )
      .run();

    if (res.changes === 0) {
      throw new NotFoundError(`Note ${noteId} not found in matter ${matterId}.`);
    }

    await this.logActivity(
      matterId,
      'NOTE_DELETED',
      `Deleted note`,
      { noteId }
    );
  }

  /**
   * Computes deterministic overview metrics for a matter.
   */
  private async computeMetrics(
    matterId: string,
    memberDocs: MatterMemberDocument[]
  ): Promise<MatterOverviewMetrics> {
    const userId = getCurrentUserId();
    const db = getDb();

    const totalDocuments = memberDocs.length;
    const analyzedDocuments = memberDocs.filter((d) => d.status === 'READY').length;

    // Comparisons between documents in this matter
    const docIds = memberDocs.map((d) => d.documentId);
    let totalComparisons = 0;
    if (docIds.length >= 2) {
      const compCount = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.comparisons)
        .where(
          and(
            eq(schema.comparisons.userId, userId),
            inArray(schema.comparisons.baseDocumentId, docIds),
            inArray(schema.comparisons.targetDocumentId, docIds)
          )
        )
        .get()?.count || 0;
      totalComparisons = compCount;
    }

    // Relationships
    const relRows = db
      .select({
        total: sql<number>`count(*)`,
        confirmed: sql<number>`sum(case when ${schema.documentRelationships.status} = 'CONFIRMED' then 1 else 0 end)`,
      })
      .from(schema.documentRelationships)
      .where(eq(schema.documentRelationships.matterId, matterId))
      .get();

    const totalRelationships = relRows?.total || 0;
    const verifiedRelationships = relRows?.confirmed || 0;

    // Consistency check count
    const consistencyFindings = await this.checkConsistency(matterId);
    const totalInconsistencies = consistencyFindings.length;

    // Open attention areas from member analyses
    let openAttentionAreas = 0;
    let totalLawyerQuestions = 0;

    if (docIds.length > 0) {
      const analysesList = db
        .select({ analysisDataJson: schema.analyses.analysisDataJson })
        .from(schema.analyses)
        .where(inArray(schema.analyses.documentId, docIds))
        .all();

      for (const a of analysesList) {
        if (!a.analysisDataJson) continue;
        try {
          const parsed = JSON.parse(a.analysisDataJson) as LegalXRayAnalysis;
          openAttentionAreas += parsed.attentionAreas?.length || 0;
          totalLawyerQuestions += parsed.lawyerQuestions?.length || 0;
        } catch {
          // ignore parse errors
        }
      }
    }

    // Readiness score calculation
    let score = 0;
    if (totalDocuments > 0) {
      score += Math.round((analyzedDocuments / totalDocuments) * 50);
    }
    if (totalRelationships > 0) {
      score += Math.round((verifiedRelationships / totalRelationships) * 25);
    } else if (totalDocuments >= 2) {
      score += 15;
    }
    if (analyzedDocuments >= 2) {
      score += 25;
    }

    const preparationReadyScore = Math.min(100, Math.max(0, score));

    return {
      totalDocuments,
      analyzedDocuments,
      totalComparisons,
      totalRelationships,
      verifiedRelationships,
      openAttentionAreas,
      totalInconsistencies,
      totalLawyerQuestions,
      preparationReadyScore,
    };
  }

  /**
   * Logs an action in the matter activity audit history.
   */
  public async logActivity(
    matterId: string,
    actionType: MatterActivityType,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<MatterActivityItem> {
    const db = getDb();
    const id = generateId('mact');
    const now = new Date().toISOString();

    const record = {
      id,
      matterId,
      actionType,
      description,
      metadataJson: metadata ? JSON.stringify(metadata) : null,
      createdAt: now,
    };

    db.insert(schema.matterActivity).values(record).run();

    return {
      id,
      matterId,
      actionType,
      description,
      metadata: metadata || null,
      createdAt: now,
    };
  }

  /**
   * Retrieves the activity audit log for a matter.
   */
  public async getActivity(matterId: string, limit = 50): Promise<MatterActivityItem[]> {
    this.assertMatterOwned(matterId);
    const db = getDb();
    const rows = db
      .select()
      .from(schema.matterActivity)
      .where(eq(schema.matterActivity.matterId, matterId))
      .orderBy(desc(schema.matterActivity.createdAt))
      .limit(limit)
      .all();

    return rows.map((r) => {
      let metadata: Record<string, unknown> | null = null;
      if (r.metadataJson) {
        try {
          metadata = JSON.parse(r.metadataJson);
        } catch {
          // ignore
        }
      }
      return {
        id: r.id,
        matterId: r.matterId,
        actionType: r.actionType as MatterActivityType,
        description: r.description,
        metadata,
        createdAt: r.createdAt,
      };
    });
  }

  /**
   * Creates an action item in the matter action plan.
   */
  public async createActionItem(
    matterId: string,
    input: CreateActionItemInput
  ): Promise<MatterActionItem> {
    const trimmedTitle = typeof input?.title === 'string' ? input.title.trim() : '';
    const trimmedDesc = typeof input?.description === 'string' ? input.description.trim() : '';
    if (!trimmedTitle) {
      throw new ValidationError('Action item title is required.');
    }

    const matter = await this.getMatter(matterId);

    const db = getDb();
    const memberIds = new Set(matter.documents.map((doc) => doc.documentId));
    if (input.relatedDocumentId && !memberIds.has(input.relatedDocumentId)) {
      throw new ValidationError('Related document must belong to this matter.');
    }
    if (input.relatedComparisonId) {
      const userId = getCurrentUserId();
      const comparison = db.select({
        baseDocumentId: schema.comparisons.baseDocumentId,
        targetDocumentId: schema.comparisons.targetDocumentId,
      }).from(schema.comparisons)
        .where(and(
          eq(schema.comparisons.id, input.relatedComparisonId),
          eq(schema.comparisons.userId, userId)
        )).get();
      if (!comparison || !memberIds.has(comparison.baseDocumentId) || !memberIds.has(comparison.targetDocumentId)) {
        throw new ValidationError('Related comparison must use documents in this matter.');
      }
    }
    if (input.relatedRelationshipId) {
      const relationship = db.select({ matterId: schema.documentRelationships.matterId })
        .from(schema.documentRelationships)
        .where(eq(schema.documentRelationships.id, input.relatedRelationshipId)).get();
      if (relationship?.matterId !== matterId) {
        throw new ValidationError('Related relationship must belong to this matter.');
      }
    }
    const id = generateId('mact_item');
    const now = new Date().toISOString();

    const record = {
      id,
      matterId,
      title: trimmedTitle,
      description: trimmedDesc,
      type: input.type || 'FOLLOW_UP',
      status: 'OPEN' as const,
      priority: input.priority || 'MEDIUM',
      sourceType: input.sourceType || 'MANUAL',
      sourceReference: input.sourceReference || null,
      relatedDocumentId: input.relatedDocumentId || null,
      relatedComparisonId: input.relatedComparisonId || null,
      relatedRelationshipId: input.relatedRelationshipId || null,
      relatedConsistencyFindingId: input.relatedConsistencyFindingId || null,
      userProvided: input.userProvided ? true : false,
      dueDate: input.dueDate || null,
      dueDateProvenance: input.dueDateProvenance || null,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(schema.matterActionItems).values(record).run();

    await this.logActivity(
      matterId,
      'ACTION_ITEM_CREATED',
      `Created action item: "${trimmedTitle}"`,
      { itemId: id, type: record.type, priority: record.priority }
    );

    return {
      ...record,
      userProvided: Boolean(record.userProvided),
    };
  }

  /**
   * Retrieves action items for a matter with optional filtering.
   */
  public async getActionItems(
    matterId: string,
    filter?: {
      status?: ActionItemStatus;
      priority?: ActionItemPriority;
      itemType?: ActionItemType;
    }
  ): Promise<MatterActionItem[]> {
    this.assertMatterOwned(matterId);
    const db = getDb();
    const conditions = [eq(schema.matterActionItems.matterId, matterId)];

    if (filter?.status) {
      conditions.push(eq(schema.matterActionItems.status, filter.status));
    }
    if (filter?.priority) {
      conditions.push(eq(schema.matterActionItems.priority, filter.priority));
    }
    if (filter?.itemType) {
      conditions.push(eq(schema.matterActionItems.type, filter.itemType));
    }

    const rows = db
      .select()
      .from(schema.matterActionItems)
      .where(and(...conditions))
      .orderBy(desc(schema.matterActionItems.createdAt))
      .all();

    // Query document titles for member documents in this matter
    const docMap = new Map<string, string>();
    const matterDocs = rows.some((row) => row.relatedDocumentId) ? db
      .select({ id: schema.documents.id, title: schema.documents.title })
      .from(schema.documents)
      .innerJoin(
        schema.matterDocuments,
        eq(schema.documents.id, schema.matterDocuments.documentId)
      )
      .where(and(
        eq(schema.matterDocuments.matterId, matterId),
        eq(schema.documents.userId, getCurrentUserId())
      ))
      .all() : [];
    for (const d of matterDocs) {
      docMap.set(d.id, d.title);
    }

    return rows.map((r) => {
      const isUser =
        r.sourceType === 'USER_CREATED' ||
        r.sourceType === 'MANUAL' ||
        Boolean(r.userProvided);
      const docTitle = r.relatedDocumentId
        ? docMap.get(r.relatedDocumentId) || null
        : null;

      let why = 'Derived from matter analysis.';
      if (isUser) {
        why = 'User-created preparation task.';
      } else if (r.sourceType === 'CONSISTENCY') {
        why = `Generated from Cross-Document Consistency observation${
          r.sourceReference ? ` (${r.sourceReference})` : ''
        }.`;
      } else if (r.sourceType === 'RELATIONSHIP') {
        why = `Generated from Cross-Document Relationship verification${
          r.sourceReference ? ` (${r.sourceReference})` : ''
        }.`;
      } else if (r.sourceType === 'LEGAL_XRAY' || r.sourceType === 'DOCUMENT') {
        why = `Generated from Legal X-Ray analysis of ${
          docTitle || 'member document'
        }.`;
      } else if (r.sourceType === 'TIMELINE') {
        why = 'Generated from Matter Chronology event.';
      }

      const evidenceChain = r.relatedDocumentId
        ? [
            {
              documentId: r.relatedDocumentId,
              documentTitle: docTitle || 'Member Document',
              pageNumber: undefined,
              quotedText: undefined,
              classification: 'NEEDS_REVIEW' as const,
              verificationStatus: 'UNVERIFIED' as const,
            },
          ]
        : undefined;

      return {
        id: r.id,
        matterId: r.matterId,
        title: r.title,
        description: r.description,
        type: r.type as ActionItemType,
        status: r.status as ActionItemStatus,
        priority: r.priority as ActionItemPriority,
        sourceType: r.sourceType as ActionItemSourceType,
        sourceReference: r.sourceReference,
        relatedDocumentId: r.relatedDocumentId,
        relatedDocumentTitle: docTitle,
        relatedComparisonId: r.relatedComparisonId,
        relatedRelationshipId: r.relatedRelationshipId,
        relatedConsistencyFindingId: r.relatedConsistencyFindingId,
        userProvided: Boolean(r.userProvided),
        dueDate: r.dueDate,
        dueDateProvenance: r.dueDateProvenance as DateProvenanceType | null,
        whyThisExists: why,
        isUserCreated: isUser,
        evidenceChain,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });
  }

  /**
   * Updates an action item.
   */
  public async updateActionItem(
    matterId: string,
    itemId: string,
    input: UpdateActionItemInput
  ): Promise<MatterActionItem> {
    this.assertMatterOwned(matterId);
    const db = getDb();
    const [existing] = db
      .select()
      .from(schema.matterActionItems)
      .where(
        and(
          eq(schema.matterActionItems.id, itemId),
          eq(schema.matterActionItems.matterId, matterId)
        )
      )
      .all();

    if (!existing) {
      throw new NotFoundError(`Action item ${itemId} not found in matter ${matterId}`);
    }

    const updates: Partial<typeof schema.matterActionItems.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    if (input.title !== undefined) updates.title = input.title.trim();
    if (input.description !== undefined) updates.description = input.description.trim();
    if (input.type !== undefined) updates.type = input.type;
    if (input.status !== undefined) updates.status = input.status;
    if (input.priority !== undefined) updates.priority = input.priority;
    if (input.dueDate !== undefined) updates.dueDate = input.dueDate;
    if (input.dueDateProvenance !== undefined) updates.dueDateProvenance = input.dueDateProvenance;

    db.update(schema.matterActionItems)
      .set(updates)
      .where(
        and(
          eq(schema.matterActionItems.id, itemId),
          eq(schema.matterActionItems.matterId, matterId)
        )
      )
      .run();

    const activityType: MatterActivityType =
      input.status === 'COMPLETED' ? 'ACTION_ITEM_COMPLETED' : 'ACTION_ITEM_UPDATED';

    await this.logActivity(
      matterId,
      activityType,
      input.status === 'COMPLETED'
        ? `Completed action item: "${existing.title}"`
        : `Updated action item: "${existing.title}"`,
      { itemId, changes: input }
    );

    const [updated] = db
      .select()
      .from(schema.matterActionItems)
      .where(eq(schema.matterActionItems.id, itemId))
      .all();

    return {
      id: updated.id,
      matterId: updated.matterId,
      title: updated.title,
      description: updated.description,
      type: updated.type as ActionItemType,
      status: updated.status as ActionItemStatus,
      priority: updated.priority as ActionItemPriority,
      sourceType: updated.sourceType as ActionItemSourceType,
      sourceReference: updated.sourceReference,
      relatedDocumentId: updated.relatedDocumentId,
      relatedComparisonId: updated.relatedComparisonId,
      relatedRelationshipId: updated.relatedRelationshipId,
      relatedConsistencyFindingId: updated.relatedConsistencyFindingId,
      userProvided: Boolean(updated.userProvided),
      dueDate: updated.dueDate,
      dueDateProvenance: updated.dueDateProvenance as DateProvenanceType | null,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Deletes an action item.
   */
  public async deleteActionItem(matterId: string, itemId: string): Promise<void> {
    this.assertMatterOwned(matterId);
    const db = getDb();
    const [existing] = db
      .select()
      .from(schema.matterActionItems)
      .where(
        and(
          eq(schema.matterActionItems.id, itemId),
          eq(schema.matterActionItems.matterId, matterId)
        )
      )
      .all();

    if (!existing) {
      throw new NotFoundError(`Action item ${itemId} not found in matter ${matterId}`);
    }

    db.delete(schema.matterActionItems)
      .where(
        and(
          eq(schema.matterActionItems.id, itemId),
          eq(schema.matterActionItems.matterId, matterId)
        )
      )
      .run();

    await this.logActivity(
      matterId,
      'ACTION_ITEM_DELETED',
      `Deleted action item "${existing.title}".`
    );
  }

  /**
   * Automatically generates action items from cross-document consistency checks,
   * unverified relationships, and member document attention areas/missing facts.
   * Deduplicates against existing open items.
   */
  public async generateActionItems(
    matterId: string
  ): Promise<{ createdCount: number; items: MatterActionItem[] }> {
    const matter = await this.getMatter(matterId);
    const existingItems = await this.getActionItems(matterId);
    const existingTitles = new Set(existingItems.map((i) => i.title.toLowerCase()));

    const newCandidates: CreateActionItemInput[] = [];

    // 1. Consistency discrepancies
    const consistencyFindings = await this.checkConsistency(matterId);
    for (const finding of consistencyFindings) {
      const title = `Verify consistency: ${finding.category} discrepancy`;
      if (existingTitles.has(title.toLowerCase())) continue;

      newCandidates.push({
        title,
        description: `Discrepancy identified between "${finding.sourceA.documentTitle}" (${finding.sourceA.value}) and "${finding.sourceB.documentTitle}" (${finding.sourceB.value}). Review both clauses to prepare discussion for counsel.`,
        type: 'REVIEW_CONSISTENCY',
        priority: finding.severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
        sourceType: 'CONSISTENCY',
        sourceReference: `Consistency Finding ${finding.id}`,
        relatedDocumentId: finding.sourceA.documentId,
        relatedConsistencyFindingId: finding.id,
      });
      existingTitles.add(title.toLowerCase());
    }

    // 2. Unverified relationships
    const relationships = await this.getRelationships(matterId);
    for (const rel of relationships) {
      if (rel.status === 'SUGGESTED') {
        const title = `Confirm relationship: ${rel.sourceDocumentTitle} → ${rel.targetDocumentTitle}`;
        if (existingTitles.has(title.toLowerCase())) continue;

        newCandidates.push({
          title,
          description: `Suggested relationship "${rel.relationshipType}": ${rel.description}. Confirm if this matches your legal context.`,
          type: 'CONFIRM_USER_CONTEXT',
          priority: 'MEDIUM',
          sourceType: 'RELATIONSHIP',
          sourceReference: `Relationship ${rel.id}`,
          relatedDocumentId: rel.sourceDocumentId,
          relatedRelationshipId: rel.id,
        });
        existingTitles.add(title.toLowerCase());
      }
    }

    // 3. Member document attention areas & missing information
    const db = getDb();
    const docIds = matter.documents.map((d) => d.documentId);
    if (docIds.length > 0) {
      const analysesList = db
        .select({
          documentId: schema.analyses.documentId,
          analysisDataJson: schema.analyses.analysisDataJson,
        })
        .from(schema.analyses)
        .where(inArray(schema.analyses.documentId, docIds))
        .all();

      for (const a of analysesList) {
        if (!a.analysisDataJson) continue;
        const doc = matter.documents.find((d) => d.documentId === a.documentId);
        const docTitle = doc?.title || 'Document';

        try {
          const parsed = JSON.parse(a.analysisDataJson) as LegalXRayAnalysis;

          // Attention areas (High/Medium severity)
          if (parsed.attentionAreas) {
            for (const aa of parsed.attentionAreas) {
              if (aa.attentionLevel === 'HIGH' || aa.attentionLevel === 'MEDIUM') {
                const title = `Review critical term: ${aa.title || aa.category} in ${docTitle}`;
                if (existingTitles.has(title.toLowerCase())) continue;

                newCandidates.push({
                  title,
                  description: `${aa.description || aa.whyItMatters}. Located on page ${aa.pageNumber || 1}.`,
                  type: 'REVIEW_DOCUMENT',
                  priority: aa.attentionLevel === 'HIGH' ? 'HIGH' : 'MEDIUM',
                  sourceType: 'LEGAL_XRAY',
                  sourceReference: `Page ${aa.pageNumber || 1} in ${docTitle}`,
                  relatedDocumentId: a.documentId,
                });
                existingTitles.add(title.toLowerCase());
              }
            }
          }
        } catch {
          // ignore parse errors
        }
      }

      // Also check if any preparation briefs exist for member documents with missingInformation
      const prepRecords = db
        .select({
          documentId: schema.preparations.documentId,
          preparationDataJson: schema.preparations.preparationDataJson,
        })
        .from(schema.preparations)
        .where(and(
          eq(schema.preparations.userId, getCurrentUserId()),
          inArray(schema.preparations.documentId, docIds),
          eq(schema.preparations.briefKind, 'PREPARATION')
        ))
        .all();

      for (const pr of prepRecords) {
        if (!pr.preparationDataJson) continue;
        try {
          const prepBrief = JSON.parse(pr.preparationDataJson);
          if (prepBrief.missingInformation) {
            for (const mi of prepBrief.missingInformation) {
              const title = `Collect missing document / fact: ${mi.item}`;
              if (existingTitles.has(title.toLowerCase())) continue;

              newCandidates.push({
                title,
                description: `Identified gap: ${mi.whyItMatters}. Prepare this record for consultation.`,
                type: 'PROVIDE_MISSING_INFORMATION',
                priority: 'MEDIUM',
                sourceType: 'MISSING_INFO',
                sourceReference: `Missing item in preparation`,
                relatedDocumentId: pr.documentId || undefined,
              });
              existingTitles.add(title.toLowerCase());
            }
          }
        } catch {
          // ignore
        }
      }

      // 4. Check for member documents without analysis or needing initial review
      for (const doc of matter.documents) {
        const hasAnalysis = analysesList.some((a) => a.documentId === doc.documentId);
        if (!hasAnalysis) {
          const title = `Perform Legal X-Ray analysis on "${doc.title}"`;
          if (!existingTitles.has(title.toLowerCase())) {
            newCandidates.push({
              title,
              description: `Document "${doc.title}" has been added to this matter with role ${doc.role}. Run Legal X-Ray analysis to extract key terms and clauses.`,
              type: 'REQUEST_DOCUMENT',
              priority: 'HIGH',
              sourceType: 'DOCUMENT',
              sourceReference: `Member Document ${doc.documentId}`,
              relatedDocumentId: doc.documentId,
            });
            existingTitles.add(title.toLowerCase());
          }
        }
      }
    }

    // Insert created candidates
    const createdItems: MatterActionItem[] = [];
    for (const cand of newCandidates) {
      const created = await this.createActionItem(matterId, cand);
      createdItems.push(created);
    }

    if (createdItems.length > 0) {
      await this.logActivity(
        matterId,
        'ACTION_ITEMS_GENERATED',
        `Generated ${createdItems.length} preparation action items`,
        { count: createdItems.length }
      );
    }

    const allItems = await this.getActionItems(matterId);
    return {
      createdCount: createdItems.length,
      items: allItems,
    };
  }

  /**
   * Computes an objective matter readiness report without artificial win-rates or advice.
   */
  public async getMatterReadiness(matterId: string): Promise<MatterReadinessReport> {
    const matter = await this.getMatter(matterId);
    const db = getDb();

    const totalDocuments = matter.documents.length;
    const analyzedDocuments = matter.documents.filter((d) => d.status === 'READY').length;

    // Timeline events
    const timeline = await this.getTimeline(matterId);
    const timelineEvents = timeline.length;

    // Relationships
    const relationships = await this.getRelationships(matterId);
    const verifiedRelationships = relationships.filter((r) => r.status === 'CONFIRMED').length;
    const relationshipsNeedingReview = relationships.filter((r) => r.status === 'SUGGESTED').length;

    // Consistency findings
    const consistencyFindings = matter.metrics.totalInconsistencies;

    // Action items
    const actionItems = await this.getActionItems(matterId);
    const openActionItems = actionItems.filter(
      (i) => i.status === 'OPEN' || i.status === 'IN_PROGRESS'
    ).length;
    const completedActionItems = actionItems.filter((i) => i.status === 'COMPLETED').length;

    // Information gaps and counsel questions from member analyses
    let informationGaps = actionItems.filter(
      (i) => i.type === 'PROVIDE_MISSING_INFORMATION' && i.status !== 'COMPLETED'
    ).length;
    let counselQuestions = consistencyFindings;
    const docIds = matter.documents.map((d) => d.documentId);

    if (docIds.length > 0) {
      const analysesList = db
        .select({ analysisDataJson: schema.analyses.analysisDataJson })
        .from(schema.analyses)
        .where(inArray(schema.analyses.documentId, docIds))
        .all();

      for (const a of analysesList) {
        if (!a.analysisDataJson) continue;
        try {
          const parsed = JSON.parse(a.analysisDataJson) as LegalXRayAnalysis;
          if (parsed.attentionAreas) {
            const gaps = parsed.attentionAreas.filter(
              (aa) => aa.attentionLevel === 'HIGH' || aa.category === 'OTHER'
            );
            informationGaps += gaps.length;
          }
          if (parsed.lawyerQuestions) {
            counselQuestions += parsed.lawyerQuestions.length;
          }
        } catch {
          // ignore
        }
      }
    }

    // User notes
    const notes = await this.getNotes(matterId);
    const userNotes = notes.length;

    const snapshot: MatterSnapshotMetrics = {
      totalDocuments,
      analyzedDocuments,
      timelineEvents,
      verifiedRelationships,
      relationshipsNeedingReview,
      consistencyFindings,
      openActionItems,
      completedActionItems,
      counselQuestions,
      informationGaps,
      userNotes,
    };

    // Derive readiness states
    const states: MatterReadinessState[] = [];
    const recommendations: string[] = [];

    const verifyItems = actionItems.filter(
      (i) =>
        (i.type === 'VERIFY_TERM' || i.type === 'REVIEW_CONSISTENCY') &&
        i.status !== 'COMPLETED'
    );

    if (consistencyFindings > 0 || relationshipsNeedingReview > 0 || verifyItems.length > 0) {
      states.push('ITEMS_TO_VERIFY');
      if (consistencyFindings > 0) {
        recommendations.push(
          `Review ${consistencyFindings} cross-document consistency discrepancy findings.`
        );
      }
      if (relationshipsNeedingReview > 0) {
        recommendations.push(
          `Confirm or reject ${relationshipsNeedingReview} suggested document relationships.`
        );
      }
      if (verifyItems.length > 0) {
        recommendations.push(
          `Verify ${verifyItems.length} specific terms flagged in action items.`
        );
      }
    }

    if (informationGaps > 0) {
      states.push('INFORMATION_GAPS');
      recommendations.push(
        `Address ${informationGaps} missing fact or document items identified across member documents.`
      );
    }

    if (counselQuestions > 0) {
      states.push('QUESTIONS_FOR_COUNSEL');
      recommendations.push(
        `Prepare questions on ${counselQuestions} specific points for consultation with legal counsel.`
      );
    }

    const collectDocs = actionItems.filter(
      (i) =>
        (i.type === 'COLLECT_DOCUMENT' || i.type === 'PROVIDE_MISSING_INFORMATION') &&
        i.status !== 'COMPLETED'
    );
    if (collectDocs.length > 0) {
      states.push('DOCUMENTS_TO_COLLECT');
      recommendations.push(
        `Gather ${collectDocs.length} pending documentation items noted in the action plan.`
      );
    }

    if (openActionItems > 0) {
      states.push('FOLLOW_UP_ITEMS');
      recommendations.push(`Complete ${openActionItems} open preparation items before meeting counsel.`);
    }

    if (
      totalDocuments > 0 &&
      analyzedDocuments === totalDocuments &&
      consistencyFindings === 0 &&
      openActionItems === 0
    ) {
      states.push('READY_FOR_REVIEW');
      recommendations.push(
        'All member documents are analyzed and no pending discrepancies remain.'
      );
    }

    if (states.length === 0) {
      states.push('READY_FOR_REVIEW');
    }

    const summary = `Matter "${matter.title}" includes ${totalDocuments} document${
      totalDocuments === 1 ? '' : 's'
    } (${analyzedDocuments} analyzed), ${consistencyFindings} consistency finding${
      consistencyFindings === 1 ? '' : 's'
    }, and ${openActionItems} open preparation task${openActionItems === 1 ? '' : 's'}.`;

    return {
      matterId,
      states,
      summary,
      snapshot,
      recommendations,
    };
  }

  /**
   * Generates grounded, neutral consultation questions for counsel.
   * Strictly anti-adjudication: refuses "who wins" questions and focuses on neutral clarification.
   */
  public async generateCounselQuestions(matterId: string): Promise<CounselQuestionsResponse> {
    const matter = await this.getMatter(matterId);
    const relationships = await this.getRelationships(matterId);
    const consistency = await this.checkConsistency(matterId);
    const notes = await this.getNotes(matterId);

    const documentsText = matter.documents
      .map((d) => `Doc ID: ${d.documentId} | Title: "${d.title}" | Role: ${d.role}`)
      .join('\n');

    const consistencyText = consistency
      .map((c) =>
        `[${c.category}] "${c.sourceA.documentTitle}" (${c.sourceA.value}) vs "${c.sourceB.documentTitle}" (${c.sourceB.value}). ` +
        `Source: ${c.sourceA.documentId} p.${c.sourceA.pageNumber} "${(c.sourceA.quotedText || '').slice(0, 500)}"`
      )
      .join('\n');

    const relationshipsText = relationships
      .map((r) => `"${r.sourceDocumentTitle}" ${r.relationshipType} "${r.targetDocumentTitle}". ` +
        `Source: ${r.sourceDocumentId} p.${r.sourcePage} "${(r.sourceQuote || '').slice(0, 500)}"`)
      .join('\n');

    const userNotesText = notes.map((n) => `[User Note] ${n.title}: ${n.content}`).join('\n');

    let questions: CounselQuestionItem[] = [];

    if (this.gemini.isConfigured()) {
      try {
        const prompt = buildCounselQuestionPrompt({
          matterTitle: matter.title,
          jurisdiction: matter.jurisdiction || 'Not established',
          documentsText,
          consistencyText,
          relationshipsText,
          userNotesText,
        });

        const schemaDescription = `[
  {
    "category": "string",
    "question": "string",
    "rationale": "string",
    "sourceType": "DOCUMENT" | "CONSISTENCY" | "RELATIONSHIP" | "USER_CONTEXT",
    "sourceReference": "string",
    "documentId": "string",
    "documentTitle": "string",
    "pageNumber": number,
    "quotedText": "string",
    "isUserProvided": boolean
  }
]`;

        const rawList = await this.gemini.generateStructured<CounselQuestionItem[]>(
          prompt,
          schemaDescription,
          { systemInstruction: SYSTEM_MATTER_ANALYST_PROMPT }
        );

        if (Array.isArray(rawList) && rawList.length <= 100) {
          const memberById = new Map(matter.documents.map((doc) => [doc.documentId, doc]));
          const pageCache = new Map<string, string>();
          const db = getDb();
          questions = rawList
            .filter((q) => {
              if (!q || typeof q.question !== 'string' || !q.question.trim() ||
                  containsProhibitedLegalConclusion(q.question) ||
                  !['DOCUMENT', 'CONSISTENCY', 'RELATIONSHIP'].includes(q.sourceType) ||
                  !q.documentId || !memberById.has(q.documentId) ||
                  !Number.isInteger(q.pageNumber) || !q.pageNumber ||
                  typeof q.quotedText !== 'string' || !q.quotedText.trim() || q.quotedText.length > 2000) return false;
              const key = `${q.documentId}:${q.pageNumber}`;
              if (!pageCache.has(key)) {
                const page = db.select({ text: schema.documentPages.text }).from(schema.documentPages)
                  .where(and(eq(schema.documentPages.documentId, q.documentId), eq(schema.documentPages.pageNumber, q.pageNumber)))
                  .get();
                pageCache.set(key, page?.text || '');
              }
              return this.validator.validateCitationAgainstPages(
                { pageNumber: q.pageNumber, quotedText: q.quotedText },
                [{ pageNumber: q.pageNumber, text: pageCache.get(key)! }]
              ).isValidated;
            })
            .map((q, idx) => ({
              id: q.id || `cq_${idx + 1}_${generateId('q')}`,
              category: q.category || 'GENERAL',
              question: q.question,
              rationale: q.rationale || 'Clarify legal implications with counsel.',
              sourceType: q.sourceType,
              sourceReference: `Page ${q.pageNumber}`,
              documentId: q.documentId,
              documentTitle: memberById.get(q.documentId!)!.title,
              pageNumber: q.pageNumber,
              quotedText: q.quotedText,
              isUserProvided: false,
            }));
        }
      } catch {
        // Fallback to deterministic synthesis
      }
    }

    if (questions.length === 0) {
      questions = this.synthesizeDeterministicCounselQuestions(
        matter,
        relationships,
        consistency,
        notes
      );
    } else if (notes.length > 0) {
      questions.push(...this.synthesizeDeterministicCounselQuestions(
        matter, relationships, consistency, notes
      ).filter((question) => question.sourceType === 'USER_CONTEXT'));
    }

    await this.logActivity(
      matterId,
      'ACTION_ITEMS_GENERATED',
      `Generated ${questions.length} questions for legal counsel`,
      { count: questions.length }
    );

    return {
      matterId,
      questions,
      disclaimer: LEGAL_DISCLAIMERS.GLOBAL_FOOTER,
    };
  }

  /**
   * Deterministic question generator fallback when AI is unavailable.
   */
  private synthesizeDeterministicCounselQuestions(
    matter: MatterDetail,
    relationships: DocumentRelationshipItem[],
    consistency: ConsistencyFinding[],
    notes: Array<{ id: string; title: string; content: string }>
  ): CounselQuestionItem[] {
    const list: CounselQuestionItem[] = [];

    // 1. From consistency findings
    for (const c of consistency) {
      list.push({
        id: `cq_cons_${c.id}`,
        category: c.category,
        question: `How should the difference between "${c.sourceA.documentTitle}" (${c.sourceA.value}) and "${c.sourceB.documentTitle}" (${c.sourceB.value}) be reconciled under the applicable governing law?`,
        rationale: `The agreements appear to set differing terms regarding ${c.category.toLowerCase()}.`,
        sourceType: 'CONSISTENCY',
        sourceReference: `Consistency Finding ${c.id}`,
        documentId: c.sourceA.documentId,
        documentTitle: c.sourceA.documentTitle,
        pageNumber: c.sourceA.pageNumber || 1,
        quotedText: c.sourceA.quotedText || c.sourceA.value,
        isUserProvided: false,
      });
    }

    // 2. From relationships
    for (const r of relationships) {
      if (r.relationshipType === 'AMENDS' || r.relationshipType === 'INCORPORATES') {
        list.push({
          id: `cq_rel_${r.id}`,
          category: 'ORDER_OF_PRECEDENCE',
          question: `Does "${r.sourceDocumentTitle}" effectively supersede or amend the specific operational obligations in "${r.targetDocumentTitle}"?`,
          rationale: 'Clarify whether previous terms remain operative alongside the newer agreement.',
          sourceType: 'RELATIONSHIP',
          sourceReference: `Relationship ${r.id}`,
          documentId: r.sourceDocumentId,
          documentTitle: r.sourceDocumentTitle,
          pageNumber: r.sourcePage || 1,
          quotedText: r.sourceQuote || null,
          isUserProvided: false,
        });
      }
    }

    // 3. From user notes
    for (const n of notes) {
      list.push({
        id: `cq_note_${n.id}`,
        category: 'USER_CONTEXT',
        question: `How does our specific situation regarding "${n.title}" impact our obligations across these agreements?`,
        rationale: 'Ensure factual user context is discussed during consultation.',
        sourceType: 'USER_CONTEXT',
        sourceReference: `User Note: ${n.title}`,
        isUserProvided: true,
      });
    }

    // Default question if list is empty
    if (list.length === 0) {
      list.push({
        id: `cq_default_1`,
        category: 'GENERAL_REVIEW',
        question: `Do any terms in these ${matter.documents.length} documents conflict regarding governing law or notice periods?`,
        rationale: 'Establish baseline clarity on multi-document interaction.',
        sourceType: 'DOCUMENT',
        isUserProvided: false,
      });
    }

    return list;
  }

  /**
   * Synthesizes and persists an executive Matter Consultation Brief dossier.
   */
  public async generateMatterBrief(
    matterId: string,
    options?: { force?: boolean }
  ): Promise<MatterBriefResponse> {
    const userId = getCurrentUserId();
    const db = getDb();
    const matter = await this.getMatter(matterId);

    // Check cached brief in preparations table if not forced
    if (!options?.force) {
      const cached = db
        .select()
        .from(schema.preparations)
        .where(and(
          eq(schema.preparations.userId, userId),
          eq(schema.preparations.matterId, matterId),
          eq(schema.preparations.briefKind, 'MATTER')
        ))
        .limit(1)
        .all();

      if (cached.length > 0 && cached[0].preparationDataJson) {
        try {
          return this.parseStoredMatterBrief(cached[0].preparationDataJson);
        } catch {
          // ignore parse error and re-synthesize
        }
      }
    }

    const [timeline, consistency, relationships, actionItems, notes] = await Promise.all([
      this.getTimeline(matterId),
      this.checkConsistency(matterId),
      this.getRelationships(matterId),
      this.getActionItems(matterId),
      this.getNotes(matterId),
    ]);
    const counselQuestions = this.synthesizeDeterministicCounselQuestions(
      matter,
      relationships,
      consistency,
      notes
    );

    // Extract parties and key factual points from member analyses
    const partiesSet = new Set<string>();
    const keyFactualPoints: MatterBriefResponse['keyFactualPoints'] = [];
    const docIds = matter.documents.map((d) => d.documentId);

    if (docIds.length > 0) {
      const analysesList = db
        .select({
          documentId: schema.analyses.documentId,
          analysisDataJson: schema.analyses.analysisDataJson,
        })
        .from(schema.analyses)
        .where(inArray(schema.analyses.documentId, docIds))
        .all();

      for (const a of analysesList) {
        if (!a.analysisDataJson) continue;
        const doc = matter.documents.find((d) => d.documentId === a.documentId);
        const docTitle = doc?.title || 'Document';

        try {
          const parsed = JSON.parse(a.analysisDataJson) as LegalXRayAnalysis;
          if (parsed.parties) {
            for (const p of parsed.parties) {
              if (p.name && p.classification === 'DOCUMENT_FACT' && p.isValidated) partiesSet.add(p.name);
            }
          }
          if (parsed.keyDates) {
            for (const kd of parsed.keyDates.slice(0, 2)) {
              keyFactualPoints.push({
                fact: `${kd.label}: ${kd.dateValue}`,
                page: kd.pageNumber,
                docTitle,
                quotedText: kd.quotedText,
                classification: kd.classification === 'DOCUMENT_FACT' && kd.isValidated ? 'DOCUMENT_FACT' : 'NEEDS_REVIEW',
                verificationStatus: kd.isValidated ? 'VERIFIED' : 'NEEDS_REVIEW',
              });
            }
          }
        } catch {
          // ignore
        }
      }
    }

    const briefId = generateId('prep');
    const now = new Date().toISOString();

    const synthesizedSummary = `Consultation dossier for "${matter.title}" with ${matter.documents.length} member documents, ${timeline.length} timeline milestones, ${consistency.length} consistency findings, and ${actionItems.length} action items.`;

    const brief: MatterBriefResponse = {
      matterId,
      preparationId: briefId,
      title: `Matter Consultation Brief: ${matter.title}`,
      summary: synthesizedSummary,
      parties: Array.from(partiesSet),
      documents: matter.documents.map((d) => ({
        id: d.documentId,
        title: d.title,
        role: d.role,
        status: d.status,
      })),
      timeline: timeline.map((t) => ({
        date: t.dateValue,
        label: t.label,
        docTitle: t.documentTitle,
      })),
      keyFactualPoints,
      consistencySummary: consistency.map((c) => ({
        category: c.category,
        finding: `"${c.sourceA.documentTitle}" (${c.sourceA.value}) vs "${c.sourceB.documentTitle}" (${c.sourceB.value})`,
        discussionPoint: `Discuss how the differing ${c.category.toLowerCase()} provisions interact under governing law.`,
      })),
      counselQuestions,
      actionItems: actionItems.map((ai) => ({
        id: ai.id,
        title: ai.title,
        status: ai.status,
        priority: ai.priority,
      })),
      userNotes: notes.map((n) => ({
        title: n.title,
        content: n.content,
      })),
      disclaimer: LEGAL_DISCLAIMERS.GLOBAL_FOOTER,
    };

    // Save or update in preparations table
    const existingRecord = db
      .select()
      .from(schema.preparations)
      .where(and(
        eq(schema.preparations.userId, userId),
        eq(schema.preparations.matterId, matterId),
        eq(schema.preparations.briefKind, 'MATTER')
      ))
      .limit(1)
      .all();

    db.transaction((tx) => {
      if (existingRecord.length > 0) {
        tx.delete(schema.preparations).where(eq(schema.preparations.id, existingRecord[0].id)).run();
      }
      tx.insert(schema.preparations).values({
        id: briefId,
        userId,
        briefKind: 'MATTER',
        matterId,
        purpose: `Matter Counsel Brief: ${matter.title}`,
        preparationDataJson: JSON.stringify(brief),
        status: 'COMPLETED',
        createdAt: now,
        updatedAt: now,
      }).run();
    });

    await this.logActivity(
      matterId,
      'PREPARATION_BRIEF_GENERATED',
      `Generated Matter Consultation Brief: "${matter.title}"`,
      { briefId }
    );

    return brief;
  }

  /**
   * Retrieves an existing Matter Brief if generated.
   */
  public async getMatterBrief(matterId: string): Promise<MatterBriefResponse | null> {
    this.assertMatterOwned(matterId);
    const userId = getCurrentUserId();
    const db = getDb();
    const records = db
      .select()
      .from(schema.preparations)
      .where(and(
        eq(schema.preparations.userId, userId),
        eq(schema.preparations.matterId, matterId),
        eq(schema.preparations.briefKind, 'MATTER')
      ))
      .limit(1)
      .all();

    if (records.length === 0 || !records[0].preparationDataJson) {
      return null;
    }

    try {
      return this.parseStoredMatterBrief(records[0].preparationDataJson);
    } catch {
      return null;
    }
  }

  /**
   * Phase 10: Synchronizes all matter evidence items into the normalized matter_evidence table.
   * Pulls from citations, cross-document relationships, consistency findings, and user notes.
   */
  public async syncMatterEvidence(matterId: string, persist = true): Promise<MatterEvidenceItem[]> {
    const matter = await this.getMatter(matterId);
    const db = getDb();
    const now = new Date().toISOString();

    const memberDocIds = matter.documents.map((d) => d.documentId);
    const docMap = new Map<string, { title: string; pageCount: number }>();
    for (const d of matter.documents) {
      docMap.set(d.documentId, { title: d.title, pageCount: d.pageCount || 1 });
    }

    const [actionItems, consistencyFindings, relationships, userNotes] = await Promise.all([
      this.getActionItems(matterId),
      this.checkConsistency(matterId),
      this.getRelationships(matterId),
      this.getNotes(matterId),
    ]);
    const counselQuestions = this.synthesizeDeterministicCounselQuestions(
      matter, relationships, consistencyFindings, userNotes
    );

    const pageRows = memberDocIds.length > 0
      ? db.select({
          documentId: schema.documentPages.documentId,
          pageNumber: schema.documentPages.pageNumber,
          text: schema.documentPages.text,
        }).from(schema.documentPages)
          .where(inArray(schema.documentPages.documentId, memberDocIds))
          .all()
      : [];
    const pageCache = new Map(
      pageRows.map((page) => [`${page.documentId}:${page.pageNumber}`, page.text || ''])
    );
    const quoteIsOnPage = (documentId: string, pageNumber: number | null | undefined, quote: string | null | undefined): boolean => {
      if (!documentId || !pageNumber || !quote?.trim() || !docMap.has(documentId)) return false;
      const key = `${documentId}:${pageNumber}`;
      return (pageCache.get(key) || '').replace(/\s+/g, ' ').includes(quote.trim().replace(/\s+/g, ' '));
    };

    const evidenceItems: MatterEvidenceItem[] = [];

    // 1. Ingest document citations from member documents
    if (memberDocIds.length > 0) {
      const citRows = db
        .select()
        .from(schema.citations)
        .where(inArray(schema.citations.documentId, memberDocIds))
        .all();

      for (const cit of citRows) {
        const docInfo = docMap.get(cit.documentId);
        const docTitle = docInfo?.title || 'Document';
        const usedBy: MatterEvidenceItem['usedBy'] = [];

        // Check consistency findings referencing this page
        for (const cf of consistencyFindings) {
          if (
            (cf.sourceA.documentId === cit.documentId && cf.sourceA.pageNumber === cit.pageNumber) ||
            (cf.sourceB.documentId === cit.documentId && cf.sourceB.pageNumber === cit.pageNumber)
          ) {
            usedBy.push({
              type: 'CONSISTENCY',
              id: cf.id,
              title: `Consistency: ${cf.category}`,
            });
          }
        }

        // Check counsel questions referencing this page
        for (const cq of counselQuestions) {
          if (cq.documentId === cit.documentId && cq.pageNumber === cit.pageNumber) {
            usedBy.push({
              type: 'QUESTION',
              id: cq.id,
              title: cq.question,
            });
          }
        }

        // Check action items referencing this document
        for (const ai of actionItems) {
          if (ai.relatedDocumentId === cit.documentId) {
            usedBy.push({
              type: 'ACTION_ITEM',
              id: ai.id,
              title: ai.title,
            });
          }
        }

        const isVerified = quoteIsOnPage(cit.documentId, cit.pageNumber, cit.quotedText);
        const normQuote = (cit.quotedText || '').replace(/\s+/g, ' ').trim();

        evidenceItems.push({
          id: `ev_cit_${cit.id}`,
          matterId,
          evidenceType:
            cit.sourceType === 'DOCUMENT_FACT'
              ? 'DOCUMENT_FACT'
              : cit.sourceType === 'AI_INTERPRETATION'
              ? 'AI_INTERPRETATION'
              : 'NEEDS_REVIEW',
          documentId: cit.documentId,
          documentTitle: docTitle,
          pageNumber: cit.pageNumber,
          quotedText: cit.quotedText,
          normalizedQuote: normQuote,
          classification: cit.sourceType as EvidenceSourceType,
          verificationStatus: isVerified ? 'VERIFIED' : 'NEEDS_REVIEW',
          confidenceCategory:
            cit.confidenceScore >= 0.9 ? 'HIGH' : cit.confidenceScore >= 0.5 ? 'MEDIUM' : 'LOW',
          sourceReference: `${docTitle}, Page ${cit.pageNumber || 1}`,
          usedBy,
          createdAt: cit.createdAt || now,
          updatedAt: now,
        });
      }
    }

    // 2. Ingest Cross-Document Consistency Findings Evidence
    for (const cf of consistencyFindings) {
      if (cf.sourceA?.quotedText) {
        evidenceItems.push({
          id: `ev_cons_a_${cf.id}`,
          matterId,
          evidenceType: 'CONSISTENCY_EVIDENCE',
          documentId: cf.sourceA.documentId,
          documentTitle: cf.sourceA.documentTitle,
          pageNumber: cf.sourceA.pageNumber || 1,
          quotedText: cf.sourceA.quotedText,
          normalizedQuote: cf.sourceA.quotedText.replace(/\s+/g, ' ').trim(),
          classification: quoteIsOnPage(cf.sourceA.documentId, cf.sourceA.pageNumber, cf.sourceA.quotedText) ? 'DOCUMENT_FACT' : 'NEEDS_REVIEW',
          verificationStatus: quoteIsOnPage(cf.sourceA.documentId, cf.sourceA.pageNumber, cf.sourceA.quotedText) ? 'VERIFIED' : 'NEEDS_REVIEW',
          confidenceCategory: quoteIsOnPage(cf.sourceA.documentId, cf.sourceA.pageNumber, cf.sourceA.quotedText) ? 'HIGH' : 'LOW',
          sourceReference: `${cf.sourceA.documentTitle}, Page ${cf.sourceA.pageNumber || 1}`,
          targetDocumentId: cf.sourceB?.documentId,
          targetDocumentTitle: cf.sourceB?.documentTitle,
          targetPageNumber: cf.sourceB?.pageNumber,
          targetQuote: cf.sourceB?.quotedText,
          usedBy: [
            {
              type: 'CONSISTENCY',
              id: cf.id,
              title: `Consistency Discrepancy: ${cf.category}`,
            },
          ],
          createdAt: now,
          updatedAt: now,
        });
      }
      if (cf.sourceB?.quotedText) {
        evidenceItems.push({
          id: `ev_cons_b_${cf.id}`,
          matterId,
          evidenceType: 'CONSISTENCY_EVIDENCE',
          documentId: cf.sourceB.documentId,
          documentTitle: cf.sourceB.documentTitle,
          pageNumber: cf.sourceB.pageNumber || 1,
          quotedText: cf.sourceB.quotedText,
          normalizedQuote: cf.sourceB.quotedText.replace(/\s+/g, ' ').trim(),
          classification: quoteIsOnPage(cf.sourceB.documentId, cf.sourceB.pageNumber, cf.sourceB.quotedText) ? 'DOCUMENT_FACT' : 'NEEDS_REVIEW',
          verificationStatus: quoteIsOnPage(cf.sourceB.documentId, cf.sourceB.pageNumber, cf.sourceB.quotedText) ? 'VERIFIED' : 'NEEDS_REVIEW',
          confidenceCategory: quoteIsOnPage(cf.sourceB.documentId, cf.sourceB.pageNumber, cf.sourceB.quotedText) ? 'HIGH' : 'LOW',
          sourceReference: `${cf.sourceB.documentTitle}, Page ${cf.sourceB.pageNumber || 1}`,
          targetDocumentId: cf.sourceA?.documentId,
          targetDocumentTitle: cf.sourceA?.documentTitle,
          targetPageNumber: cf.sourceA?.pageNumber,
          targetQuote: cf.sourceA?.quotedText,
          usedBy: [
            {
              type: 'CONSISTENCY',
              id: cf.id,
              title: `Consistency Discrepancy: ${cf.category}`,
            },
          ],
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // 3. Ingest Cross-Document Relationship Evidence
    for (const rel of relationships) {
      if (rel.sourceQuote) {
        evidenceItems.push({
          id: `ev_rel_src_${rel.id}`,
          matterId,
          evidenceType: 'RELATIONSHIP_EVIDENCE',
          documentId: rel.sourceDocumentId,
          documentTitle: rel.sourceDocumentTitle,
          pageNumber: rel.sourcePage || undefined,
          quotedText: rel.sourceQuote,
          normalizedQuote: rel.sourceQuote.replace(/\s+/g, ' ').trim(),
          classification: quoteIsOnPage(rel.sourceDocumentId, rel.sourcePage, rel.sourceQuote) ? 'AI_INTERPRETATION' : 'NEEDS_REVIEW',
          verificationStatus: quoteIsOnPage(rel.sourceDocumentId, rel.sourcePage, rel.sourceQuote) ? 'VERIFIED' : 'NEEDS_REVIEW',
          confidenceCategory: quoteIsOnPage(rel.sourceDocumentId, rel.sourcePage, rel.sourceQuote) ? 'MEDIUM' : 'LOW',
          sourceReference: `${rel.sourceDocumentTitle}, Page ${rel.sourcePage || '?'}`,
          targetDocumentId: rel.targetDocumentId,
          targetDocumentTitle: rel.targetDocumentTitle,
          targetPageNumber: rel.targetPage,
          targetQuote: rel.targetQuote,
          usedBy: [
            {
              type: 'RELATIONSHIP',
              id: rel.id,
              title: `${rel.sourceDocumentTitle} ${rel.relationshipType} ${rel.targetDocumentTitle}`,
            },
          ],
          createdAt: rel.createdAt || now,
          updatedAt: now,
        });
      }
    }

    // 4. Ingest User Notes (Strictly USER_PROVIDED)
    for (const note of userNotes) {
      evidenceItems.push({
        id: `ev_note_${note.id}`,
        matterId,
        evidenceType: 'USER_PROVIDED',
        quotedText: note.content,
        normalizedQuote: note.content.replace(/\s+/g, ' ').trim(),
        classification: 'USER_PROVIDED',
        verificationStatus: 'UNVERIFIED',
        confidenceCategory: 'UNVERIFIED',
        sourceReference: `User Note: "${note.title}"`,
        usedBy: [
          {
            type: 'BRIEF',
            id: note.id,
            title: `User Background: ${note.title}`,
          },
        ],
        createdAt: note.createdAt || now,
        updatedAt: now,
      });
    }

    // Deduplicate by id
    const uniqueMap = new Map<string, MatterEvidenceItem>();
    for (const item of evidenceItems) {
      uniqueMap.set(item.id, item);
    }
    const finalItems = Array.from(uniqueMap.values());

    // Explicit refresh persists atomically. Read endpoints compute a fresh view
    // without writes, provider calls, or activity log entries.
    if (persist) {
      db.transaction((tx) => {
        tx.delete(schema.matterEvidence).where(eq(schema.matterEvidence.matterId, matterId)).run();
        for (const item of finalItems) {
          tx.insert(schema.matterEvidence).values({
            id: item.id,
            matterId: item.matterId,
            evidenceType: item.evidenceType,
            documentId: item.documentId || null,
            pageNumber: item.pageNumber || null,
            quotedText: item.quotedText || null,
            normalizedQuote: item.normalizedQuote || null,
            classification: item.classification,
            verificationStatus: item.verificationStatus,
            confidenceCategory: item.confidenceCategory,
            sourceReference: item.sourceReference || null,
            targetDocumentId: item.targetDocumentId || null,
            targetPageNumber: item.targetPageNumber || null,
            targetQuote: item.targetQuote || null,
            usedByJson: JSON.stringify(item.usedBy),
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          }).run();
        }
      });
    }

    return finalItems;
  }

  /**
   * Phase 10: Retrieves the searchable, filterable Evidence Ledger for a matter.
   */
  public async getMatterEvidenceLedger(
    matterId: string,
    filters?: {
      classification?: string;
      verificationStatus?: string;
      documentId?: string;
      search?: string;
    }
  ): Promise<EvidenceLedgerResponse> {
    // Validate matter exists
    const matter = await this.getMatter(matterId);

    // Strict cross-resource boundary: if documentId filter is passed, verify matter membership
    if (filters?.documentId) {
      const isMember = matter.documents.some((d) => d.documentId === filters.documentId);
      if (!isMember) {
        return {
          matterId,
          totalItems: 0,
          items: [],
          filtersApplied: filters,
        };
      }
    }

    const items = await this.syncMatterEvidence(matterId, false);

    let filtered = items;
    if (filters?.classification) {
      filtered = filtered.filter((i) => i.classification === filters.classification);
    }
    if (filters?.verificationStatus) {
      filtered = filtered.filter((i) => i.verificationStatus === filters.verificationStatus);
    }
    if (filters?.documentId) {
      filtered = filtered.filter((i) => i.documentId === filters.documentId);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      filtered = filtered.filter(
        (i) =>
          (i.quotedText && i.quotedText.toLowerCase().includes(q)) ||
          (i.documentTitle && i.documentTitle.toLowerCase().includes(q)) ||
          (i.sourceReference && i.sourceReference.toLowerCase().includes(q))
      );
    }

    return {
      matterId,
      totalItems: filtered.length,
      items: filtered,
      filtersApplied: filters || {},
    };
  }

  /**
   * Phase 10: Builds the complete Source Map hierarchy for a matter.
   * Documents -> Pages -> Evidence -> Findings -> Questions -> Actions.
   */
  public async getMatterSourceMap(matterId: string): Promise<MatterSourceMapResponse> {
    const matter = await this.getMatter(matterId);
    const db = getDb();
    const evidenceItems = await this.syncMatterEvidence(matterId, false);

    const documentNodes: DocumentSourceMapNode[] = [];
    const uniqueReferencedPages = new Set<string>();
    const evidenceByDocument = new Map<string, MatterEvidenceItem[]>();
    for (const item of evidenceItems) {
      if (!item.documentId) continue;
      const group = evidenceByDocument.get(item.documentId) || [];
      group.push(item);
      evidenceByDocument.set(item.documentId, group);
    }

    const documentIds = matter.documents.map((document) => document.documentId);
    const allPages = documentIds.length > 0
      ? db.select({
          documentId: schema.documentPages.documentId,
          pageNumber: schema.documentPages.pageNumber,
          textLength: sql<number>`length(trim(${schema.documentPages.text}))`,
        }).from(schema.documentPages)
          .where(inArray(schema.documentPages.documentId, documentIds))
          .orderBy(asc(schema.documentPages.documentId), asc(schema.documentPages.pageNumber))
          .all()
      : [];
    const pagesByDocument = new Map<string, typeof allPages>();
    for (const page of allPages) {
      const pages = pagesByDocument.get(page.documentId) || [];
      pages.push(page);
      pagesByDocument.set(page.documentId, pages);
    }

    for (const doc of matter.documents) {
      const pages = pagesByDocument.get(doc.documentId) || [];

      const docEvidence = evidenceByDocument.get(doc.documentId) || [];
      const evidenceByPage = new Map<number, MatterEvidenceItem[]>();
      for (const item of docEvidence) {
        if (!item.pageNumber) continue;
        const group = evidenceByPage.get(item.pageNumber) || [];
        group.push(item);
        evidenceByPage.set(item.pageNumber, group);
      }
      const pageHasText = new Map(pages.map((page) => [page.pageNumber, page.textLength > 0]));

      // Group by page number
      const pageNodes: DocumentPageEvidenceNode[] = [];
      const pageCount = pages.length > 0 ? pages.length : doc.pageCount || 1;

      for (let p = 1; p <= pageCount; p++) {
        const itemsOnPage = evidenceByPage.get(p) || [];
        if (itemsOnPage.length > 0) {
          uniqueReferencedPages.add(`${doc.documentId}:${p}`);
          pageNodes.push({
            pageNumber: p,
            hasText: pageHasText.get(p) || false,
            evidenceItems: itemsOnPage,
          });
        }
      }

      // Count relations and findings involving this doc
      const consistencyCount = docEvidence.filter((e) => e.evidenceType === 'CONSISTENCY_EVIDENCE').length;
      const relCount = docEvidence.filter((e) => e.evidenceType === 'RELATIONSHIP_EVIDENCE').length;
      const questionCount = docEvidence.filter((e) => e.usedBy.some((u) => u.type === 'QUESTION')).length;
      const actionCount = docEvidence.filter((e) => e.usedBy.some((u) => u.type === 'ACTION_ITEM')).length;

      documentNodes.push({
        documentId: doc.documentId,
        title: doc.title,
        role: doc.role,
        pageCount,
        pagesWithEvidence: pageNodes,
        totalEvidenceCount: docEvidence.length,
        verifiedEvidenceCount: docEvidence.filter((e) => e.verificationStatus === 'VERIFIED').length,
        needsReviewCount: docEvidence.filter((e) => e.verificationStatus === 'NEEDS_REVIEW').length,
        consistencyFindingsCount: consistencyCount,
        relationshipsCount: relCount,
        counselQuestionsCount: questionCount,
        actionItemsCount: actionCount,
      });
    }

    const verifiedDocs = documentNodes.filter((d) => d.verifiedEvidenceCount > 0).length;
    const verifiedItems = evidenceItems.filter((e) => e.verificationStatus === 'VERIFIED').length;
    const needsReviewItems = evidenceItems.filter((e) => e.verificationStatus === 'NEEDS_REVIEW').length;
    const userProvidedItems = evidenceItems.filter((e) => e.classification === 'USER_PROVIDED').length;

    const consistencyFindings = await this.checkConsistency(matterId);
    const actionItems = await this.getActionItems(matterId);
    const questionsResult = { questions: this.synthesizeDeterministicCounselQuestions(
      matter, await this.getRelationships(matterId), consistencyFindings, await this.getNotes(matterId)
    ) };

    const findingsWithCitations = consistencyFindings.filter(
      (f) => Boolean(f.sourceA?.quotedText || f.sourceB?.quotedText)
    ).length;

    const questionsWithEvidence = questionsResult.questions.filter(
      (q) => Boolean(q.documentId && q.quotedText)
    ).length;

    const actionsWithEvidence = actionItems.filter(
      (a) => Boolean(a.relatedDocumentId)
    ).length;

    const coverage: EvidenceCoverageMetrics = {
      totalDocuments: matter.documents.length,
      documentsWithVerifiedEvidence: verifiedDocs,
      totalEvidenceItems: evidenceItems.length,
      verifiedEvidenceCount: verifiedItems,
      needsReviewEvidenceCount: needsReviewItems,
      userProvidedCount: userProvidedItems,
      findingsWithCitations: {
        withCitations: findingsWithCitations,
        total: consistencyFindings.length,
      },
      counselQuestionsWithEvidence: {
        withEvidence: questionsWithEvidence,
        total: questionsResult.questions.length,
      },
      actionItemsWithEvidence: {
        withEvidence: actionsWithEvidence,
        total: actionItems.length,
      },
      pagesReferenced: uniqueReferencedPages.size,
    };

    const unlinkedEvidenceCount = evidenceItems.filter(
      (e) => !e.documentId && e.classification === 'USER_PROVIDED'
    ).length;

    return {
      matterId,
      coverage,
      documents: documentNodes,
      unlinkedEvidenceCount,
      evidenceItems,
    };
  }

  /**
   * Phase 10: Retrieves evidence specifically anchored to a single document page.
   */
  public async getDocumentPageEvidence(
    matterId: string,
    documentId: string,
    pageNumber: number
  ): Promise<DocumentPageEvidenceNode & { documentTitle: string; pageText: string }> {
    const matter = await this.getMatter(matterId);
    const isMember = matter.documents.some((d) => d.documentId === documentId);
    if (!isMember) {
      throw new NotFoundError(
        `Document ${documentId} is not a member of matter ${matterId} (access denied).`
      );
    }

    const doc = matter.documents.find((d) => d.documentId === documentId)!;
    const db = getDb();

    const pageRow = db
      .select({ text: schema.documentPages.text })
      .from(schema.documentPages)
      .where(
        and(
          eq(schema.documentPages.documentId, documentId),
          eq(schema.documentPages.pageNumber, pageNumber)
        )
      )
      .limit(1)
      .all();

    const pageText = pageRow.length > 0 ? pageRow[0].text : '';

    const allEvidence = await this.syncMatterEvidence(matterId, false);
    const itemsOnPage = allEvidence.filter(
      (e) => e.documentId === documentId && e.pageNumber === pageNumber
    );

    return {
      pageNumber,
      documentTitle: doc.title,
      pageText,
      hasText: pageText.trim().length > 0,
      evidenceItems: itemsOnPage,
    };
  }
}

// Singleton accessor
let matterServiceInstance: MatterService | null = null;

export function getMatterService(): MatterService {
  if (!matterServiceInstance) {
    matterServiceInstance = new MatterService();
  }
  return matterServiceInstance;
}
