/**
 * Deterministic Section and Clause Alignment Engine (LexiGuide AI Phase 5).
 *
 * Operates at the DOCUMENT -> SECTION -> CLAUSE -> SEMANTIC CHANGE level.
 * Normalizes harmless formatting/extraction artifacts while preserving strict legal wording,
 * numbers, exceptions, and punctuation.
 */

import {
  ComparisonChangeType,
  ComparisonDifferenceItem,
  SemanticFieldChange,
  AttentionCategory,
  AttentionLevel,
} from '@/lib/ai/schemas';

export interface ExtractedClause {
  id: string;
  sectionReference?: string;
  title: string;
  pageNumber: number;
  quotedText: string;
  normalizedText: string;
  category: AttentionCategory;
}

/**
 * Normalizes whitespace and linebreaks without altering words, numbers, punctuation, or legal qualifiers.
 */
export function normalizeForComparison(text: string): string {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\s+\n/g, '\n')
    .trim();
}

/**
 * Categorizes a clause title or excerpt into a legal domain.
 */
export function categorizeClause(text: string): AttentionCategory {
  const lower = text.toLowerCase();
  if (lower.includes('terminat') || lower.includes('severance') || lower.includes('cancel')) return 'TERMINATION';
  if (lower.includes('pay') || lower.includes('compensation') || lower.includes('fee') || lower.includes('salary') || lower.includes('rent') || lower.includes('deposit')) return 'PAYMENT';
  if (lower.includes('indemn') || lower.includes('hold harmless')) return 'INDEMNITY';
  if (lower.includes('liabilit') || lower.includes('limitation of') || lower.includes('damages')) return 'LIABILITY';
  if (lower.includes('confident') || lower.includes('non-disclosure') || lower.includes('proprietary')) return 'CONFIDENTIALITY';
  if (lower.includes('non-compete') || lower.includes('non-solicit') || lower.includes('restrictive') || lower.includes('exclusiv')) return 'RESTRICTIONS';
  if (lower.includes('renew') || lower.includes('extension') || lower.includes('term of')) return 'RENEWAL';
  if (lower.includes('dispute') || lower.includes('arbitrat') || lower.includes('jurisdiction') || lower.includes('governing law')) return 'DISPUTE_RESOLUTION';
  if (lower.includes('privacy') || lower.includes('gdpr') || lower.includes('personal data')) return 'PRIVACY';
  if (lower.includes('deadline') || lower.includes('notice period') || lower.includes('time is of the essence')) return 'DEADLINE';
  return 'OTHER';
}

/**
 * Extracts clauses and sections from document pages.
 */
export function extractClausesFromPages(
  pages: Array<{ pageNumber: number; text: string }>
): ExtractedClause[] {
  const clauses: ExtractedClause[] = [];
  let clauseIndex = 1;

  for (const page of pages) {
    const lines = page.text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    let currentSectionRef: string | undefined;
    let currentTitle: string | undefined;
    let currentLines: string[] = [];

    const flushClause = () => {
      if (currentLines.length > 0) {
        const fullText = currentLines.join(' ').trim();
        if (fullText.length > 15) {
          const title = currentTitle || currentLines[0].slice(0, 50);
          clauses.push({
            id: `clause_${clauseIndex++}`,
            sectionReference: currentSectionRef,
            title,
            pageNumber: page.pageNumber,
            quotedText: fullText,
            normalizedText: normalizeForComparison(fullText),
            category: categorizeClause(title + ' ' + fullText),
          });
        }
        currentLines = [];
        currentSectionRef = undefined;
        currentTitle = undefined;
      }
    };

    for (const line of lines) {
      // Regex detecting section headers: e.g. "1.1 Termination", "Section 4. Payment", "Article 2: Term"
      const sectionMatch = line.match(/^(?:(?:Section|Article|Clause)\s+)?(\d+(?:\.\d+)*)[:.]?\s*(.*)$/i);
      if (sectionMatch && sectionMatch[1] && (sectionMatch[2] || line.length < 80)) {
        flushClause();
        currentSectionRef = sectionMatch[1];
        currentTitle = sectionMatch[2] || `Section ${sectionMatch[1]}`;
        currentLines.push(line);
      } else {
        currentLines.push(line);
      }
    }

    flushClause();
  }

  // Fallback: If no structured sections detected (e.g. unnumbered paragraphs), break into substantial paragraphs
  if (clauses.length === 0) {
    for (const page of pages) {
      const paragraphs = page.text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 20);
      for (const para of paragraphs) {
        const firstLine = para.split('\n')[0].slice(0, 60);
        clauses.push({
          id: `clause_${clauseIndex++}`,
          title: firstLine,
          pageNumber: page.pageNumber,
          quotedText: para,
          normalizedText: normalizeForComparison(para),
          category: categorizeClause(para),
        });
      }
    }
  }

  return clauses;
}

