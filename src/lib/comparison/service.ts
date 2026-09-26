/**
 * Semantic Document Comparison Service Layer (LexiGuide AI Phase 5).
 *
 * Coordinates clause alignment, Gemini structured semantic diffing, dual-citation validation,
 * anti-fabrication reconciliation, and database persistence.
 */

import { getDb, schema } from '@/lib/db';
import { parseModelOutput, parseStoredArtifact } from '@/lib/ai/validate-output';
import { comparisonModelSchema, comparisonProviderSchema } from '@/lib/ai/runtime-schemas';
import { getCurrentUserId } from '@/lib/auth/context';
import { getDocumentService, DocumentService } from '@/lib/document/service';
import { geminiService, GeminiService } from '@/lib/ai/gemini';
import { citationValidator, CitationValidator } from '@/lib/evidence/validator';
import {
  ComparisonResult,
  ComparisonDifferenceItem,
  ComparisonStatistics,
  ComparisonLawyerQuestion,
  AttentionCategory,
  AttentionLevel,
  ComparisonChangeType,
} from '@/lib/ai/schemas';
import {
  SYSTEM_COMPARISON_ANALYST_PROMPT,
  buildDualDocumentComparisonPrompt,
} from '@/lib/ai/prompts';
import { LEGAL_DISCLAIMERS, EvidenceSourceType } from '@/lib/ai/safety';
import { generateId } from '@/lib/utils/id';
import { AppError, NotFoundError, ValidationError } from '@/lib/utils/errors';
import { eq, and } from 'drizzle-orm';
import {
  extractClausesFromPages,
  alignAndCompareClauses,
} from './alignment';

interface RawComparisonOutput {
  summary?: {
    plainLanguage?: string;
    baseGoverningLaw?: string;
    targetGoverningLaw?: string;
  };
  differences?: Array<{
    id?: string;
    type: ComparisonChangeType;
    category?: AttentionCategory;
    title: string;
    sectionReference?: string;
    baseEvidence?: {
      pageNumber: number;
      quotedText: string;
      sectionReference?: string;
    };
    targetEvidence?: {
      pageNumber: number;
      quotedText: string;
      sectionReference?: string;
    };
    changeSummary: string;
    semanticChanges?: Array<{
      field: string;
      before: string;
      after: string;
      description: string;
    }>;
    practicalImplications: string;
    attentionLevel?: AttentionLevel;
    lawyerQuestion?: string;
    isSubstantive?: boolean;
  }>;
  lawyerQuestions?: Array<{
    id?: string;
    category?: string;
    question: string;
    groundedContext: string;
  }>;
}

export class ComparisonService {
  private documentService: DocumentService;
  private gemini: GeminiService;
  private validator: CitationValidator;

  constructor(
    customDocService?: DocumentService,
    customGemini?: GeminiService,
    customValidator?: CitationValidator
  ) {
    this.documentService = customDocService || getDocumentService();
    this.gemini = customGemini || geminiService;
    this.validator = customValidator || citationValidator;
  }

  private parseStoredComparison(raw: string): ComparisonResult {
    return parseStoredArtifact<ComparisonResult>(raw, {
      strings: ['id', 'baseDocumentId', 'targetDocumentId', 'comparedAt', 'disclaimer', 'status'],
      objects: ['summary', 'statistics', 'validationSummary'],
      arrays: ['differences', 'lawyerQuestions'],
    });
  }

  /**
   * Retrieves an existing comparison by its unique ID.
   */
  public async getComparison(comparisonId: string): Promise<ComparisonResult | null> {
    const userId = getCurrentUserId();
    if (!comparisonId || typeof comparisonId !== 'string') {
      throw new ValidationError('Comparison ID is required.');
    }

    const db = getDb();
    const [record] = await db
      .select()
      .from(schema.comparisons)
      .where(and(eq(schema.comparisons.id, comparisonId), eq(schema.comparisons.userId, userId)))
      .limit(1);

    if (!record || record.status !== 'COMPLETED' || !record.comparisonDataJson) {
      return null;
    }

    try {
      return this.parseStoredComparison(record.comparisonDataJson);
    } catch {
      return null;
    }
  }

