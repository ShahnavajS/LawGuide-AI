import { getDb, schema } from '@/lib/db';
import {
  MatterEvidenceItem,
  EvidenceCoverageMetrics,
  DocumentPageEvidenceNode,
  DocumentSourceMapNode,
  MatterSourceMapResponse,
  EvidenceLedgerResponse,
} from '@/lib/ai/schemas';
import { EvidenceSourceType } from '@/lib/ai/safety';
import { NotFoundError } from '@/lib/utils/errors';
import { eq, and, inArray, sql, asc } from 'drizzle-orm';
import { MatterPreparationService } from './preparation-service';

export class MatterEvidenceService extends MatterPreparationService {

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
  }}