/**
 * Detects numerical, monetary, duration, or date changes between two texts.
 */
export function detectSemanticFieldChanges(baseText: string, targetText: string): SemanticFieldChange[] {
  const changes: SemanticFieldChange[] = [];

  // 1. Notice periods / Days (e.g. "30 days" -> "60 days", "thirty (30) days" -> "sixty (60) days")
  const noticePattern = /(\b\w+\s*\(\d+\)|\b\d+)\s*(?:days?|business days?|calendar days?|months?|weeks?|years?)\b/gi;
  const basePeriods = baseText.match(noticePattern) || [];
  const targetPeriods = targetText.match(noticePattern) || [];

  const firstBasePeriod = basePeriods[0];
  const firstTargetPeriod = targetPeriods[0];
  if (firstBasePeriod && firstTargetPeriod) {
    const b = firstBasePeriod.trim();
    const t = firstTargetPeriod.trim();
    if (b.toLowerCase() !== t.toLowerCase()) {
      changes.push({
        field: 'time_period',
        before: b,
        after: t,
        description: `The stated duration or notice period changed from ${b} to ${t}.`,
      });
    }
  }

  // 2. Monetary amounts (e.g. "$5,000" -> "$10,000", "5,000 USD" -> "10,000 USD")
  const moneyPattern = /(?:\$|€|£|USD|EUR|GBP)\s*[\d,]+(?:\.\d{2})?|\b[\d,]+(?:\.\d{2})?\s*(?:dollars|euros|pounds|USD)\b/gi;
  const baseMoney = baseText.match(moneyPattern) || [];
  const targetMoney = targetText.match(moneyPattern) || [];

  const firstBaseMoney = baseMoney[0];
  const firstTargetMoney = targetMoney[0];
  if (firstBaseMoney && firstTargetMoney) {
    const b = firstBaseMoney.trim();
    const t = firstTargetMoney.trim();
    if (b.toLowerCase() !== t.toLowerCase()) {
      changes.push({
        field: 'monetary_amount',
        before: b,
        after: t,
        description: `The stated monetary figure changed from ${b} to ${t}.`,
      });
    }
  }

  // 3. Indemnification additions/removals
  const baseIndemn = /indemnif/i.test(baseText);
  const targetIndemn = /indemnif/i.test(targetText);
  if (!baseIndemn && targetIndemn) {
    changes.push({
      field: 'indemnification',
      before: 'None stated in this clause',
      after: 'Indemnification covenant introduced',
      description: 'The revised clause introduces an affirmative indemnification commitment.',
    });
  } else if (baseIndemn && !targetIndemn) {
    changes.push({
      field: 'indemnification',
      before: 'Indemnification covenant present',
      after: 'Removed in revised clause',
      description: 'The indemnification language present in the base document was removed.',
    });
  }

  // 4. Liability limitation / Caps
  const baseCap = /liability.*cap|limit.*liability/i.test(baseText);
  const targetCap = /liability.*cap|limit.*liability/i.test(targetText);
  if (baseCap !== targetCap) {
    changes.push({
      field: 'liability_limitation',
      before: baseCap ? 'Liability limitation clause present' : 'No express liability limitation',
      after: targetCap ? 'Liability limitation clause present' : 'No express liability limitation',
      description: 'The phrasing regarding limitation of liability was substantively altered.',
    });
  }

  return changes;
}

