import { getDb, schema } from '@/lib/db';
import { createHash } from 'node:crypto';
import {
  DocumentRelationshipItem,
  ConsistencyFinding,
  MatterTimelineEvent,
  MatterSearchResponse,
  MatterDocumentSearchResult,
  MatterSearchMatch,
  LegalXRayAnalysis,
} from '@/lib/ai/schemas';
import { MatterDocumentRole, DocumentRelationshipType, MatterActivityType } from '@/lib/ai/safety';
import { SYSTEM_MATTER_ANALYST_PROMPT, buildRelationshipExtractionPrompt } from '@/lib/ai/prompts';
import { generateId } from '@/lib/utils/id';
import { NotFoundError, ValidationError } from '@/lib/utils/errors';
import { eq, and, inArray, like, desc, asc } from 'drizzle-orm';
import { getCurrentUserId } from '@/lib/auth/context';
import { parseModelOutput } from '@/lib/ai/validate-output';
import { relationshipModelSchema, relationshipProviderSchema, RelationshipModelOutput } from '@/lib/ai/runtime-schemas';
import { MatterCoreService } from './core-service';

export class MatterIntelligenceService extends MatterCoreService {

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
        const generated = await this.gemini.generateStructured<RelationshipModelOutput>(
          prompt,
          schemaDescription,
          {
            systemInstruction: SYSTEM_MATTER_ANALYST_PROMPT,
            responseJsonSchema: relationshipProviderSchema,
          }
        );
        rawRelationships = parseModelOutput(relationshipModelSchema, generated);
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
  }}
