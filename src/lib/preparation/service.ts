/**
 * Preparation Service Layer (LexiGuide AI Phase 6).
 *
 * Coordinates evidence synthesis from Legal X-Ray and Semantic Comparisons,
 * applies anti-fabrication citation verification, deduplicates questions for counsel,
 * structures actionable preparation checklists, and persists consultation briefs.
 */

import { getDb, schema } from '@/lib/db';
import { parseModelOutput, parseStoredArtifact } from '@/lib/ai/validate-output';
import { preparationModelSchema, preparationProviderSchema } from '@/lib/ai/runtime-schemas';
import { getDocumentService, DocumentService } from '@/lib/document/service';
import { getAnalysisService, AnalysisService } from '@/lib/analysis/service';
import { getComparisonService, ComparisonService } from '@/lib/comparison/service';
import { geminiService, GeminiService } from '@/lib/ai/gemini';
import { citationValidator, CitationValidator } from '@/lib/evidence/validator';
import {
  PreparationBrief,
  PreparationLawyerQuestion,
  PreparationChecklistItem,
  PreparationDocumentToBring,
  PreparationTimelineEvent,
  PreparationMissingInfoItem,
  PreparationUserNote,
  PreparationKeyFact,
  PreparationDocumentInfo,
  LegalXRayAnalysis,
  ComparisonResult,
} from '@/lib/ai/schemas';
import {
  SYSTEM_PREPARATION_ANALYST_PROMPT,
  buildPreparationPrompt,
} from '@/lib/ai/prompts';
import { LEGAL_DISCLAIMERS } from '@/lib/ai/safety';
import { generateId } from '@/lib/utils/id';
import { AppError, NotFoundError, ValidationError } from '@/lib/utils/errors';
import { eq, and, isNull } from 'drizzle-orm';
import { getCurrentUserId } from '@/lib/auth/context';

export interface GeneratePreparationInput {
  documentId?: string;
  comparisonId?: string;
  matterId?: string;
  purpose?: string;
  userNotes?: string[];
  force?: boolean;
}

interface RawPreparationOutput {
  overview?: {
    title?: string;
    documentType?: string;
    governingLaw?: string;
    purpose?: string;
    consultationDate?: string;
  };
  keyFacts?: Array<{
    id?: string;
    label: string;
    value: string;
    pageNumber?: number;
    quotedText?: string;
    documentId?: string;
  }>;
  keyDates?: Array<{
    id?: string;
    label: string;
    dateValue: string;
    description: string;
    pageNumber?: number;
    quotedText?: string;
    documentId?: string;
  }>;
  missingInformation?: Array<{
    id?: string;
    item: string;
    whyItMatters: string;
  }>;
  documentsToBring?: Array<{
    id?: string;
    documentName: string;
    reason: string;
    isGeneralSuggestion?: boolean;
  }>;
  lawyerQuestions?: Array<{
    id?: string;
    category?: string;
    question: string;
    whyItMatters?: string;
    groundedContext?: string;
    pageNumber?: number;
    quotedText?: string;
  }>;
  checklist?: Array<{
    id?: string;
    category: 'BEFORE_CONSULTATION' | 'FOR_THE_LAWYER' | 'AFTER_CONSULTATION';
    item: string;
    whyRelevant: string;
    isCompleted?: boolean;
  }>;
}

export class PreparationService {
  private documentService: DocumentService;
  private analysisService: AnalysisService;
  private comparisonService: ComparisonService;
  private gemini: GeminiService;
  private validator: CitationValidator;

  constructor(
    customDocService?: DocumentService,
    customAnalysisService?: AnalysisService,
    customComparisonService?: ComparisonService,
    customGemini?: GeminiService,
    customValidator?: CitationValidator
  ) {
    this.documentService = customDocService || getDocumentService();
    this.analysisService = customAnalysisService || getAnalysisService();
    this.comparisonService = customComparisonService || getComparisonService();
    this.gemini = customGemini || geminiService;
    this.validator = customValidator || citationValidator;
  }

  private parseStoredPreparation(raw: string): PreparationBrief {
    return parseStoredArtifact<PreparationBrief>(raw, {
      strings: ['id', 'purpose', 'createdAt', 'updatedAt', 'disclaimer', 'status'],
      objects: ['overview', 'validationSummary'],
      arrays: [
        'documentsUnderReview', 'keyFacts', 'keyDates', 'financialTerms', 'obligations',
        'rights', 'attentionAreas', 'lawyerQuestions', 'missingInformation',
        'documentsToBring', 'checklist', 'userNotes',
      ],
    });
  }