/**
 * Determines attention level for a change based on category and semantic delta.
 */
function deriveAttentionLevel(
  type: ComparisonChangeType,
  category: AttentionCategory,
  semanticChanges: SemanticFieldChange[]
): AttentionLevel {
  if (type === 'UNCHANGED') return 'INFORMATIONAL';
  if (category === 'LIABILITY' || category === 'INDEMNITY' || category === 'TERMINATION') {
    return 'HIGH';
  }
  if (semanticChanges.length > 0 || category === 'PAYMENT' || category === 'RESTRICTIONS' || category === 'DEADLINE') {
    return 'MEDIUM';
  }
  if (type === 'ADDED' || type === 'REMOVED') {
    return 'MEDIUM';
  }
  return 'LOW';
}

/**
 * Builds grounded questions for counsel based on the detected change.
 */
function deriveLawyerQuestion(
  type: ComparisonChangeType,
  category: AttentionCategory,
  title: string,
  semanticChanges: SemanticFieldChange[]
): string {
  if (semanticChanges.length > 0) {
    const sc = semanticChanges[0];
    return `Does changing ${sc.field.replace(/_/g, ' ')} from "${sc.before}" to "${sc.after}" in ${title} align with our legal and commercial expectations under the governing law?`;
  }
  if (type === 'ADDED') {
    return `What new legal or operational commitments are created by the addition of the ${title} clause?`;
  }
  if (type === 'REMOVED') {
    return `Does omitting the previous ${title} provision remove any protections or remedies previously relied upon?`;
  }
  if (type === 'MODIFIED') {
    return `How does the modified phrasing in ${title} impact the rights and liabilities of the parties?`;
  }
  return `Is the phrasing of ${title} standard and acceptable under current applicable practice?`;
}

/**
 * Deterministic Clause Alignment Engine:
 * Compares two sets of extracted clauses and generates structured difference items.
 */
