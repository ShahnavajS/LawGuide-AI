import { getDb, schema } from '@/lib/db';
import { getDocumentService, DocumentService } from '@/lib/document/service';
import { getAnalysisService, AnalysisService } from '@/lib/analysis/service';
import { geminiService, GeminiService } from '@/lib/ai/gemini';
import { citationValidator, CitationValidator } from '@/lib/evidence/validator';
import {
  MatterDetail,
  MatterMemberDocument,
  MatterOverviewMetrics,
  ConsistencyFinding,
  LegalXRayAnalysis,
  MatterActivityItem,
  MatterBriefResponse,
} from '@/lib/ai/schemas';
import { MatterDocumentRole, MatterActivityType } from '@/lib/ai/safety';
import { generateId } from '@/lib/utils/id';
import { NotFoundError, ValidationError } from '@/lib/utils/errors';
import { eq, and, inArray, sql, desc, asc } from 'drizzle-orm';
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

export abstract class MatterCoreService {
  protected documentService: DocumentService;
  protected analysisService: AnalysisService;
  protected gemini: GeminiService;
  protected validator: CitationValidator;

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

  protected parseStoredMatterBrief(raw: string): MatterBriefResponse {
    return parseStoredArtifact<MatterBriefResponse>(raw, {
      strings: ['matterId', 'preparationId', 'title', 'summary', 'disclaimer'],
      arrays: ['parties', 'documents', 'timeline', 'keyFactualPoints', 'consistencySummary', 'counselQuestions', 'actionItems', 'userNotes'],
    });
  }

  protected assertMatterOwned(matterId: string): void {
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
  public abstract checkConsistency(matterId: string): Promise<ConsistencyFinding[]>;
}