  private assertMatterSources(matterId: string, documentId?: string, comparisonId?: string): string[] {
    const userId = getCurrentUserId();
    const db = getDb();
    if (!db.select({ id: schema.matters.id }).from(schema.matters).where(and(
      eq(schema.matters.id, matterId),
      eq(schema.matters.userId, userId)
    )).get()) {
      throw new NotFoundError('Matter');
    }
    const memberIds = db.select({ documentId: schema.matterDocuments.documentId })
      .from(schema.matterDocuments)
      .innerJoin(schema.documents, eq(schema.documents.id, schema.matterDocuments.documentId))
      .where(and(
        eq(schema.matterDocuments.matterId, matterId),
        eq(schema.documents.userId, userId)
      ))
      .all().map((row) => row.documentId);
    if (documentId && !memberIds.includes(documentId)) {
      throw new ValidationError('Selected document must belong to this matter.');
    }
    if (comparisonId) {
      const comparison = db.select({
        baseDocumentId: schema.comparisons.baseDocumentId,
        targetDocumentId: schema.comparisons.targetDocumentId,
      }).from(schema.comparisons).where(and(
        eq(schema.comparisons.id, comparisonId),
        eq(schema.comparisons.userId, userId)
      )).get();
      if (!comparison || !memberIds.includes(comparison.baseDocumentId) || !memberIds.includes(comparison.targetDocumentId)) {
        throw new ValidationError('Selected comparison must use documents in this matter.');
      }
    }
    return memberIds;
  }

  /**
   * Retrieves an existing preparation brief by its unique ID.
   */
  public async getPreparation(preparationId: string): Promise<PreparationBrief | null> {
    if (!preparationId || typeof preparationId !== 'string') {
      throw new ValidationError('Preparation ID is required.');
    }

    const userId = getCurrentUserId();
    const db = getDb();
    const [record] = await db
      .select()
      .from(schema.preparations)
      .where(and(
        eq(schema.preparations.id, preparationId),
        eq(schema.preparations.userId, userId),
        eq(schema.preparations.briefKind, 'PREPARATION')
      ))
      .limit(1);

    if (!record || record.status !== 'COMPLETED' || !record.preparationDataJson) {
      return null;
    }

    try {
      const brief = this.parseStoredPreparation(record.preparationDataJson);

      // Apply checklist states from checklistStateJson if present
      if (record.checklistStateJson) {
        const stateMap: Record<string, boolean> = JSON.parse(record.checklistStateJson);
        brief.checklist = brief.checklist.map((item) => ({
          ...item,
          isCompleted: stateMap[item.id] ?? item.isCompleted,
        }));
      }

      return brief;
    } catch {
      return null;
    }
  }

  /**
   * Retrieves a cached preparation brief by documentId or comparisonId.
   */
  public async getPreparationBySource(
    documentId?: string,
    comparisonId?: string,
    matterId?: string
  ): Promise<PreparationBrief | null> {
    if (!documentId && !comparisonId && !matterId) {
      throw new ValidationError('At least one of documentId, comparisonId, or matterId is required.');
    }
    if (matterId) {
      this.assertMatterSources(matterId, documentId, comparisonId);
    } else {
      if (documentId) await this.documentService.getDocumentById(documentId);
      if (comparisonId && !(await this.comparisonService.getComparison(comparisonId))) {
        throw new NotFoundError('Comparison');
      }
    }

    const userId = getCurrentUserId();
    const db = getDb();
    let query;

    if (matterId) {
      query = db
        .select()
        .from(schema.preparations)
        .where(and(
          eq(schema.preparations.userId, userId),
          eq(schema.preparations.matterId, matterId),
          eq(schema.preparations.briefKind, 'PREPARATION')
        ))
        .limit(1);
    } else if (documentId && comparisonId) {
      query = db
        .select()
        .from(schema.preparations)
        .where(
          and(
            eq(schema.preparations.userId, userId),
            eq(schema.preparations.documentId, documentId),
            eq(schema.preparations.comparisonId, comparisonId),
            isNull(schema.preparations.matterId),
            eq(schema.preparations.briefKind, 'PREPARATION')
          )
        )
        .limit(1);
    } else if (comparisonId) {
      query = db
        .select()
        .from(schema.preparations)
        .where(and(
          eq(schema.preparations.userId, userId),
          eq(schema.preparations.comparisonId, comparisonId),
          isNull(schema.preparations.matterId),
          eq(schema.preparations.briefKind, 'PREPARATION')
        ))
        .limit(1);
    } else {
      query = db
        .select()
        .from(schema.preparations)
        .where(and(
          eq(schema.preparations.userId, userId),
          eq(schema.preparations.documentId, documentId!),
          isNull(schema.preparations.matterId),
          eq(schema.preparations.briefKind, 'PREPARATION')
        ))
        .limit(1);
    }

    const [record] = await query;
    if (!record || record.status !== 'COMPLETED' || !record.preparationDataJson) {
      return null;
    }

    try {
      const brief = this.parseStoredPreparation(record.preparationDataJson);
      if (record.checklistStateJson) {
        const stateMap: Record<string, boolean> = JSON.parse(record.checklistStateJson);
        brief.checklist = brief.checklist.map((item) => ({
          ...item,
          isCompleted: stateMap[item.id] ?? item.isCompleted,
        }));
      }
      return brief;
    } catch {
      return null;
    }
  }

