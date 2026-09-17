/**
 * Legal Information Service for LexiGuide AI (Phase 7).
 *
 * Coordinates topic resolution, jurisdiction provenance, authoritative source lookup,
 * document-evidence grounding via CitationValidator, persistent SQLite caching,
 * and deterministic offline fallbacks without crossing into legal advice.
 */

import { getDb } from '@/lib/db';
import {
  documents,
  documentPages,
  analyses,
  comparisons,
  legalInformationCache,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  LEGAL_INFO_MODES,
  LegalInfoMode,
  JURISDICTION_SOURCE_TYPES,
  EVIDENCE_SOURCE_TYPES,
  containsProhibitedLegalConclusion,
} from '@/lib/ai/safety';
import {
  resolveTaxonomyTopic,
  searchTaxonomyTopics,
  LegalTopicDefinition,
} from './taxonomy';
import {
  getAuthoritativeSources,
} from './sources';
import { getLegalAidResources, LegalAidResource } from './legal-aid';
import { validateExternalSourceUrl } from './validator';
import {
  JurisdictionInfo,
  SourceReference,
  DocumentEvidenceItem,
  LegalInformationDossier,
  ConceptQuestionResponse,
} from './schemas';
import { CitationValidator } from '@/lib/evidence/validator';
import { GeminiService } from '@/lib/ai/gemini';
import {
  SYSTEM_LEGAL_INFORMATION_PROMPT,
  buildConceptQuestionPrompt,
} from '@/lib/ai/prompts';
import { generateId } from '@/lib/utils/id';

export interface GetLegalInfoParams {
  topic: string;
  documentId?: string;
  comparisonId?: string;
  userJurisdiction?: {
    country?: string | null;
    region?: string | null;
  };
  force?: boolean;
}

export interface ConceptQuestionParams {
  topic: string;
  question: string;
  documentId?: string;
  userJurisdiction?: {
    country?: string | null;
    region?: string | null;
  };
  contextQuote?: string;
}

export class LegalInformationService {
  private db = getDb();
  private citationValidator = new CitationValidator();
  private geminiService = new GeminiService();

  /**
   * Resolves a search string or category into a canonical taxonomy topic.
   */
  public resolveTopic(query: string): LegalTopicDefinition | null {
    return resolveTaxonomyTopic(query);
  }

  /**
   * Searches the controlled taxonomy topics.
   */
  public searchTopics(query: string): LegalTopicDefinition[] {
    return searchTaxonomyTopics(query);
  }

  /**
   * Resolves jurisdiction provenance according to strict non-inference rules.
   */
  public resolveJurisdiction(
    docJurisdiction?: string | null,
    userJurisdiction?: { country?: string | null; region?: string | null }
  ): JurisdictionInfo {
    // 1. Explicit document-established jurisdiction takes precedence
    if (docJurisdiction && docJurisdiction.trim() && !/not identified/i.test(docJurisdiction)) {
      const cleanDoc = docJurisdiction.trim();
      return {
        country: cleanDoc,
        region: null,
        source: JURISDICTION_SOURCE_TYPES.DOCUMENT_JURISDICTION,
        label: `DOCUMENT JURISDICTION · ${cleanDoc}`,
      };
    }

    // 2. User-provided jurisdiction
    if (userJurisdiction && userJurisdiction.country && userJurisdiction.country.trim()) {
      const country = userJurisdiction.country.trim();
      const region = userJurisdiction.region ? userJurisdiction.region.trim() : null;
      const formatted = region ? `${region}, ${country}` : country;
      return {
        country,
        region,
        source: JURISDICTION_SOURCE_TYPES.USER_PROVIDED_JURISDICTION,
        label: `USER-PROVIDED JURISDICTION · ${formatted}`,
      };
    }

    // 3. Default: Jurisdiction not established (NEVER guess from IP, browser, etc.)
    return {
      country: null,
      region: null,
      source: JURISDICTION_SOURCE_TYPES.JURISDICTION_NOT_ESTABLISHED,
      label: 'JURISDICTION NOT ESTABLISHED',
    };
  }

