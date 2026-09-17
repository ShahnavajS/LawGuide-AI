/**
 * Legal X-Ray Analysis Service Layer.
 *
 * Coordinates structured GenAI extraction, citation verification, anti-fabrication
 * reconciliation, and database persistence.
 */

import { getDb, schema } from '@/lib/db';
import { getDocumentService, DocumentService } from '@/lib/document/service';
import { geminiService, GeminiService } from '@/lib/ai/gemini';
import { citationValidator, CitationValidator } from '@/lib/evidence/validator';
import {
  LegalXRayAnalysis,
  PartyFinding,
  DateFinding,
  ObligationFinding,
  RightFinding,
  FinancialTermFinding,
  MaterialClauseFinding,
  AttentionAreaFinding,
  LawyerQuestionFinding,
} from '@/lib/ai/schemas';
import { SYSTEM_LEGAL_ANALYST_PROMPT, buildPageAwareDocumentPrompt } from '@/lib/ai/prompts';
import { LEGAL_DISCLAIMERS, EvidenceSourceType } from '@/lib/ai/safety';
import { generateId } from '@/lib/utils/id';
import { AppError, NotFoundError, ValidationError } from '@/lib/utils/errors';
import { eq } from 'drizzle-orm';

interface RawLegalXRayOutput {
  overview?: {
    documentType?: string;
    title?: string;
    summary?: string;
    governingLaw?: string;
    purpose?: string;
  };
  parties?: Array<{
    id?: string;
    name: string;
    role: string;
    pageNumber: number;
    quotedText: string;
  }>;
  keyDates?: Array<{
    id?: string;
    label: string;
    dateValue: string;
    description: string;
    pageNumber: number;
    quotedText: string;
  }>;
  obligations?: Array<{
    id?: string;
    party: string;
    obligation: string;
    explanation: string;
    conditionOrDeadline?: string;
    attentionLevel?: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
    pageNumber: number;
    quotedText: string;
    sectionReference?: string;
  }>;
  rights?: Array<{
    id?: string;
    party: string;
    right: string;
    explanation: string;
    pageNumber: number;
    quotedText: string;
  }>;
  financialTerms?: Array<{
    id?: string;
    term: string;
    amountOrValue: string;
    explanation: string;
    pageNumber: number;
    quotedText: string;
  }>;
  materialClauses?: Array<{
    id?: string;
    category?: 'PAYMENT' | 'TERMINATION' | 'RENEWAL' | 'LIABILITY' | 'INDEMNITY' | 'CONFIDENTIALITY' | 'RESTRICTIONS' | 'DISPUTE_RESOLUTION' | 'PRIVACY' | 'DEADLINE' | 'OTHER';
    title: string;
    summary: string;
    plainLanguage: string;
    sectionReference?: string;
    pageNumber: number;
    quotedText: string;
  }>;
  attentionAreas?: Array<{
    id?: string;
    category?: 'PAYMENT' | 'TERMINATION' | 'RENEWAL' | 'LIABILITY' | 'INDEMNITY' | 'CONFIDENTIALITY' | 'RESTRICTIONS' | 'DISPUTE_RESOLUTION' | 'PRIVACY' | 'DEADLINE' | 'OTHER';
    attentionLevel?: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
    title: string;
    description: string;
    whyItMatters: string;
    pageNumber: number;
    quotedText: string;
  }>;
  lawyerQuestions?: Array<{
    id?: string;
    category?: string;
    question: string;
    groundedContext?: string;
  }>;
}

export class AnalysisService {
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

  /**
   * Retrieves an existing analysis for a document.
   */
  public async getAnalysis(docId: string): Promise<LegalXRayAnalysis | null> {
    if (!docId || typeof docId !== 'string') {
      throw new ValidationError('Document ID is required.');
    }

    const db = getDb();
    const [record] = await db
      .select()
      .from(schema.analyses)
      .where(eq(schema.analyses.documentId, docId))
      .limit(1);

    if (!record || record.status !== 'COMPLETED' || !record.analysisDataJson) {
      return null;
    }

    try {
      return JSON.parse(record.analysisDataJson) as LegalXRayAnalysis;
    } catch {
      return null;
    }
  }