  /**
   * Generates or retrieves an executive Lawyer Consultation Brief.
   */
  public async generatePreparation(input: GeneratePreparationInput): Promise<PreparationBrief> {
    const userId = getCurrentUserId();
    const { documentId, comparisonId, matterId, purpose, userNotes = [], force = false } = input;

    if (!documentId && !comparisonId && !matterId) {
      throw new ValidationError('At least one of documentId, comparisonId, or matterId is required.');
    }
    const memberIds = matterId ? this.assertMatterSources(matterId, documentId, comparisonId) : [];

    // 1. Check idempotency cache if not forced
    if (!force) {
      const cached = await this.getPreparationBySource(matterId ? undefined : documentId, matterId ? undefined : comparisonId, matterId);
      if (cached) {
        return cached;
      }
    }

    // 2. Load and validate sources
    let primaryAnalysis: LegalXRayAnalysis | null = null;
    let comparisonResult: ComparisonResult | null = null;
    const documentsUnderReview: PreparationDocumentInfo[] = [];

    let targetDocId = documentId;

    if (matterId && !targetDocId) {
      if (memberIds.length > 0) {
        targetDocId = memberIds[0];
      }
    }

    if (comparisonId) {
      comparisonResult = await this.comparisonService.getComparison(comparisonId);
      if (!comparisonResult || comparisonResult.status !== 'COMPLETED') {
        throw new AppError(
          'The selected comparison is not completed or does not exist.',
          400,
          'COMPARISON_NOT_READY'
        );
      }

      // Fetch base and target documents metadata
      const [baseDoc, compTargetDoc] = await Promise.all([
        this.documentService.getDocumentById(comparisonResult.baseDocumentId),
        this.documentService.getDocumentById(comparisonResult.targetDocumentId),
      ]);

      if (baseDoc) {
        documentsUnderReview.push({
          documentId: baseDoc.id,
          title: baseDoc.title,
          pageCount: baseDoc.pageCount || 1,
          role: 'BASE',
        });
      }
      if (compTargetDoc) {
        documentsUnderReview.push({
          documentId: compTargetDoc.id,
          title: compTargetDoc.title,
          pageCount: compTargetDoc.pageCount || 1,
          role: 'REVISED',
        });
      }

      targetDocId = targetDocId || comparisonResult.targetDocumentId;
    }

    if (targetDocId) {
      const doc = await this.documentService.getDocumentById(targetDocId);
      if (!doc) {
        throw new NotFoundError('Document');
      }
      if (doc.status !== 'READY') {
        throw new AppError(
          `Document "${doc.title}" is not ready for preparation. It must finish processing first.`,
          400,
          'DOCUMENT_NOT_READY'
        );
      }

      primaryAnalysis = await this.analysisService.getAnalysis(targetDocId);
      if (!primaryAnalysis) {
        throw new AppError(
          `Document "${doc.title}" has not been analyzed yet. Please run Legal X-Ray analysis first.`,
          400,
          'DOCUMENT_NOT_ANALYZED'
        );
      }

      if (!comparisonId) {
        documentsUnderReview.push({
          documentId: doc.id,
          title: doc.title,
          pageCount: doc.pageCount || 1,
          role: 'PRIMARY',
        });
      }
    }

    // 3. Collect page text for citation validation
    const pagesMap: Record<string, Array<{ pageNumber: number; text: string }>> = {};
    for (const d of documentsUnderReview) {
      const pages = await this.documentService.getDocumentPages(d.documentId);
      pagesMap[d.documentId] = pages.map((p) => ({ pageNumber: p.pageNumber, text: p.text }));
    }

    // 4. Generate structured synthesis
    let rawOutput: RawPreparationOutput;
    const sanitizedPurpose = (purpose || '').trim() || 'General consultation preparation and document review.';

    if (this.gemini.isConfigured()) {
      const prompt = buildPreparationPrompt(
        JSON.stringify(primaryAnalysis || {}),
        comparisonResult ? JSON.stringify(comparisonResult) : null,
        sanitizedPurpose,
        userNotes
      );

      const userPrompt = `
Synthesize the provided verified document findings, version changes (if present), and user consultation purpose into a structured Lawyer Consultation Brief.
Adhere strictly to all legal safety and grounding directives.

Respond strictly in valid JSON matching this schema:
{
  "overview": {
    "title": "Clear brief title (e.g. Consultation Brief: Executive Employment Agreement)",
    "documentType": "Document category",
    "governingLaw": "Explicit governing law or 'Governing law was not identified in the provided materials.'",
    "purpose": "User consultation purpose",
    "consultationDate": "Scheduled date or 'To be scheduled'"
  },
  "keyFacts": [
    { "label": "Fact label (e.g. Parties, Effective Term)", "value": "Stated fact", "pageNumber": 1, "quotedText": "verbatim quote" }
  ],
  "keyDates": [
    { "label": "Milestone label", "dateValue": "Specific date or notice window", "description": "What happens", "pageNumber": 1, "quotedText": "verbatim quote" }
  ],
  "missingInformation": [
    { "item": "Missing piece of information", "whyItMatters": "Why this matters for counsel" }
  ],
  "documentsToBring": [
    { "documentName": "Specific document to bring", "reason": "Why needed", "isGeneralSuggestion": false }
  ],
  "lawyerQuestions": [
    { "category": "Topic", "question": "Sharp question for attorney", "whyItMatters": "Why this matters", "groundedContext": "Clause or section reference", "pageNumber": 1, "quotedText": "verbatim quote" }
  ],
  "checklist": [
    { "category": "BEFORE_CONSULTATION|FOR_THE_LAWYER|AFTER_CONSULTATION", "item": "Actionable task", "whyRelevant": "Why needed" }
  ]
}

DATA TO SYNTHESIZE:
${prompt}
`.trim();

      try {
        rawOutput = await this.gemini.generateStructured<RawPreparationOutput>(
          userPrompt,
          'RawPreparationOutput',
          {
            systemInstruction: SYSTEM_PREPARATION_ANALYST_PROMPT,
            responseJsonSchema: preparationProviderSchema,
          }
        );
        rawOutput = parseModelOutput(preparationModelSchema, rawOutput);
      } catch {
        rawOutput = this.buildOfflinePreparation(
          documentsUnderReview,
          primaryAnalysis,
          comparisonResult,
          sanitizedPurpose,
          userNotes
        );
      }
    } else {
      rawOutput = this.buildOfflinePreparation(
        documentsUnderReview,
        primaryAnalysis,
        comparisonResult,
        sanitizedPurpose,
        userNotes
      );
    }

    // 5. Anti-Fabrication Citation Validation
    let totalCitations = 0;
    let validatedCount = 0;
    let unverifiedCount = 0;

    const validatedCitationsToInsert: Array<{
      id: string;
      documentId: string;
      pageNumber: number;
      quotedText: string;
      sourceType: 'DOCUMENT_FACT' | 'AI_INTERPRETATION' | 'GENERAL_INFO' | 'NEEDS_REVIEW' | 'USER_PROVIDED';
      confidenceScore: number;
    }> = [];

    const defaultDocId = documentsUnderReview[0]?.documentId || '';

    // Validate key facts
    const processedKeyFacts: PreparationKeyFact[] = (rawOutput.keyFacts || []).map((fact, idx) => {
      const factDocId = fact.documentId || defaultDocId;
      const pages = pagesMap[factDocId] || [];

      let isValidated = false;
      let classification: 'DOCUMENT_FACT' | 'NEEDS_REVIEW' = 'NEEDS_REVIEW';

      if (fact.quotedText && fact.pageNumber) {
        totalCitations++;
        const val = this.validator.validateCitationAgainstPages(
          { pageNumber: fact.pageNumber, quotedText: fact.quotedText },
          pages
        );
        isValidated = val.isValidated;
        const reconciled = this.validator.reconcileClassification('DOCUMENT_FACT', val);
        classification = reconciled.reconciledType as 'DOCUMENT_FACT' | 'NEEDS_REVIEW';

        if (isValidated) {
          validatedCount++;
          validatedCitationsToInsert.push({
            id: generateId('cit'),
            documentId: factDocId,
            pageNumber: fact.pageNumber,
            quotedText: fact.quotedText,
            sourceType: classification,
            confidenceScore: val.matchConfidence,
          });
        } else {
          unverifiedCount++;
        }
      }

      return {
        id: fact.id || `fact_${idx + 1}`,
        label: fact.label,
        value: fact.value,
        pageNumber: fact.pageNumber,
        quotedText: fact.quotedText,
        documentId: factDocId,
        classification,
        isValidated,
      };
    });

    // Validate timeline dates
    const processedKeyDates: PreparationTimelineEvent[] = (rawOutput.keyDates || []).map((dt, idx) => {
      const dateDocId = dt.documentId || defaultDocId;
      const pages = pagesMap[dateDocId] || [];

      let isValidated = false;
      let classification: 'DOCUMENT_FACT' | 'NEEDS_REVIEW' = 'NEEDS_REVIEW';

      if (dt.quotedText && dt.pageNumber) {
        totalCitations++;
        const val = this.validator.validateCitationAgainstPages(
          { pageNumber: dt.pageNumber, quotedText: dt.quotedText },
          pages
        );
        isValidated = val.isValidated;
        const reconciled = this.validator.reconcileClassification('DOCUMENT_FACT', val);
        classification = reconciled.reconciledType as 'DOCUMENT_FACT' | 'NEEDS_REVIEW';

        if (isValidated) {
          validatedCount++;
          validatedCitationsToInsert.push({
            id: generateId('cit'),
            documentId: dateDocId,
            pageNumber: dt.pageNumber,
            quotedText: dt.quotedText,
            sourceType: classification,
            confidenceScore: val.matchConfidence,
          });
        } else {
          unverifiedCount++;
        }
      }

      return {
        id: dt.id || `date_${idx + 1}`,
        label: dt.label,
        dateValue: dt.dateValue,
        description: dt.description,
        pageNumber: dt.pageNumber,
        quotedText: dt.quotedText,
        documentId: dateDocId,
        documentTitle: documentsUnderReview.find((d) => d.documentId === dateDocId)?.title,
        classification,
        isValidated,
      };
    });

    // 6. Deduplicate & Synthesize Lawyer Questions
    const questionSeen = new Set<string>();
    const lawyerQuestions: PreparationLawyerQuestion[] = [];

    const addQuestion = (q: PreparationLawyerQuestion) => {
      const normalized = q.question.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!normalized || questionSeen.has(normalized)) return;
      questionSeen.add(normalized);
      lawyerQuestions.push(q);
    };

