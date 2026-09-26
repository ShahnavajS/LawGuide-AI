import { z } from 'zod';

const text = z.string().trim().min(1).max(20_000);
const shortText = z.string().trim().min(1).max(2_000);
const optionalText = z.string().max(20_000).optional();
const optionalId = z.string().min(1).max(200).optional();
const pageNumber = z.number().int().positive().max(100_000);

const attentionLevel = z.enum(['HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL']);
const attentionCategory = z.enum([
  'PAYMENT', 'TERMINATION', 'RENEWAL', 'LIABILITY', 'INDEMNITY',
  'CONFIDENTIALITY', 'RESTRICTIONS', 'DISPUTE_RESOLUTION', 'PRIVACY',
  'DEADLINE', 'OTHER',
]);

const cited = {
  pageNumber,
  quotedText: shortText,
};

export const legalXRayModelSchema = z.object({
  overview: z.object({
    documentType: optionalText,
    title: optionalText,
    summary: optionalText,
    governingLaw: optionalText,
    purpose: optionalText,
  }).strict().optional(),
  parties: z.array(z.object({
    id: optionalId,
    name: text,
    role: text,
    ...cited,
  }).strict()).max(100).optional(),
  keyDates: z.array(z.object({
    id: optionalId,
    label: text,
    dateValue: text,
    description: text,
    ...cited,
  }).strict()).max(100).optional(),
  obligations: z.array(z.object({
    id: optionalId,
    party: text,
    obligation: text,
    explanation: text,
    conditionOrDeadline: optionalText,
    attentionLevel: attentionLevel.optional(),
    sectionReference: optionalText,
    ...cited,
  }).strict()).max(100).optional(),
  rights: z.array(z.object({
    id: optionalId,
    party: text,
    right: text,
    explanation: text,
    ...cited,
  }).strict()).max(100).optional(),
  financialTerms: z.array(z.object({
    id: optionalId,
    term: text,
    amountOrValue: text,
    explanation: text,
    ...cited,
  }).strict()).max(100).optional(),
  materialClauses: z.array(z.object({
    id: optionalId,
    category: attentionCategory.optional(),
    title: text,
    summary: text,
    plainLanguage: text,
    sectionReference: optionalText,
    ...cited,
  }).strict()).max(100).optional(),
  attentionAreas: z.array(z.object({
    id: optionalId,
    category: attentionCategory.optional(),
    attentionLevel: attentionLevel.optional(),
    title: text,
    description: text,
    whyItMatters: text,
    ...cited,
  }).strict()).max(100).optional(),
  lawyerQuestions: z.array(z.object({
    id: optionalId,
    category: optionalText,
    question: text,
    groundedContext: optionalText,
  }).strict()).max(100).optional(),
}).strict();

const comparisonEvidenceSchema = z.object({
  pageNumber,
  quotedText: shortText,
  sectionReference: optionalText,
}).strict();

export const comparisonModelSchema = z.object({
  summary: z.object({
    plainLanguage: optionalText,
    baseGoverningLaw: optionalText,
    targetGoverningLaw: optionalText,
  }).strict().optional(),
  differences: z.array(z.object({
    id: optionalId,
    type: z.enum(['ADDED', 'REMOVED', 'MODIFIED', 'UNCHANGED']),
    category: attentionCategory.optional(),
    title: text,
    sectionReference: optionalText,
    baseEvidence: comparisonEvidenceSchema.optional(),
    targetEvidence: comparisonEvidenceSchema.optional(),
    changeSummary: text,
    semanticChanges: z.array(z.object({
      field: text,
      before: z.string().max(20_000),
      after: z.string().max(20_000),
      description: text,
    }).strict()).max(50).optional(),
    practicalImplications: text,
    attentionLevel: attentionLevel.optional(),
    lawyerQuestion: optionalText,
    isSubstantive: z.boolean().optional(),
  }).strict()).max(200).optional(),
  lawyerQuestions: z.array(z.object({
    id: optionalId,
    category: optionalText,
    question: text,
    groundedContext: text,
  }).strict()).max(100).optional(),
}).strict();