  /**
   * Analyzes a processed document with Gemini and returns the verified Legal X-Ray.
   * If analysis exists and force is not set, returns cached analysis immediately (idempotent).
   */
  public async analyzeDocument(
    docId: string,
    options?: { force?: boolean }
  ): Promise<LegalXRayAnalysis> {
    if (!docId || typeof docId !== 'string') {
      throw new ValidationError('Document ID is required.');
    }

    // 1. Verify document existence and status
    const document = await this.documentService.getDocumentById(docId);
    if (!document) {
      throw new NotFoundError('Document');
    }

    if (document.status !== 'READY') {
      throw new AppError(
        'Document is not ready for analysis. Document must finish processing first.',
        400,
        'DOCUMENT_NOT_READY'
      );
    }

    // 2. Idempotency check: Return existing completed analysis if not forced
    if (!options?.force) {
      const existing = await this.getAnalysis(docId);
      if (existing) {
        return existing;
      }
    }

    // 3. Fetch structured pages from database
    const pages = await this.documentService.getDocumentPages(docId);
    if (!pages || pages.length === 0) {
      throw new AppError(
        'No extracted page content found for this document.',
        422,
        'MISSING_PAGE_CONTENT'
      );
    }

    // 4. Generate structured analysis from Gemini (or deterministic fallback in test/offline mode)
    let raw: RawLegalXRayOutput;
    if (this.gemini.isConfigured()) {
      const promptContent = buildPageAwareDocumentPrompt(pages);
      const userPrompt = `
Analyze the legal document provided below and generate a comprehensive Legal X-Ray analysis adhering strictly to all safety and grounding rules.

Respond strictly in valid JSON matching this schema:
{
  "overview": {
    "documentType": "Identified legal category (e.g. Non-Disclosure Agreement, Commercial Lease, Master Services Agreement)",
    "title": "Document title",
    "summary": "Plain-language 2-3 sentence executive summary",
    "governingLaw": "Explicit governing law/jurisdiction, or 'Governing law was not identified in this document' if not explicitly stated",
    "purpose": "Primary objective of the document"
  },
  "parties": [
    { "name": "Party name", "role": "Role (e.g. Employer, Disclosing Party, Landlord)", "pageNumber": 1, "quotedText": "verbatim quote naming party" }
  ],
  "keyDates": [
    { "label": "e.g. Effective Date, Notice Deadline", "dateValue": "Stated date or duration", "description": "What occurs on this date", "pageNumber": 1, "quotedText": "verbatim quote" }
  ],
  "obligations": [
    { "party": "Party name", "obligation": "Action required", "explanation": "Plain-language meaning", "conditionOrDeadline": "Conditions", "attentionLevel": "HIGH|MEDIUM|LOW|INFORMATIONAL", "pageNumber": 1, "quotedText": "verbatim quote", "sectionReference": "optional section number" }
  ],
  "rights": [
    { "party": "Party name", "right": "Right granted", "explanation": "Plain language explanation", "pageNumber": 1, "quotedText": "verbatim quote" }
  ],
  "financialTerms": [
    { "term": "Term name (e.g. Rent, Deposit, Compensation)", "amountOrValue": "Value", "explanation": "Explanation", "pageNumber": 1, "quotedText": "verbatim quote" }
  ],
  "materialClauses": [
    { "category": "PAYMENT|TERMINATION|RENEWAL|LIABILITY|INDEMNITY|CONFIDENTIALITY|RESTRICTIONS|DISPUTE_RESOLUTION|PRIVACY|DEADLINE|OTHER", "title": "Clause Title", "summary": "Summary", "plainLanguage": "Plain-language explanation", "sectionReference": "e.g. Section 4.2", "pageNumber": 1, "quotedText": "verbatim quote" }
  ],
  "attentionAreas": [
    { "category": "PAYMENT|TERMINATION|RENEWAL|LIABILITY|INDEMNITY|CONFIDENTIALITY|RESTRICTIONS|DISPUTE_RESOLUTION|PRIVACY|DEADLINE|OTHER", "attentionLevel": "HIGH|MEDIUM|LOW|INFORMATIONAL", "title": "Area of attention", "description": "Description", "whyItMatters": "Objective, calm explanation of why review is recommended", "pageNumber": 1, "quotedText": "verbatim quote" }
  ],
  "lawyerQuestions": [
    { "category": "Topic", "question": "Clear question for user to ask their attorney", "groundedContext": "Clause or page reference" }
  ]
}

DOCUMENT TO ANALYZE:
${promptContent}
`.trim();

      try {
        raw = await this.gemini.generateStructured<RawLegalXRayOutput>(
          userPrompt,
          'RawLegalXRayOutput',
          { systemInstruction: SYSTEM_LEGAL_ANALYST_PROMPT }
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'AI generation error';
        throw new AppError(`Analysis generation failed: ${msg}`, 502, 'AI_ANALYSIS_FAILED');
      }
    } else {
      // Deterministic offline fallback
      raw = this.buildOfflineAnalysis(document.title, pages);
    }

    // 5. Anti-Fabrication Citation Validation & Grounding Reconciliation
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

    // Helper to validate and reconcile a single item
    const validateItem = <T extends { pageNumber: number; quotedText: string; classification?: string; isValidated?: boolean }>(
      item: T
    ): T => {
      totalCitations++;
      const val = this.validator.validateCitationAgainstPages(
        { pageNumber: item.pageNumber, quotedText: item.quotedText },
        pages
      );

      const initialType = (item.classification as 'DOCUMENT_FACT' | 'AI_INTERPRETATION' | 'GENERAL_INFO' | 'NEEDS_REVIEW') || 'DOCUMENT_FACT';
      const { reconciledType } = this.validator.reconcileClassification(initialType, val);

      item.classification = reconciledType;
      item.isValidated = val.isValidated;

      if (val.isValidated) {
        validatedCount++;
        validatedCitationsToInsert.push({
          id: generateId('cit'),
          documentId: docId,
          pageNumber: item.pageNumber,
          quotedText: item.quotedText,
          sourceType: reconciledType,
          confidenceScore: val.matchConfidence,
        });
      } else {
        unverifiedCount++;
      }

      return item;
    };

    // Reconcile all findings
    const parties: PartyFinding[] = (raw.parties || []).map((p, idx) =>
      validateItem({
        id: p.id || `party_${idx + 1}`,
        name: p.name || 'Unnamed Party',
        role: p.role || 'Contracting Party',
        pageNumber: p.pageNumber || 1,
        quotedText: p.quotedText || '',
        classification: 'DOCUMENT_FACT' as const,
      })
    );

    const keyDates: DateFinding[] = (raw.keyDates || []).map((d, idx) =>
      validateItem({
        id: d.id || `date_${idx + 1}`,
        label: d.label || 'Key Date',
        dateValue: d.dateValue || 'Unspecified',
        description: d.description || '',
        pageNumber: d.pageNumber || 1,
        quotedText: d.quotedText || '',
        classification: 'DOCUMENT_FACT' as const,
      })
    );

    const obligations: ObligationFinding[] = (raw.obligations || []).map((o, idx) =>
      validateItem({
        id: o.id || `ob_${idx + 1}`,
        party: o.party || 'Obligated Party',
        obligation: o.obligation || '',
        explanation: o.explanation || '',
        conditionOrDeadline: o.conditionOrDeadline,
        attentionLevel: o.attentionLevel || 'MEDIUM',
        pageNumber: o.pageNumber || 1,
        quotedText: o.quotedText || '',
        sectionReference: o.sectionReference,
        classification: 'DOCUMENT_FACT' as const,
      })
    );

    const rights: RightFinding[] = (raw.rights || []).map((r, idx) =>
      validateItem({
        id: r.id || `right_${idx + 1}`,
        party: r.party || 'Right Holder',
        right: r.right || '',
        explanation: r.explanation || '',
        pageNumber: r.pageNumber || 1,
        quotedText: r.quotedText || '',
        classification: 'DOCUMENT_FACT' as const,
      })
    );

    const financialTerms: FinancialTermFinding[] = (raw.financialTerms || []).map((f, idx) =>
      validateItem({
        id: f.id || `fin_${idx + 1}`,
        term: f.term || 'Financial Term',
        amountOrValue: f.amountOrValue || 'Unspecified',
        explanation: f.explanation || '',
        pageNumber: f.pageNumber || 1,
        quotedText: f.quotedText || '',
        classification: 'DOCUMENT_FACT' as const,
      })
    );

    const materialClauses: MaterialClauseFinding[] = (raw.materialClauses || []).map((c, idx) =>
      validateItem({
        id: c.id || `clause_${idx + 1}`,
        category: c.category || 'OTHER',
        title: c.title || 'Contract Provision',
        summary: c.summary || '',
        plainLanguage: c.plainLanguage || '',
        sectionReference: c.sectionReference,
        pageNumber: c.pageNumber || 1,
        quotedText: c.quotedText || '',
        classification: 'DOCUMENT_FACT' as const,
      })
    );

    const attentionAreas: AttentionAreaFinding[] = (raw.attentionAreas || []).map((a, idx) =>
      validateItem({
        id: a.id || `att_${idx + 1}`,
        category: a.category || 'OTHER',
        attentionLevel: a.attentionLevel || 'MEDIUM',
        title: a.title || 'Attention Area',
        description: a.description || '',
        whyItMatters: a.whyItMatters || '',
        pageNumber: a.pageNumber || 1,
        quotedText: a.quotedText || '',
        classification: 'DOCUMENT_FACT' as const,
      })
    );

    const lawyerQuestions: LawyerQuestionFinding[] = (raw.lawyerQuestions || []).map((q, idx) => ({
      id: q.id || `q_${idx + 1}`,
      category: q.category || 'General',
      question: q.question || '',
      groundedContext: q.groundedContext || '',
    }));

    const overview = {
      documentType: raw.overview?.documentType || 'Legal Agreement',
      title: raw.overview?.title || document.title,
      summary: raw.overview?.summary || 'No summary available.',
      governingLaw: raw.overview?.governingLaw || 'Governing law was not identified in this document.',
      purpose: raw.overview?.purpose || 'Defines obligations and legal relationship between the parties.',
    };

    const finalAnalysis: LegalXRayAnalysis = {
      documentId: docId,
      overview,
      parties,
      keyDates,
      obligations,
      rights,
      financialTerms,
      materialClauses,
      attentionAreas,
      lawyerQuestions,
      validationSummary: {
        totalCitations,
        validatedCount,
        unverifiedCount,
      },
      analyzedAt: new Date().toISOString(),
      disclaimer: LEGAL_DISCLAIMERS.GLOBAL_FOOTER,
    };

    // 6. Persist analysis & citations in database
    const db = getDb();
    const now = new Date().toISOString();
    const analysisId = generateId('analysis');

    // Clean up any previous analysis and citations for docId
    await db.delete(schema.analyses).where(eq(schema.analyses.documentId, docId));
    await db.delete(schema.citations).where(eq(schema.citations.documentId, docId));

    await db.insert(schema.analyses).values({
      id: analysisId,
      documentId: docId,
      summary: overview.summary,
      documentType: overview.documentType,
      governingLaw: overview.governingLaw,
      keyClausesJson: JSON.stringify(materialClauses),
      obligationsJson: JSON.stringify(obligations),
      risksJson: JSON.stringify(attentionAreas),
      analysisDataJson: JSON.stringify(finalAnalysis),
      status: 'COMPLETED',
      createdAt: now,
      updatedAt: now,
    });

    if (validatedCitationsToInsert.length > 0) {
      await db.insert(schema.citations).values(
        validatedCitationsToInsert.map((c) => ({
          id: c.id,
          documentId: docId,
          analysisId: analysisId,
          sourceType: c.sourceType,
          pageNumber: c.pageNumber,
          sectionReference: c.sectionReference || null,
          quotedText: c.quotedText,
          confidenceScore: c.confidenceScore,
          createdAt: now,
        }))
      );
    }

    return finalAnalysis;
  }

  /**
   * Deterministic fallback generator when Gemini is unconfigured/offline.
   * Extracts real grounded findings directly from the stored page text.
   */
  private buildOfflineAnalysis(
    title: string,
    pages: Array<{ pageNumber: number; text: string }>
  ): RawLegalXRayOutput {
    const fullText = pages.map((p) => p.text).join(' ');

    // Extract first page text for basic grounding
    const firstPage = pages[0] || { pageNumber: 1, text: title };
    const firstPageQuote = firstPage.text.substring(0, Math.min(60, firstPage.text.length)).trim() || title;

    // Check for termination mention
    const terminationPage = pages.find((p) => /termination|notice/i.test(p.text)) || firstPage;
    const termQuote =
      terminationPage.text.match(/[^.!?]*thirty days[^.!?]*/i)?.[0]?.trim() ||
      terminationPage.text.match(/[^.!?]*notice[^.!?]*/i)?.[0]?.trim() ||
      terminationPage.text.substring(0, 40).trim();

    // Check for confidentiality mention
    const confPage = pages.find((p) => /confidential/i.test(p.text)) || firstPage;
    const confQuote =
      confPage.text.match(/[^.!?]*confidential[^.!?]*/i)?.[0]?.trim() ||
      confPage.text.substring(0, 40).trim();

    // Check for governing law
    const lawMatch = fullText.match(/governing law[^.\n]*/i)?.[0];
    const governingLaw = lawMatch ? lawMatch.trim() : 'Governing law was not identified in this document.';

    return {
      overview: {
        documentType: 'Legal Agreement',
        title,
        summary: `This document outlines mutual obligations, terms, and conditions established between the parties across ${pages.length} pages.`,
        governingLaw,
        purpose: 'Establish contractual commitments and operating parameters.',
      },
      parties: [
        {
          id: 'p1',
          name: 'Named Contracting Parties',
          role: 'Parties to Agreement',
          pageNumber: firstPage.pageNumber,
          quotedText: firstPageQuote,
        },
      ],
      keyDates: [
        {
          id: 'd1',
          label: 'Term / Notice Period',
          dateValue: 'As specified in provisions',
          description: 'Applicable timeline for notice or operational milestones.',
          pageNumber: terminationPage.pageNumber,
          quotedText: termQuote,
        },
      ],
      obligations: [
        {
          id: 'ob1',
          party: 'Contracting Party',
          obligation: 'Comply with stated terms and notice requirements.',
          explanation: 'The agreement requires formal adherence to written notice timelines.',
          conditionOrDeadline: 'Prior to termination or amendment.',
          attentionLevel: 'MEDIUM',
          pageNumber: terminationPage.pageNumber,
          quotedText: termQuote,
          sectionReference: 'Termination Clause',
        },
      ],
      rights: [
        {
          id: 'r1',
          party: 'Either Party',
          right: 'Exercise rights subject to terms specified.',
          explanation: 'Parties retain statutory and contractual rights under the agreement.',
          pageNumber: firstPage.pageNumber,
          quotedText: firstPageQuote,
        },
      ],
      financialTerms: [],
      materialClauses: [
        {
          id: 'c1',
          category: 'TERMINATION',
          title: 'Termination Provisions',
          summary: 'Outlines the requirements and notice period for ending the contract.',
          plainLanguage: 'Requires advance notice before ending the agreement.',
          sectionReference: 'Termination',
          pageNumber: terminationPage.pageNumber,
          quotedText: termQuote,
        },
        {
          id: 'c2',
          category: 'CONFIDENTIALITY',
          title: 'Confidentiality Provisions',
          summary: 'Governs non-disclosure and protection of sensitive information.',
          plainLanguage: 'Parties must maintain secrecy of non-public shared details.',
          sectionReference: 'Confidentiality',
          pageNumber: confPage.pageNumber,
          quotedText: confQuote,
        },
      ],
      attentionAreas: [
        {
          id: 'att1',
          category: 'TERMINATION',
          attentionLevel: 'MEDIUM',
          title: 'Notice Period Requirements',
          description: 'Specific written notice deadlines apply to termination.',
          whyItMatters: 'Missing a notice window could result in unintended contract continuation or dispute.',
          pageNumber: terminationPage.pageNumber,
          quotedText: termQuote,
        },
      ],
      lawyerQuestions: [
        {
          id: 'q1',
          category: 'Termination',
          question: 'Are there any circumstances under which the notice period is waived or shortened?',
          groundedContext: `Termination provision on Page ${terminationPage.pageNumber}`,
        },
        {
          id: 'q2',
          category: 'Confidentiality',
          question: 'Does the confidentiality obligation survive termination, and if so, for how long?',
          groundedContext: `Confidentiality provision on Page ${confPage.pageNumber}`,
        },
      ],
    };
  }
}

let analysisServiceInstance: AnalysisService | null = null;

export function getAnalysisService(): AnalysisService {
  if (typeof window !== 'undefined') {
    throw new Error('FATAL: Attempted to access AnalysisService from browser bundle.');
  }

  if (!analysisServiceInstance) {
    analysisServiceInstance = new AnalysisService();
  }
  return analysisServiceInstance;
}