export function alignAndCompareClauses(
  baseClauses: ExtractedClause[],
  targetClauses: ExtractedClause[],
  baseDocId: string,
  targetDocId: string,
  baseTitle: string,
  targetTitle: string
): ComparisonDifferenceItem[] {
  const differences: ComparisonDifferenceItem[] = [];
  const matchedTargetIds = new Set<string>();
  let diffIndex = 1;

  for (const base of baseClauses) {
    // 1. Attempt exact section reference match
    let match = base.sectionReference
      ? targetClauses.find((t) => !matchedTargetIds.has(t.id) && t.sectionReference === base.sectionReference)
      : undefined;

    // 2. Fallback: match by title similarity
    if (!match) {
      match = targetClauses.find(
        (t) =>
          !matchedTargetIds.has(t.id) &&
          (t.title.toLowerCase() === base.title.toLowerCase() ||
            (t.title.length > 10 && base.title.toLowerCase().includes(t.title.toLowerCase())))
      );
    }

    if (match) {
      matchedTargetIds.add(match.id);
      const isExactNormalized = base.normalizedText === match.normalizedText;

      if (isExactNormalized) {
        differences.push({
          id: `diff_${diffIndex++}`,
          type: 'UNCHANGED',
          category: base.category,
          title: base.title,
          sectionReference: base.sectionReference || match.sectionReference,
          baseEvidence: {
            documentId: baseDocId,
            documentTitle: baseTitle,
            pageNumber: base.pageNumber,
            sectionReference: base.sectionReference,
            quotedText: base.quotedText,
            classification: 'DOCUMENT_FACT',
          },
          targetEvidence: {
            documentId: targetDocId,
            documentTitle: targetTitle,
            pageNumber: match.pageNumber,
            sectionReference: match.sectionReference,
            quotedText: match.quotedText,
            classification: 'DOCUMENT_FACT',
          },
          changeSummary: 'No substantive textual modifications identified in this clause.',
          semanticChanges: [],
          practicalImplications: 'The terms and language of this clause remain substantively identical between the versions.',
          attentionLevel: 'INFORMATIONAL',
          isSubstantive: false,
        });
      } else {
        const semanticChanges = detectSemanticFieldChanges(base.quotedText, match.quotedText);
        const attentionLevel = deriveAttentionLevel('MODIFIED', base.category, semanticChanges);
        const changeSummary =
          semanticChanges.length > 0
            ? semanticChanges.map((sc) => sc.description).join(' ')
            : `The text of ${base.title} was revised between the base and target documents.`;

        differences.push({
          id: `diff_${diffIndex++}`,
          type: 'MODIFIED',
          category: base.category,
          title: base.title,
          sectionReference: base.sectionReference || match.sectionReference,
          baseEvidence: {
            documentId: baseDocId,
            documentTitle: baseTitle,
            pageNumber: base.pageNumber,
            sectionReference: base.sectionReference,
            quotedText: base.quotedText,
            classification: 'DOCUMENT_FACT',
          },
          targetEvidence: {
            documentId: targetDocId,
            documentTitle: targetTitle,
            pageNumber: match.pageNumber,
            sectionReference: match.sectionReference,
            quotedText: match.quotedText,
            classification: 'DOCUMENT_FACT',
          },
          changeSummary,
          semanticChanges,
          practicalImplications:
            'This modification alters specific terms or conditions; review with counsel to evaluate operational and legal consequences.',
          attentionLevel,
          lawyerQuestion: deriveLawyerQuestion('MODIFIED', base.category, base.title, semanticChanges),
          isSubstantive: true,
        });
      }
    } else {
      // Unmatched base clause -> REMOVED
      const attentionLevel = deriveAttentionLevel('REMOVED', base.category, []);
      differences.push({
        id: `diff_${diffIndex++}`,
        type: 'REMOVED',
        category: base.category,
        title: base.title,
        sectionReference: base.sectionReference,
        baseEvidence: {
          documentId: baseDocId,
          documentTitle: baseTitle,
          pageNumber: base.pageNumber,
          sectionReference: base.sectionReference,
          quotedText: base.quotedText,
          classification: 'DOCUMENT_FACT',
        },
        changeSummary: `The provision "${base.title}" appears in the base document but has no corresponding section in the revised document.`,
        semanticChanges: [],
        practicalImplications:
          'The omission of this provision removes the obligations, rights, or conditions previously expressed in this section.',
        attentionLevel,
        lawyerQuestion: deriveLawyerQuestion('REMOVED', base.category, base.title, []),
        isSubstantive: true,
      });
    }
  }

  // Target clauses not matched to any base clause -> ADDED
  for (const target of targetClauses) {
    if (!matchedTargetIds.has(target.id)) {
      const attentionLevel = deriveAttentionLevel('ADDED', target.category, []);
      differences.push({
        id: `diff_${diffIndex++}`,
        type: 'ADDED',
        category: target.category,
        title: target.title,
        sectionReference: target.sectionReference,
        targetEvidence: {
          documentId: targetDocId,
          documentTitle: targetTitle,
          pageNumber: target.pageNumber,
          sectionReference: target.sectionReference,
          quotedText: target.quotedText,
          classification: 'DOCUMENT_FACT',
        },
        changeSummary: `The provision "${target.title}" is present in the revised document but was not identified in the base document.`,
        semanticChanges: [],
        practicalImplications:
          'This newly introduced section establishes obligations, conditions, or terms not present in the original version.',
        attentionLevel,
        lawyerQuestion: deriveLawyerQuestion('ADDED', target.category, target.title, []),
        isSubstantive: true,
      });
    }
  }

  return differences;
}