export const preparationModelSchema = z.object({
  overview: z.object({
    title: optionalText,
    documentType: optionalText,
    governingLaw: optionalText,
    purpose: optionalText,
    consultationDate: optionalText,
  }).strict().optional(),
  keyFacts: z.array(z.object({
    id: optionalId,
    label: text,
    value: text,
    pageNumber: pageNumber.optional(),
    quotedText: optionalText,
    documentId: optionalId,
  }).strict()).max(100).optional(),
  keyDates: z.array(z.object({
    id: optionalId,
    label: text,
    dateValue: text,
    description: text,
    pageNumber: pageNumber.optional(),
    quotedText: optionalText,
    documentId: optionalId,
  }).strict()).max(100).optional(),
  missingInformation: z.array(z.object({
    id: optionalId,
    item: text,
    whyItMatters: text,
  }).strict()).max(100).optional(),
  documentsToBring: z.array(z.object({
    id: optionalId,
    documentName: text,
    reason: text,
    isGeneralSuggestion: z.boolean().optional(),
  }).strict()).max(100).optional(),
  lawyerQuestions: z.array(z.object({
    id: optionalId,
    category: optionalText,
    question: text,
    whyItMatters: optionalText,
    groundedContext: optionalText,
    pageNumber: pageNumber.optional(),
    quotedText: optionalText,
  }).strict()).max(100).optional(),
  checklist: z.array(z.object({
    id: optionalId,
    category: z.enum(['BEFORE_CONSULTATION', 'FOR_THE_LAWYER', 'AFTER_CONSULTATION']),
    item: text,
    whyRelevant: text,
    isCompleted: z.boolean().optional(),
  }).strict()).max(100).optional(),
}).strict();

export const relationshipModelSchema = z.array(z.object({
  sourceDocumentId: text,
  targetDocumentId: text,
  relationshipType: z.enum([
    'REFERENCES', 'AMENDS', 'INCORPORATES', 'ATTACHES', 'MENTIONS',
    'DATES_BACK_TO', 'RELATED_TO',
  ]),
  description: text,
  sourcePage: pageNumber.optional(),
  sourceQuote: optionalText,
  targetPage: pageNumber.optional(),
  targetQuote: optionalText,
}).strict()).max(100);

export const matterAnswerModelSchema = z.object({
  answer: text,
  citations: z.array(z.object({
    documentId: text,
    documentTitle: text,
    pageNumber,
    quotedText: shortText,
  }).strict()).max(50),
  crossDocumentObservations: z.array(text).max(50).optional(),
  suggestedQuestionsForCounsel: z.array(text).max(50).optional(),
}).strict();

export const counselQuestionsModelSchema = z.array(z.object({
  id: optionalId,
  category: optionalText,
  question: text,
  rationale: optionalText,
  sourceType: z.enum(['DOCUMENT', 'CONSISTENCY', 'RELATIONSHIP', 'USER_CONTEXT']),
  sourceReference: optionalText,
  documentId: optionalId,
  documentTitle: optionalText,
  pageNumber: pageNumber.optional(),
  quotedText: optionalText,
  isUserProvided: z.boolean().optional(),
}).strict()).max(100);

export const documentAnswerModelSchema = z.object({
  answer: z.string().max(3_000),
  citations: z.array(z.object({
    pageNumber,
    quotedText: shortText,
  }).strict()).max(5),
}).strict();

export type LegalXRayModelOutput = z.infer<typeof legalXRayModelSchema>;
export type ComparisonModelOutput = z.infer<typeof comparisonModelSchema>;
export type PreparationModelOutput = z.infer<typeof preparationModelSchema>;
export type RelationshipModelOutput = z.infer<typeof relationshipModelSchema>;
export type MatterAnswerModelOutput = z.infer<typeof matterAnswerModelSchema>;
export type CounselQuestionsModelOutput = z.infer<typeof counselQuestionsModelSchema>;
export type DocumentAnswerModelOutput = z.infer<typeof documentAnswerModelSchema>;

function providerSchema(schema: z.ZodType): unknown {
  const jsonSchema = z.toJSONSchema(schema);
  delete jsonSchema.$schema;
  return jsonSchema;
}

export const legalXRayProviderSchema = providerSchema(legalXRayModelSchema);
export const comparisonProviderSchema = providerSchema(comparisonModelSchema);
export const preparationProviderSchema = providerSchema(preparationModelSchema);
export const relationshipProviderSchema = providerSchema(relationshipModelSchema);
export const matterAnswerProviderSchema = providerSchema(matterAnswerModelSchema);
export const counselQuestionsProviderSchema = providerSchema(counselQuestionsModelSchema);
export const documentAnswerProviderSchema = providerSchema(documentAnswerModelSchema);