  /**
   * Retrieves an existing comparison for a specific Base and Target document pair (order-sensitive).
   */
  public async getComparisonByDocumentPair(
    baseDocId: string,
    targetDocId: string
  ): Promise<ComparisonResult | null> {
    const userId = getCurrentUserId();
    if (!baseDocId || !targetDocId) {
      throw new ValidationError('Both base and target document IDs are required.');
    }

    const db = getDb();
    const [record] = await db
      .select()
      .from(schema.comparisons)
      .where(
        and(
          eq(schema.comparisons.baseDocumentId, baseDocId),
          eq(schema.comparisons.targetDocumentId, targetDocId),
          eq(schema.comparisons.userId, userId)
        )
      )
      .limit(1);

    if (!record || record.status !== 'COMPLETED' || !record.comparisonDataJson) {
      return null;
    }

    try {
      return this.parseStoredComparison(record.comparisonDataJson);
    } catch {
      return null;
    }
  }

  /**
   * Compares an original Base document against a revised Target document.
   * Enforces document readiness, Base/Target order preservation, anti-fabrication dual validation,
   * idempotency caching, and persistence.
   */
  public async compareDocuments(
    baseDocId: string,
    targetDocId: string,
    options?: { force?: boolean }
  ): Promise<ComparisonResult> {
    const userId = getCurrentUserId();
    // 1. Validate IDs
    if (!baseDocId || typeof baseDocId !== 'string') {
      throw new ValidationError('Base document ID is required.');
    }
    if (!targetDocId || typeof targetDocId !== 'string') {
      throw new ValidationError('Target document ID is required.');
    }
    if (baseDocId === targetDocId) {
      throw new ValidationError('Cannot compare a document to itself. Please select two different documents.');
    }

    // 2. Fetch both documents and check status
    const [baseDoc, targetDoc] = await Promise.all([
      this.documentService.getDocumentById(baseDocId),
      this.documentService.getDocumentById(targetDocId),
    ]);

    if (!baseDoc) {
      throw new NotFoundError('Base Document');
    }
    if (!targetDoc) {
      throw new NotFoundError('Target Document');
    }

    if (baseDoc.status !== 'READY') {
      throw new AppError(
        `Base document "${baseDoc.title}" is not ready for comparison. It must finish processing first.`,
        400,
        'DOCUMENT_NOT_READY'
      );
    }
    if (targetDoc.status !== 'READY') {
      throw new AppError(
        `Target document "${targetDoc.title}" is not ready for comparison. It must finish processing first.`,
        400,
        'DOCUMENT_NOT_READY'
      );
    }

    // 3. Idempotency: Return cached comparison if available and not forced
    if (!options?.force) {
      const existing = await this.getComparisonByDocumentPair(baseDocId, targetDocId);
      if (existing) {
        return existing;
      }
    }

    // 4. Fetch structured pages from database
    const [basePages, targetPages] = await Promise.all([
      this.documentService.getDocumentPages(baseDocId),
      this.documentService.getDocumentPages(targetDocId),
    ]);

    if (!basePages || basePages.length === 0) {
      throw new AppError('No extracted page content found for base document.', 422, 'MISSING_PAGE_CONTENT');
    }
    if (!targetPages || targetPages.length === 0) {
      throw new AppError('No extracted page content found for target document.', 422, 'MISSING_PAGE_CONTENT');
    }

    // 5. Generate structured semantic comparison (Gemini or deterministic offline alignment)
    let raw: RawComparisonOutput;
    if (this.gemini.isConfigured() && [...basePages, ...targetPages].reduce((total, page) => total + page.text.length, 0) <= 120_000) {
      const dualPrompt = buildDualDocumentComparisonPrompt(basePages, targetPages, baseDoc.title, targetDoc.title);
      const userPrompt = `
Compare the original document against the revised document provided below.
Identify substantive differences (ADDED, REMOVED, MODIFIED, UNCHANGED clauses), detect semantic field changes,
and ground every claim with verbatim quotes from the respective documents.

Respond strictly in valid JSON matching this schema:
{
  "summary": {
    "plainLanguage": "2-3 sentence neutral overview of what changed substantively between the documents",
    "baseGoverningLaw": "Explicit governing law in base document, or 'Governing law was not identified in the base document'",
    "targetGoverningLaw": "Explicit governing law in revised document, or 'Governing law was not identified in the revised document'"
  },
  "differences": [
    {
      "type": "ADDED|REMOVED|MODIFIED|UNCHANGED",
      "category": "PAYMENT|TERMINATION|RENEWAL|LIABILITY|INDEMNITY|CONFIDENTIALITY|RESTRICTIONS|DISPUTE_RESOLUTION|PRIVACY|DEADLINE|OTHER",
      "title": "Clause or provision title",
      "sectionReference": "e.g. Section 11.2",
      "baseEvidence": {
        "pageNumber": 1,
        "quotedText": "verbatim quote from base document (mandatory for MODIFIED and REMOVED)",
        "sectionReference": "Section 11.2"
      },
      "targetEvidence": {
        "pageNumber": 1,
        "quotedText": "verbatim quote from revised document (mandatory for MODIFIED and ADDED)",
        "sectionReference": "Section 11.2"
      },
      "changeSummary": "Clear plain-language explanation of what changed",
      "semanticChanges": [
        { "field": "notice_period", "before": "30 days", "after": "60 days", "description": "Notice period extended from 30 days to 60 days" }
      ],
      "practicalImplications": "Objective explanation of practical significance without giving legal advice",
      "attentionLevel": "HIGH|MEDIUM|LOW|INFORMATIONAL",
      "lawyerQuestion": "Question to ask counsel regarding this specific change",
      "isSubstantive": true
    }
  ],
  "lawyerQuestions": [
    { "category": "Topic", "question": "Question for attorney", "groundedContext": "Clause or section reference" }
  ]
}

DOCUMENTS TO COMPARE:
${dualPrompt}
`.trim();

      try {
        raw = await this.gemini.generateStructured<RawComparisonOutput>(
          userPrompt,
          'RawComparisonOutput',
          {
            systemInstruction: SYSTEM_COMPARISON_ANALYST_PROMPT,
            responseJsonSchema: comparisonProviderSchema,
          }
        );
        raw = parseModelOutput(comparisonModelSchema, raw);
        if (!Array.isArray(raw.differences)) throw new Error('Comparison output lacks differences.');
        for (const difference of raw.differences) {
          if (!['ADDED', 'REMOVED', 'MODIFIED', 'UNCHANGED'].includes(difference.type)) throw new Error('Unknown comparison change type.');
        }
      } catch {
        // Fallback to deterministic alignment engine if Gemini fails or throttles
        raw = this.buildOfflineComparison(baseDoc.title, targetDoc.title, basePages, targetPages, baseDocId, targetDocId);
      }
    } else {
      // Deterministic offline fallback engine
      raw = this.buildOfflineComparison(baseDoc.title, targetDoc.title, basePages, targetPages, baseDocId, targetDocId);
    }

    // 6. Dual Anti-Fabrication Citation Validation
    let totalCitations = 0;
    let validatedCount = 0;
    let unverifiedCount = 0;

    const validatedCitationsToInsert: Array<{
      id: string;
      documentId: string;
      pageNumber: number;
      quotedText: string;
      sectionReference?: string;
      sourceType: EvidenceSourceType;
      confidenceScore: number;
    }> = [];

    const processedDifferences: ComparisonDifferenceItem[] = (raw.differences || []).map((diff, idx) => {
      const item: ComparisonDifferenceItem = {
        id: diff.id || `diff_${idx + 1}`,
        type: diff.type || 'MODIFIED',
        category: diff.category || 'OTHER',
        title: diff.title || 'Contract Term',
        sectionReference: diff.sectionReference,
        changeSummary: diff.changeSummary || 'Textual differences identified between versions.',
        semanticChanges: diff.semanticChanges || [],
        practicalImplications:
          diff.practicalImplications ||
          'Consider reviewing this difference with a qualified legal professional to understand implications.',
        attentionLevel: diff.attentionLevel || 'MEDIUM',
        lawyerQuestion: diff.lawyerQuestion,
        isSubstantive: diff.isSubstantive ?? (diff.type !== 'UNCHANGED'),
      };

      // Validate Base Evidence if provided
      if (diff.baseEvidence && diff.baseEvidence.quotedText) {
        totalCitations++;
        const baseVal = this.validator.validateCitationAgainstPages(
          {
            pageNumber: diff.baseEvidence.pageNumber,
            quotedText: diff.baseEvidence.quotedText,
            documentId: baseDocId,
          },
          basePages
        );

        const { reconciledType, discrepancyNote } = this.validator.reconcileClassification(
          'DOCUMENT_FACT',
          baseVal
        );

        item.baseEvidence = {
          documentId: baseDocId,
          documentTitle: baseDoc.title,
          pageNumber: diff.baseEvidence.pageNumber,
          sectionReference: diff.baseEvidence.sectionReference || diff.sectionReference,
          quotedText: diff.baseEvidence.quotedText,
          classification: reconciledType,
          isValidated: baseVal.isValidated,
          discrepancyNote,
        };

        if (baseVal.isValidated) {
          validatedCount++;
          validatedCitationsToInsert.push({
            id: generateId('cit'),
            documentId: baseDocId,
            pageNumber: diff.baseEvidence.pageNumber,
            quotedText: diff.baseEvidence.quotedText,
            sectionReference: diff.baseEvidence.sectionReference || diff.sectionReference,
            sourceType: reconciledType,
            confidenceScore: baseVal.matchConfidence,
          });
        } else {
          unverifiedCount++;
        }
      }

      // Validate Target Evidence if provided
      if (diff.targetEvidence && diff.targetEvidence.quotedText) {
        totalCitations++;
        const targetVal = this.validator.validateCitationAgainstPages(
          {
            pageNumber: diff.targetEvidence.pageNumber,
            quotedText: diff.targetEvidence.quotedText,
            documentId: targetDocId,
          },
          targetPages
        );

        const { reconciledType, discrepancyNote } = this.validator.reconcileClassification(
          'DOCUMENT_FACT',
          targetVal
        );

        item.targetEvidence = {
          documentId: targetDocId,
          documentTitle: targetDoc.title,
          pageNumber: diff.targetEvidence.pageNumber,
          sectionReference: diff.targetEvidence.sectionReference || diff.sectionReference,
          quotedText: diff.targetEvidence.quotedText,
          classification: reconciledType,
          isValidated: targetVal.isValidated,
          discrepancyNote,
        };

        if (targetVal.isValidated) {
          validatedCount++;
          validatedCitationsToInsert.push({
            id: generateId('cit'),
            documentId: targetDocId,
            pageNumber: diff.targetEvidence.pageNumber,
            quotedText: diff.targetEvidence.quotedText,
            sectionReference: diff.targetEvidence.sectionReference || diff.sectionReference,
            sourceType: reconciledType,
            confidenceScore: targetVal.matchConfidence,
          });
        } else {
          unverifiedCount++;
        }
      }

      return item;
    }).filter((item) => {
      if (item.type === 'ADDED') return item.targetEvidence?.isValidated === true;
      if (item.type === 'REMOVED') return item.baseEvidence?.isValidated === true;
      return item.baseEvidence?.isValidated === true && item.targetEvidence?.isValidated === true;
    });

    // 7. Calculate Statistics
    let addedCount = 0;
    let removedCount = 0;
    let modifiedCount = 0;
    let unchangedCount = 0;
    let substantiveCount = 0;

    for (const d of processedDifferences) {
      if (d.type === 'ADDED') addedCount++;
      else if (d.type === 'REMOVED') removedCount++;
      else if (d.type === 'MODIFIED') modifiedCount++;
      else if (d.type === 'UNCHANGED') unchangedCount++;

      if (d.isSubstantive) substantiveCount++;
    }

    const statistics: ComparisonStatistics = {
      addedCount,
      removedCount,
      modifiedCount,
      unchangedCount,
      substantiveCount,
      totalDifferences: processedDifferences.length,
    };

    // 8. Assemble Lawyer Questions
    const lawyerQuestions: ComparisonLawyerQuestion[] = (raw.lawyerQuestions || []).map((q, idx) => ({
      id: q.id || `lq_${idx + 1}`,
      category: q.category || 'General',
      question: q.question || '',
      groundedContext: q.groundedContext || '',
    }));

    // If lawyer questions list is empty, synthesize from substantive differences
    if (lawyerQuestions.length === 0) {
      for (const d of processedDifferences) {
        if (d.lawyerQuestion && d.isSubstantive) {
          lawyerQuestions.push({
            id: `lq_${lawyerQuestions.length + 1}`,
            category: d.category,
            question: d.lawyerQuestion,
            groundedContext: `${d.title}${d.sectionReference ? ` (${d.sectionReference})` : ''}`,
          });
        }
      }
    }

    // 9. Build Final Comparison Result
    const comparisonId = generateId('comp');
    const now = new Date().toISOString();

    const summaryText =
      raw.summary?.plainLanguage ||
      `Identified ${substantiveCount} substantive changes (${modifiedCount} modified, ${addedCount} added, ${removedCount} removed) between "${baseDoc.title}" and "${targetDoc.title}".`;

    const finalResult: ComparisonResult = {
      id: comparisonId,
      baseDocumentId: baseDocId,
      targetDocumentId: targetDocId,
      summary: {
        plainLanguage: summaryText,
        baseDocumentTitle: baseDoc.title,
        targetDocumentTitle: targetDoc.title,
        baseGoverningLaw: raw.summary?.baseGoverningLaw || 'Governing law was not identified in the base document.',
        targetGoverningLaw: raw.summary?.targetGoverningLaw || 'Governing law was not identified in the revised document.',
      },
      statistics,
      differences: processedDifferences,
      lawyerQuestions,
      validationSummary: {
        totalCitations,
        validatedCount,
        unverifiedCount,
      },
      comparedAt: now,
      disclaimer: LEGAL_DISCLAIMERS.GLOBAL_FOOTER,
      status: 'COMPLETED',
    };

    // 10. Persist to Database
    const db = getDb();

    // Clean up any previous comparison and its citations for this exact base and target pair
    const existingList = await db
      .select({ id: schema.comparisons.id })
      .from(schema.comparisons)
      .where(
        and(
          eq(schema.comparisons.baseDocumentId, baseDocId),
          eq(schema.comparisons.targetDocumentId, targetDocId),
          eq(schema.comparisons.userId, userId)
        )
      );

    for (const item of existingList) {
      await db.delete(schema.citations).where(eq(schema.citations.comparisonId, item.id));
    }

    await db
      .delete(schema.comparisons)
      .where(
        and(
          eq(schema.comparisons.baseDocumentId, baseDocId),
          eq(schema.comparisons.targetDocumentId, targetDocId),
          eq(schema.comparisons.userId, userId)
        )
      );

    await db.insert(schema.comparisons).values({
      id: comparisonId,
      userId,
      baseDocumentId: baseDocId,
      targetDocumentId: targetDocId,
      summary: finalResult.summary.plainLanguage,
      differencesJson: JSON.stringify(finalResult.differences),
      comparisonDataJson: JSON.stringify(finalResult),
      status: 'COMPLETED',
      createdAt: now,
      updatedAt: now,
    });

    if (validatedCitationsToInsert.length > 0) {
      await db.insert(schema.citations).values(
        validatedCitationsToInsert.map((c) => ({
          id: c.id,
          documentId: c.documentId,
          comparisonId: comparisonId,
          sourceType: c.sourceType,
          pageNumber: c.pageNumber,
          sectionReference: c.sectionReference || null,
          quotedText: c.quotedText,
          confidenceScore: c.confidenceScore,
          createdAt: now,
        }))
      );
    }

    return finalResult;
  }