    // Add generated questions
    for (const rawQ of rawOutput.lawyerQuestions || []) {
      addQuestion({
        id: rawQ.id || `q_${lawyerQuestions.length + 1}`,
        category: rawQ.category || 'General',
        question: rawQ.question,
        whyItMatters: rawQ.whyItMatters,
        groundedContext: rawQ.groundedContext,
        pageNumber: rawQ.pageNumber,
        quotedText: rawQ.quotedText,
      });
    }

    // Include Legal X-Ray lawyer questions if not already covered
    if (primaryAnalysis?.lawyerQuestions) {
      for (const lxQ of primaryAnalysis.lawyerQuestions) {
        addQuestion({
          id: `lxq_${lawyerQuestions.length + 1}`,
          category: lxQ.category,
          question: lxQ.question,
          groundedContext: lxQ.groundedContext,
        });
      }
    }

    // Include Comparison questions if available
    if (comparisonResult?.lawyerQuestions) {
      for (const cq of comparisonResult.lawyerQuestions) {
        addQuestion({
          id: `cq_${lawyerQuestions.length + 1}`,
          category: cq.category,
          question: cq.question,
          groundedContext: cq.groundedContext,
        });
      }
    }

    // 7. Structured Actionable Checklist
    const checklist: PreparationChecklistItem[] = (rawOutput.checklist || []).map((item, idx) => ({
      id: item.id || `chk_${idx + 1}`,
      category: item.category || 'BEFORE_CONSULTATION',
      item: item.item,
      whyRelevant: item.whyRelevant || '',
      isCompleted: false,
    }));

