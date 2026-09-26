import { getDb, schema } from '@/lib/db';
import {
  MatterDetail,
  DocumentRelationshipItem,
  ConsistencyFinding,
  LegalXRayAnalysis,
  CounselQuestionItem,
  CounselQuestionsResponse,
  MatterBriefResponse,
} from '@/lib/ai/schemas';
import { containsProhibitedLegalConclusion, LEGAL_DISCLAIMERS } from '@/lib/ai/safety';
import { SYSTEM_MATTER_ANALYST_PROMPT, buildCounselQuestionPrompt } from '@/lib/ai/prompts';
import { generateId } from '@/lib/utils/id';
import { eq, and, inArray } from 'drizzle-orm';
import { getCurrentUserId } from '@/lib/auth/context';
import { parseModelOutput } from '@/lib/ai/validate-output';
import { counselQuestionsModelSchema, counselQuestionsProviderSchema, CounselQuestionsModelOutput } from '@/lib/ai/runtime-schemas';
import { MatterActionService } from './action-service';

export class MatterPreparationService extends MatterActionService {

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

        const generated = await this.gemini.generateStructured<CounselQuestionsModelOutput>(
          prompt,
          schemaDescription,
          {
            systemInstruction: SYSTEM_MATTER_ANALYST_PROMPT,
            responseJsonSchema: counselQuestionsProviderSchema,
          }
        );
        const rawList = parseModelOutput(counselQuestionsModelSchema, generated);

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
  protected synthesizeDeterministicCounselQuestions(
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
  }}