  /**
   * Deterministic offline comparison builder (used in tests or when Gemini is unconfigured).
   */
  private buildOfflineComparison(
    baseTitle: string,
    targetTitle: string,
    basePages: Array<{ pageNumber: number; text: string }>,
    targetPages: Array<{ pageNumber: number; text: string }>,
    baseDocId: string,
    targetDocId: string
  ): RawComparisonOutput {
    const baseClauses = extractClausesFromPages(basePages);
    const targetClauses = extractClausesFromPages(targetPages);

    const differences = alignAndCompareClauses(
      baseClauses,
      targetClauses,
      baseDocId,
      targetDocId,
      baseTitle,
      targetTitle
    );

    const substantiveDiffs = differences.filter((d) => d.isSubstantive);
    const modifiedCount = differences.filter((d) => d.type === 'MODIFIED').length;
    const addedCount = differences.filter((d) => d.type === 'ADDED').length;
    const removedCount = differences.filter((d) => d.type === 'REMOVED').length;

    const summary = {
      plainLanguage: `Identified ${substantiveDiffs.length} substantive changes (${modifiedCount} modified, ${addedCount} added, ${removedCount} removed) between "${baseTitle}" and "${targetTitle}".`,
      baseGoverningLaw: 'Governing law was not identified in the base document.',
      targetGoverningLaw: 'Governing law was not identified in the revised document.',
    };

    const lawyerQuestions = substantiveDiffs
      .filter((d) => Boolean(d.lawyerQuestion))
      .map((d, idx) => ({
        id: `q_${idx + 1}`,
        category: d.category,
        question: d.lawyerQuestion || '',
        groundedContext: d.title,
      }));

    return {
      summary,
      differences,
      lawyerQuestions,
    };
  }
}

let comparisonServiceInstance: ComparisonService | null = null;

export function getComparisonService(): ComparisonService {
  if (!comparisonServiceInstance) {
    comparisonServiceInstance = new ComparisonService();
  }
  return comparisonServiceInstance;
}