    // 8. Documents to Bring
    const documentsToBring: PreparationDocumentToBring[] = (rawOutput.documentsToBring || []).map(
      (docItem, idx) => ({
        id: docItem.id || `dtb_${idx + 1}`,
        documentName: docItem.documentName,
        reason: docItem.reason,
        isGeneralSuggestion: docItem.isGeneralSuggestion ?? false,
      })
    );

    // 9. Missing Information
    const missingInformation: PreparationMissingInfoItem[] = (rawOutput.missingInformation || []).map(
      (m, idx) => ({
        id: m.id || `missing_${idx + 1}`,
        item: m.item,
        whyItMatters: m.whyItMatters,
      })
    );

    // 10. User Notes
    const userNotesList: PreparationUserNote[] = userNotes.map((note, idx) => ({
      id: `un_${idx + 1}`,
      note,
      createdAt: new Date().toISOString(),
      classification: 'USER_PROVIDED',
    }));

    // 11. Assemble Preparation Brief
    const preparationId = generateId('prep');
    const now = new Date().toISOString();

    const overviewTitle =
      rawOutput.overview?.title ||
      (documentsUnderReview.length > 1
        ? `Consultation Brief: ${documentsUnderReview[0]?.title} vs ${documentsUnderReview[1]?.title}`
        : `Consultation Brief: ${documentsUnderReview[0]?.title || 'Document'}`);

