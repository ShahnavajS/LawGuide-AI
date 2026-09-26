import { getDb, schema } from '@/lib/db';
import { MatterDetail, DocumentRelationshipItem, ConsistencyFinding, MatterQueryResponse, MatterActivityItem, MatterActionItem } from '@/lib/ai/schemas';
import {
  containsProhibitedLegalConclusion,
  LEGAL_DISCLAIMERS,
  ActionItemType,
  ActionItemStatus,
  ActionItemPriority,
  MatterActivityType,
} from '@/lib/ai/safety';
import { SYSTEM_MATTER_ANALYST_PROMPT, buildMatterQuestionPrompt } from '@/lib/ai/prompts';
import { generateId } from '@/lib/utils/id';
import { NotFoundError, ValidationError } from '@/lib/utils/errors';
import { eq, and, desc } from 'drizzle-orm';
import { parseModelOutput } from '@/lib/ai/validate-output';
import { matterAnswerModelSchema, matterAnswerProviderSchema, MatterAnswerModelOutput } from '@/lib/ai/runtime-schemas';
import { MatterIntelligenceService } from './intelligence-service';

export abstract class MatterQueryService extends MatterIntelligenceService {

  public abstract getActionItems(
    matterId: string,
    filter?: { status?: ActionItemStatus; priority?: ActionItemPriority; itemType?: ActionItemType }
  ): Promise<MatterActionItem[]>;

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

        const generated = await this.gemini.generateStructured<MatterAnswerModelOutput>(
          prompt,
          schemaDescription,
          {
            systemInstruction: SYSTEM_MATTER_ANALYST_PROMPT,
            responseJsonSchema: matterAnswerProviderSchema,
          }
        );
        const rawResponse = parseModelOutput(matterAnswerModelSchema, generated);

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
  }}