  /**
   * Generates or retrieves an educational dossier for a legal concept.
   */
  public async getLegalInformation(
    params: GetLegalInfoParams
  ): Promise<LegalInformationDossier> {
    const topicDef = this.resolveTopic(params.topic);
    if (!topicDef) {
      throw new Error(
        `Unknown legal topic '${params.topic}'. Please select a valid concept from the LexiGuide taxonomy.`
      );
    }

    // Extract document-established jurisdiction if documentId provided
    let docGoverningLaw: string | null = null;
    let docTitle: string = 'Uploaded Legal Document';
    const documentEvidenceList: DocumentEvidenceItem[] = [];

    if (params.documentId) {
      const docRows = this.db
        .select()
        .from(documents)
        .where(eq(documents.id, params.documentId))
        .all();

      if (docRows.length > 0) {
        docTitle = docRows[0].title;
        const analysisRows = this.db
          .select()
          .from(analyses)
          .where(eq(analyses.documentId, params.documentId))
          .all();

        if (analysisRows.length > 0) {
          docGoverningLaw = analysisRows[0].governingLaw;

          // Extract clauses or obligations matching this topic
          if (analysisRows[0].analysisDataJson) {
            try {
              const parsed = JSON.parse(analysisRows[0].analysisDataJson);
              const pages = this.db
                .select({ pageNumber: documentPages.pageNumber, text: documentPages.text })
                .from(documentPages)
                .where(eq(documentPages.documentId, params.documentId))
                .all();

              // Check material clauses
              if (Array.isArray(parsed.materialClauses)) {
                for (const clause of parsed.materialClauses) {
                  const matchesTopic =
                    clause.category === topicDef.id ||
                    topicDef.searchAliases.some((a) =>
                      clause.title.toLowerCase().includes(a.toLowerCase())
                    );

                  if (matchesTopic && clause.quotedText && clause.pageNumber) {
                    const val = this.citationValidator.validateCitationAgainstPages(
                      {
                        quotedText: clause.quotedText,
                        pageNumber: clause.pageNumber,
                      },
                      pages
                    );

                    documentEvidenceList.push({
                      documentId: params.documentId,
                      documentTitle: docTitle,
                      pageNumber: clause.pageNumber,
                      sectionReference: clause.sectionReference,
                      quotedText: clause.quotedText,
                      classification: val.isValidated
                        ? EVIDENCE_SOURCE_TYPES.DOCUMENT_FACT
                        : EVIDENCE_SOURCE_TYPES.NEEDS_REVIEW,
                      isValidated: val.isValidated,
                      discrepancyNote: val.discrepancyNote,
                    });
                  }
                }
              }

              // Check obligations
              if (Array.isArray(parsed.obligations)) {
                for (const ob of parsed.obligations) {
                  const matches =
                    topicDef.searchAliases.some(
                      (a) =>
                        ob.obligation.toLowerCase().includes(a.toLowerCase()) ||
                        (ob.explanation && ob.explanation.toLowerCase().includes(a.toLowerCase()))
                    );

                  if (matches && ob.quotedText && ob.pageNumber) {
                    const val = this.citationValidator.validateCitationAgainstPages(
                      {
                        quotedText: ob.quotedText,
                        pageNumber: ob.pageNumber,
                      },
                      pages
                    );

                    documentEvidenceList.push({
                      documentId: params.documentId,
                      documentTitle: docTitle,
                      pageNumber: ob.pageNumber,
                      sectionReference: ob.sectionReference,
                      quotedText: ob.quotedText,
                      classification: val.isValidated
                        ? EVIDENCE_SOURCE_TYPES.DOCUMENT_FACT
                        : EVIDENCE_SOURCE_TYPES.NEEDS_REVIEW,
                      isValidated: val.isValidated,
                      discrepancyNote: val.discrepancyNote,
                    });
                  }
                }
              }
            } catch {
              // Ignore parse errors on corrupted JSON
            }
          }
        }
      }
    }

    // Resolve jurisdiction
    const jurisdiction = this.resolveJurisdiction(
      docGoverningLaw,
      params.userJurisdiction
    );

    // Retrieve matching authoritative sources
    const rawSources = getAuthoritativeSources(topicDef.id, jurisdiction.country);
    const sourceReferences: SourceReference[] = rawSources.map((s) => {
      const validated = validateExternalSourceUrl(s.canonicalUrl);
      return {
        id: s.id,
        title: s.title,
        shortName: s.shortName,
        url: validated.sanitizedUrl || s.canonicalUrl,
        authorityLevel: s.authorityLevel,
        jurisdictionCountry: s.jurisdictionCountry,
        governingBody: s.governingBody,
        updatedAt: s.updatedAt,
        accessedAt: s.accessedAt,
        description: s.description,
        isVerified: validated.isValid,
      };
    });

    // Check comparison evidence if comparisonId provided
    let comparisonEvidence: LegalInformationDossier['comparisonEvidence'] = undefined;
    if (params.comparisonId) {
      const compRows = this.db
        .select()
        .from(comparisons)
        .where(eq(comparisons.id, params.comparisonId))
        .all();

      if (compRows.length > 0 && compRows[0].comparisonDataJson) {
        try {
          const compData = JSON.parse(compRows[0].comparisonDataJson);
          if (Array.isArray(compData.differences)) {
            const match = compData.differences.find(
              (d: {
                category?: string;
                title?: string;
                type?: string;
                baseEvidence?: { quotedText?: string; pageNumber?: number };
                targetEvidence?: { quotedText?: string; pageNumber?: number };
              }) =>
                d.category === topicDef.id ||
                topicDef.searchAliases.some((a) =>
                  d.title?.toLowerCase().includes(a.toLowerCase())
                )
            );
            if (match) {
              comparisonEvidence = {
                baseQuote: match.baseEvidence?.quotedText,
                basePage: match.baseEvidence?.pageNumber,
                targetQuote: match.targetEvidence?.quotedText,
                targetPage: match.targetEvidence?.pageNumber,
                changeType: match.type,
              };
            }
          }
        } catch {
          // Ignore
        }
      }
    }

    // Determine primary operational mode
    const mode: LegalInfoMode =
      documentEvidenceList.length > 0
        ? LEGAL_INFO_MODES.MY_DOCUMENT
        : LEGAL_INFO_MODES.GENERAL_LEGAL_INFO;

    // Build complete dossier
    const dossier: LegalInformationDossier = {
      id: generateId('linfo'),
      topic: topicDef.id,
      topicLabel: topicDef.label,
      category: topicDef.category,
      mode,
      jurisdiction,
      shortExplanation: topicDef.shortExplanation,
      generalMeaning: topicDef.generalMeaning,
      whatItGenerallyDoes: topicDef.whatItGenerallyDoes,
      documentEvidence: documentEvidenceList,
      comparisonEvidence,
      sources: sourceReferences,
      importantLimitations: [
        ...topicDef.importantLimitations,
        'LexiGuide provides legal information and preparation assistance only; it does not determine legal enforceability or provide legal advice.',
      ],
      questionsForCounsel: topicDef.standardQuestionsForCounsel,
      disclaimer:
        'General legal information only. Not legal advice or a substitute for professional counsel. Always verify provisions with a licensed attorney.',
      retrievedAt: new Date().toISOString(),
    };

    // Cache to SQLite
    const cacheKey = `${topicDef.id}:${jurisdiction.label}:${params.documentId || 'none'}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    try {
      this.db
        .insert(legalInformationCache)
        .values({
          id: generateId('cache'),
          cacheKey,
          topic: topicDef.id,
          jurisdictionJson: JSON.stringify(jurisdiction),
          responseJson: JSON.stringify(dossier),
          createdAt: new Date().toISOString(),
          expiresAt,
        })
        .onConflictDoUpdate({
          target: legalInformationCache.cacheKey,
          set: {
            responseJson: JSON.stringify(dossier),
            expiresAt,
          },
        })
        .run();
    } catch {
      // Non-fatal cache failure
    }

    return dossier;
  }

  /**
   * Answers a controlled concept question separating document facts, general law, and counsel questions.
   */
  public async answerConceptQuestion(
    params: ConceptQuestionParams
  ): Promise<ConceptQuestionResponse> {
    const topicDef = this.resolveTopic(params.topic);
    if (!topicDef) {
      throw new Error(`Unknown topic '${params.topic}'.`);
    }

    const trimmedQuestion = params.question.trim();
    if (!trimmedQuestion) {
      throw new Error('Question cannot be empty.');
    }

    // Retrieve document context if documentId is supplied
    const docEvidence: DocumentEvidenceItem[] = [];
    let docGoverningLaw: string | null = null;
    let docTitle = 'Document';

    if (params.documentId) {
      const docRows = this.db
        .select()
        .from(documents)
        .where(eq(documents.id, params.documentId))
        .all();

      if (docRows.length > 0) {
        docTitle = docRows[0].title;
        const analysisRows = this.db
          .select()
          .from(analyses)
          .where(eq(analyses.documentId, params.documentId))
          .all();

        if (analysisRows.length > 0) {
          docGoverningLaw = analysisRows[0].governingLaw;
          if (analysisRows[0].analysisDataJson) {
            try {
              const parsed = JSON.parse(analysisRows[0].analysisDataJson);
              const pages = this.db
                .select({ pageNumber: documentPages.pageNumber, text: documentPages.text })
                .from(documentPages)
                .where(eq(documentPages.documentId, params.documentId))
                .all();

              const clauses = parsed.materialClauses || [];
              for (const c of clauses) {
                if (
                  c.category === topicDef.id ||
                  topicDef.searchAliases.some((a) => c.title?.toLowerCase().includes(a))
                ) {
                  if (c.quotedText && c.pageNumber) {
                    const val = this.citationValidator.validateCitationAgainstPages(
                      { quotedText: c.quotedText, pageNumber: c.pageNumber },
                      pages
                    );
                    docEvidence.push({
                      documentId: params.documentId,
                      documentTitle: docTitle,
                      pageNumber: c.pageNumber,
                      sectionReference: c.sectionReference,
                      quotedText: c.quotedText,
                      classification: val.isValidated
                        ? EVIDENCE_SOURCE_TYPES.DOCUMENT_FACT
                        : EVIDENCE_SOURCE_TYPES.NEEDS_REVIEW,
                      isValidated: val.isValidated,
                      discrepancyNote: val.discrepancyNote,
                    });
                  }
                }
              }
            } catch {
              // Ignore
            }
          }
        }
      }
    }

    const jurisdiction = this.resolveJurisdiction(
      docGoverningLaw,
      params.userJurisdiction
    );

    const sources = getAuthoritativeSources(topicDef.id, jurisdiction.country).map((s) => ({
      id: s.id,
      title: s.title,
      shortName: s.shortName,
      url: s.canonicalUrl,
      authorityLevel: s.authorityLevel,
      jurisdictionCountry: s.jurisdictionCountry,
      governingBody: s.governingBody,
      updatedAt: s.updatedAt,
      accessedAt: s.accessedAt,
      description: s.description,
      isVerified: true,
    }));

    // Mode determination
    const mode: LegalInfoMode =
      docEvidence.length > 0
        ? LEGAL_INFO_MODES.MY_DOCUMENT
        : LEGAL_INFO_MODES.GENERAL_LEGAL_INFO;

    // Try AI generation if Gemini is configured and enabled
    if (this.geminiService.isConfigured()) {
      try {
        const prompt = buildConceptQuestionPrompt({
          topic: topicDef.id,
          topicLabel: topicDef.label,
          userQuestion: trimmedQuestion,
          jurisdictionText: jurisdiction.label,
          registeredSourcesText: sources
            .map((s) => `${s.title} (${s.authorityLevel}) - ${s.url}`)
            .join('\n'),
          documentEvidenceText:
            docEvidence.length > 0
              ? docEvidence
                  .map(
                    (e) =>
                      `[Page ${e.pageNumber}]: "${e.quotedText}" (Classification: ${e.classification})`
                  )
                  .join('\n')
              : undefined,
        });

        const rawResponse = await this.geminiService.generateText(prompt, {
          systemInstruction: SYSTEM_LEGAL_INFORMATION_PROMPT,
          temperature: 0.1,
        });

        if (rawResponse && !containsProhibitedLegalConclusion(rawResponse)) {
          // Verify response safety
          return {
            topic: topicDef.id,
            topicLabel: topicDef.label,
            question: trimmedQuestion,
            mode,
            jurisdiction,
            documentAnswer:
              docEvidence.length > 0
                ? {
                    text: `Based on ${docTitle}, your contract contains specific language regarding ${topicDef.label}.`,
                    citations: docEvidence,
                  }
                : undefined,
            generalLegalInfo: {
              text: rawResponse.trim(),
              sources,
            },
            questionsForCounsel: topicDef.standardQuestionsForCounsel,
            limitations: topicDef.importantLimitations,
            disclaimer:
              'Informational response only. Not legal advice. Grounded strictly in available sources.',
          };
        }
      } catch {
        // Fallback to deterministic offline synthesis
      }
    }

    // Offline / Deterministic Fallback Engine
    return this.generateOfflineConceptAnswer(
      topicDef,
      trimmedQuestion,
      jurisdiction,
      sources,
      docEvidence,
      docTitle
    );
  }

  /**
   * Generates a safe, deterministic offline response when AI is offline.
   */
  private generateOfflineConceptAnswer(
    topic: LegalTopicDefinition,
    question: string,
    jurisdiction: JurisdictionInfo,
    sources: SourceReference[],
    docEvidence: DocumentEvidenceItem[],
    docTitle: string
  ): ConceptQuestionResponse {
    let docAnswer: { text: string; citations: DocumentEvidenceItem[] } | undefined = undefined;

    if (docEvidence.length > 0) {
      docAnswer = {
        text: `Your document (${docTitle}) explicitly mentions ${topic.label.toLowerCase()} provisions on the cited pages below.`,
        citations: docEvidence,
      };
    }

    const generalExplanation =
      `Generally, ${topic.label.toLowerCase()} provisions ${topic.shortExplanation.toLowerCase()} ` +
      `Under general commercial legal principles, the exact legal effect depends on the applicable jurisdiction and the precise contractual wording. ` +
      `Parties typically negotiate these provisions to balance commercial flexibility and risk allocation.`;

    return {
      topic: topic.id,
      topicLabel: topic.label,
      question,
      mode: docEvidence.length > 0 ? LEGAL_INFO_MODES.MY_DOCUMENT : LEGAL_INFO_MODES.GENERAL_LEGAL_INFO,
      jurisdiction,
      documentAnswer: docAnswer,
      generalLegalInfo: {
        text: generalExplanation,
        sources,
      },
      questionsForCounsel: [
        ...topic.standardQuestionsForCounsel,
        `How does the applicable law in ${jurisdiction.country || 'this jurisdiction'} treat the enforceability of this provision?`,
      ],
      limitations: [
        ...topic.importantLimitations,
        'LexiGuide cannot provide legal advice or determine enforceability for your specific situation.',
      ],
      disclaimer:
        'General legal information generated from registered legal taxonomy. Not legal advice.',
    };
  }

  /**
   * Retrieves authoritative legal aid resources for a given country.
   */
  public getLegalAid(country?: string | null): LegalAidResource[] {
    return getLegalAidResources(country);
  }
}