    const finalBrief: PreparationBrief = {
      id: preparationId,
      documentId: targetDocId,
      comparisonId,
      matterId,
      purpose: sanitizedPurpose,
      overview: {
        title: overviewTitle,
        documentType: rawOutput.overview?.documentType || primaryAnalysis?.overview.documentType || 'Legal Agreement',
        governingLaw:
          rawOutput.overview?.governingLaw ||
          primaryAnalysis?.overview.governingLaw ||
          'Governing law was not identified in the provided materials.',
        purpose: sanitizedPurpose,
        consultationDate: rawOutput.overview?.consultationDate || 'To be scheduled with counsel',
      },
      documentsUnderReview,
      keyFacts: processedKeyFacts,
      keyDates: processedKeyDates,
      financialTerms: primaryAnalysis?.financialTerms || [],
      obligations: primaryAnalysis?.obligations || [],
      rights: primaryAnalysis?.rights || [],
      attentionAreas: primaryAnalysis?.attentionAreas || [],
      versionChanges: comparisonResult?.differences || undefined,
      lawyerQuestions,
      missingInformation,
      documentsToBring,
      checklist,
      userNotes: userNotesList,
      validationSummary: {
        totalCitations,
        validatedCount,
        unverifiedCount,
      },
      createdAt: now,
      updatedAt: now,
      disclaimer: LEGAL_DISCLAIMERS.GLOBAL_FOOTER,
      status: 'COMPLETED',
    };

    // 12. Persist in Database
    const db = getDb();

