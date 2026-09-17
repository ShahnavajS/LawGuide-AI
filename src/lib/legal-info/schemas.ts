/**
 * Zod Schemas & TypeScript Definitions for Legal Information Navigator (Phase 7).
 */

import { z } from 'zod';
import {
  EVIDENCE_SOURCE_TYPES,
  LEGAL_INFO_MODES,
  JURISDICTION_SOURCE_TYPES,
  SOURCE_TRUST_LEVELS,
} from '@/lib/ai/safety';

export const JurisdictionProvenanceSchema = z.enum([
  JURISDICTION_SOURCE_TYPES.DOCUMENT_JURISDICTION,
  JURISDICTION_SOURCE_TYPES.USER_PROVIDED_JURISDICTION,
  JURISDICTION_SOURCE_TYPES.JURISDICTION_NOT_ESTABLISHED,
]);

export const JurisdictionInfoSchema = z.object({
  country: z.string().nullable(),
  region: z.string().nullable(),
  source: JurisdictionProvenanceSchema,
  label: z.string(),
});

export type JurisdictionInfo = z.infer<typeof JurisdictionInfoSchema>;

export const SourceTrustLevelSchema = z.enum([
  SOURCE_TRUST_LEVELS.PRIMARY,
  SOURCE_TRUST_LEVELS.SECONDARY,
  SOURCE_TRUST_LEVELS.GENERAL,
]);

export const SourceReferenceSchema = z.object({
  id: z.string(),
  title: z.string(),
  shortName: z.string(),
  url: z.string().url(),
  authorityLevel: SourceTrustLevelSchema,
  jurisdictionCountry: z.string(),
  governingBody: z.string(),
  updatedAt: z.string(),
  accessedAt: z.string(),
  description: z.string(),
  isVerified: z.boolean().default(true),
});

export type SourceReference = z.infer<typeof SourceReferenceSchema>;

export const DocumentEvidenceItemSchema = z.object({
  documentId: z.string(),
  documentTitle: z.string(),
  pageNumber: z.number().int().positive(),
  sectionReference: z.string().optional(),
  quotedText: z.string(),
  classification: z.enum([
    EVIDENCE_SOURCE_TYPES.DOCUMENT_FACT,
    EVIDENCE_SOURCE_TYPES.AI_INTERPRETATION,
    EVIDENCE_SOURCE_TYPES.GENERAL_INFO,
    EVIDENCE_SOURCE_TYPES.NEEDS_REVIEW,
    EVIDENCE_SOURCE_TYPES.USER_PROVIDED,
  ]),
  isValidated: z.boolean().optional(),
  discrepancyNote: z.string().optional(),
});

export type DocumentEvidenceItem = z.infer<typeof DocumentEvidenceItemSchema>;

export const LegalInformationDossierSchema = z.object({
  id: z.string(),
  topic: z.string(),
  topicLabel: z.string(),
  category: z.string(),
  mode: z.enum([
    LEGAL_INFO_MODES.MY_DOCUMENT,
    LEGAL_INFO_MODES.GENERAL_LEGAL_INFO,
    LEGAL_INFO_MODES.PREPARE_FOR_COUNSEL,
  ]),
  jurisdiction: JurisdictionInfoSchema,
  shortExplanation: z.string(),
  generalMeaning: z.string(),
  whatItGenerallyDoes: z.array(z.string()),
  documentEvidence: z.array(DocumentEvidenceItemSchema),
  comparisonEvidence: z
    .object({
      baseQuote: z.string().optional(),
      basePage: z.number().optional(),
      targetQuote: z.string().optional(),
      targetPage: z.number().optional(),
      changeType: z.string(),
    })
    .optional(),
  sources: z.array(SourceReferenceSchema),
  importantLimitations: z.array(z.string()),
  questionsForCounsel: z.array(z.string()),
  disclaimer: z.string(),
  retrievedAt: z.string(),
});

export type LegalInformationDossier = z.infer<typeof LegalInformationDossierSchema>;

export const ConceptQuestionRequestSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  question: z.string().min(3, 'Question must be at least 3 characters long'),
  documentId: z.string().optional(),
  jurisdiction: z
    .object({
      country: z.string().optional(),
      region: z.string().optional(),
      source: JurisdictionProvenanceSchema.optional(),
    })
    .optional(),
  contextQuote: z.string().optional(),
});

export type ConceptQuestionRequest = z.infer<typeof ConceptQuestionRequestSchema>;

export const ConceptQuestionResponseSchema = z.object({
  topic: z.string(),
  topicLabel: z.string(),
  question: z.string(),
  mode: z.enum([
    LEGAL_INFO_MODES.MY_DOCUMENT,
    LEGAL_INFO_MODES.GENERAL_LEGAL_INFO,
    LEGAL_INFO_MODES.PREPARE_FOR_COUNSEL,
  ]),
  jurisdiction: JurisdictionInfoSchema,
  documentAnswer: z
    .object({
      text: z.string(),
      citations: z.array(DocumentEvidenceItemSchema),
    })
    .optional(),
  generalLegalInfo: z.object({
    text: z.string(),
    sources: z.array(SourceReferenceSchema),
  }),
  questionsForCounsel: z.array(z.string()),
  limitations: z.array(z.string()),
  disclaimer: z.string(),
});

export type ConceptQuestionResponse = z.infer<typeof ConceptQuestionResponseSchema>;