    // Keep the previous completed brief if inserting its replacement fails.
    db.transaction((tx) => {
      const sourceFilter = matterId
        ? eq(schema.preparations.matterId, matterId)
        : targetDocId && comparisonId
          ? and(eq(schema.preparations.documentId, targetDocId), eq(schema.preparations.comparisonId, comparisonId), isNull(schema.preparations.matterId))
          : comparisonId
            ? and(eq(schema.preparations.comparisonId, comparisonId), isNull(schema.preparations.matterId))
            : and(eq(schema.preparations.documentId, targetDocId!), isNull(schema.preparations.matterId));
      const existingPreps = tx.select({ id: schema.preparations.id })
        .from(schema.preparations)
        .where(and(
          eq(schema.preparations.userId, userId),
          sourceFilter,
          eq(schema.preparations.briefKind, 'PREPARATION')
        ))
        .all();
      for (const prep of existingPreps) {
        tx.delete(schema.citations).where(eq(schema.citations.preparationId, prep.id)).run();
        tx.delete(schema.preparations).where(eq(schema.preparations.id, prep.id)).run();
      }
      tx.insert(schema.preparations).values({
        id: preparationId,
        userId,
        briefKind: 'PREPARATION',
        documentId: targetDocId || null,
        comparisonId: comparisonId || null,
        matterId: matterId || null,
        purpose: sanitizedPurpose,
        userNotesJson: JSON.stringify(userNotesList),
        checklistStateJson: JSON.stringify({}),
        preparationDataJson: JSON.stringify(finalBrief),
        status: 'COMPLETED',
        createdAt: now,
        updatedAt: now,
      }).run();
      if (validatedCitationsToInsert.length > 0) {
        tx.insert(schema.citations).values(validatedCitationsToInsert.map((c) => ({
          id: c.id,
          documentId: c.documentId,
          preparationId,
          sourceType: c.sourceType,
          pageNumber: c.pageNumber,
          quotedText: c.quotedText,
          confidenceScore: c.confidenceScore,
          createdAt: now,
        }))).run();
      }
    });

    return finalBrief;
  }

  /**
   * Updates checkbox status for an actionable checklist item without mutating evidence.
   */
  public async updateChecklistState(
    preparationId: string,
    itemId: string,
    isCompleted: boolean
  ): Promise<Record<string, boolean>> {
    if (!preparationId || !itemId) {
      throw new ValidationError('Preparation ID and Item ID are required.');
    }

    const userId = getCurrentUserId();
    const db = getDb();
    const [record] = await db
      .select()
      .from(schema.preparations)
      .where(and(
        eq(schema.preparations.id, preparationId),
        eq(schema.preparations.userId, userId),
        eq(schema.preparations.briefKind, 'PREPARATION')
      ))
      .limit(1);

    if (!record) {
      throw new NotFoundError('Preparation brief');
    }

    let stateMap: Record<string, boolean> = {};
    if (record.checklistStateJson) {
      try {
        stateMap = JSON.parse(record.checklistStateJson);
      } catch {
        stateMap = {};
      }
    }

    stateMap[itemId] = isCompleted;

    await db
      .update(schema.preparations)
      .set({
        checklistStateJson: JSON.stringify(stateMap),
        updatedAt: new Date().toISOString(),
      })
      .where(and(
        eq(schema.preparations.id, preparationId),
        eq(schema.preparations.userId, userId),
        eq(schema.preparations.briefKind, 'PREPARATION')
      ));

    return stateMap;
  }

  /**
   * Deterministic offline preparation generator (used when offline or in tests).
   */
  private buildOfflinePreparation(
    docs: PreparationDocumentInfo[],
    analysis: LegalXRayAnalysis | null,
    comparison: ComparisonResult | null,
    purpose: string,
    userNotes: string[]
  ): RawPreparationOutput {
    const primaryDoc = docs[0];
    const docTitle = primaryDoc?.title || 'Legal Document';

    const keyFacts: RawPreparationOutput['keyFacts'] = [];
    if (analysis?.parties && analysis.parties.length > 0) {
      for (const p of analysis.parties) {
        keyFacts.push({
          id: `fact_${p.id}`,
          label: p.role,
          value: p.name,
          pageNumber: p.pageNumber,
          quotedText: p.quotedText,
          documentId: primaryDoc?.documentId,
        });
      }
    }
    if (keyFacts.length === 0 && analysis?.materialClauses?.length) {
      for (const clause of analysis.materialClauses.slice(0, 3)) {
        keyFacts.push({
          id: `fact_${clause.id}`,
          label: `Source excerpt, Page ${clause.pageNumber}`,
          value: clause.quotedText,
          pageNumber: clause.pageNumber,
          quotedText: clause.quotedText,
          documentId: primaryDoc?.documentId,
        });
      }
    }

    const keyDates: RawPreparationOutput['keyDates'] = [];
    if (analysis?.keyDates && analysis.keyDates.length > 0) {
      for (const d of analysis.keyDates) {
        keyDates.push({
          id: `date_${d.id}`,
          label: d.label,
          dateValue: d.dateValue,
          description: d.description,
          pageNumber: d.pageNumber,
          quotedText: d.quotedText,
          documentId: primaryDoc?.documentId,
        });
      }
    }

    const missingInformation: RawPreparationOutput['missingInformation'] = [
      {
        id: 'missing_1',
        item: 'Exact date of agreement execution and signatures',
        whyItMatters: 'Confirms whether terms are currently in legal effect or pending closing.',
      },
      {
        id: 'missing_2',
        item: 'Any ancillary exhibits, schedules, or side letters referenced in text',
        whyItMatters: 'Ensures the full contractual commitment is reviewed by counsel.',
      },
    ];

    const documentsToBring: RawPreparationOutput['documentsToBring'] = [
      {
        id: 'dtb_1',
        documentName: `Current Agreement (${docTitle})`,
        reason: 'Primary subject matter of legal consultation.',
        isGeneralSuggestion: false,
      },
      {
        id: 'dtb_2',
        documentName: 'Prior versions, drafts, or redlines',
        reason: 'Assists counsel in assessing historical intent and negotiated concessions.',
        isGeneralSuggestion: docs.length > 1 ? false : true,
      },
      {
        id: 'dtb_3',
        documentName: 'Relevant email correspondence or written notices',
        reason: 'Establishes factual timeline and context of negotiations.',
        isGeneralSuggestion: true,
      },
    ];

    const lawyerQuestions: RawPreparationOutput['lawyerQuestions'] = [];
    if (analysis?.lawyerQuestions) {
      for (const q of analysis.lawyerQuestions) {
        lawyerQuestions.push({
          id: `q_${q.id}`,
          category: q.category,
          question: q.question,
          whyItMatters: 'Key clarification identified from document terms.',
          groundedContext: q.groundedContext,
        });
      }
    }

    // Incorporate user-submitted concerns if formatted as questions
    if (userNotes && userNotes.length > 0) {
      for (const [idx, note] of userNotes.entries()) {
        if (note.includes('?')) {
          lawyerQuestions.push({
            id: `user_q_${idx + 1}`,
            category: 'Client Inquiries',
            question: note,
            whyItMatters: 'Direct inquiry raised by user for counsel review.',
          });
        }
      }
    }

    const checklist: RawPreparationOutput['checklist'] = [
      {
        id: 'chk_1',
        category: 'BEFORE_CONSULTATION',
        item: 'Review highlighted Attention Areas and critical terms in dossier',
        whyRelevant: 'Ensures you understand high-priority clauses before the meeting.',
      },
      {
        id: 'chk_2',
        category: 'BEFORE_CONSULTATION',
        item: 'Gather referenced attachments, policies, and prior versions',
        whyRelevant: 'Prevents meeting delay by having supporting documents ready.',
      },
      {
        id: 'chk_3',
        category: 'FOR_THE_LAWYER',
        item: 'Present stated purpose: "' + purpose.slice(0, 60) + (purpose.length > 60 ? '...' : '') + '"',
        whyRelevant: 'Focuses counsel on your primary objective and questions.',
      },
      {
        id: 'chk_4',
        category: 'FOR_THE_LAWYER',
        item: 'Review prioritized questions list with attorney',
        whyRelevant: 'Maximizes consultation efficiency and covers critical ambiguities.',
      },
      {
        id: 'chk_5',
        category: 'AFTER_CONSULTATION',
        item: 'Document legal advice and action items agreed upon with counsel',
        whyRelevant: 'Creates an audit trail and tracks follow-up obligations.',
      },
    ];

    return {
      overview: {
        title: `Consultation Brief: ${docTitle}`,
        documentType: analysis?.overview.documentType || 'Legal Agreement',
        governingLaw: analysis?.overview.governingLaw || 'Governing law was not identified in the provided materials.',
        purpose,
        consultationDate: 'To be scheduled with counsel',
      },
      keyFacts,
      keyDates,
      missingInformation,
      documentsToBring,
      lawyerQuestions,
      checklist,
    };
  }
}

let preparationServiceInstance: PreparationService | null = null;

export function getPreparationService(): PreparationService {
  if (typeof window !== 'undefined') {
    throw new Error('FATAL: Attempted to access PreparationService from browser bundle.');
  }

  if (!preparationServiceInstance) {
    preparationServiceInstance = new PreparationService();
  }
  return preparationServiceInstance;
}
