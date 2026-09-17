/**
 * Unit Tests for Clause Alignment, Normalization & Semantic Delta Engine (LexiGuide AI Phase 5).
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeForComparison,
  categorizeClause,
  extractClausesFromPages,
  detectSemanticFieldChanges,
  alignAndCompareClauses,
} from '@/lib/comparison/alignment';

describe('Phase 5: Comparison Normalization & Clause Alignment', () => {
  describe('normalizeForComparison', () => {
    it('normalizes multiple spaces, tabs, and carriage returns while preserving words, numbers, and punctuation', () => {
      const input = "11.2   Termination.\r\nEither party   may terminate  upon thirty (30) days' notice.";
      const expected = "11.2 Termination.\nEither party may terminate upon thirty (30) days' notice.";
      expect(normalizeForComparison(input)).toBe(expected);
    });

    it('does not remove legal qualifiers or numbers', () => {
      const input = 'Section 4: Pay $15,000 within 10 business days, not to exceed $25,000.';
      expect(normalizeForComparison(input)).toBe(input);
    });
  });

  describe('categorizeClause', () => {
    it('correctly maps clause titles and keywords to AttentionCategory', () => {
      expect(categorizeClause('Termination and Severance')).toBe('TERMINATION');
      expect(categorizeClause('Compensation, Salary and Rent')).toBe('PAYMENT');
      expect(categorizeClause('Indemnification and Hold Harmless')).toBe('INDEMNITY');
      expect(categorizeClause('Limitation of Liability and Damages')).toBe('LIABILITY');
      expect(categorizeClause('Non-Disclosure and Confidential Information')).toBe('CONFIDENTIALITY');
      expect(categorizeClause('Non-Compete and Restrictive Covenants')).toBe('RESTRICTIONS');
      expect(categorizeClause('Term and Renewal Notice')).toBe('RENEWAL');
      expect(categorizeClause('Dispute Resolution and Governing Law')).toBe('DISPUTE_RESOLUTION');
      expect(categorizeClause('Data Privacy and Security')).toBe('PRIVACY');
      expect(categorizeClause('Notice Period and Deadlines')).toBe('DEADLINE');
      expect(categorizeClause('General Miscellaneous Provisions')).toBe('OTHER');
    });
  });

  describe('extractClausesFromPages', () => {
    it('extracts structured clauses based on section headers across multiple pages', () => {
      const pages = [
        {
          pageNumber: 1,
          text: `
1. Parties
This Agreement is between Acme Corp and John Doe.

2. Term
The term shall commence on January 1, 2026.
          `.trim(),
        },
        {
          pageNumber: 2,
          text: `
3. Confidentiality
Recipient shall maintain all proprietary information in strict confidence.
          `.trim(),
        },
      ];

      const clauses = extractClausesFromPages(pages);
      expect(clauses.length).toBe(3);
      expect(clauses[0]?.sectionReference).toBe('1');
      expect(clauses[0]?.pageNumber).toBe(1);
      expect(clauses[1]?.sectionReference).toBe('2');
      expect(clauses[1]?.pageNumber).toBe(1);
      expect(clauses[2]?.sectionReference).toBe('3');
      expect(clauses[2]?.pageNumber).toBe(2);
      expect(clauses[2]?.category).toBe('CONFIDENTIALITY');
    });

    it('handles unnumbered paragraphs gracefully without crashing', () => {
      const pages = [
        {
          pageNumber: 1,
          text: 'This is an introductory paragraph explaining the general background of the transaction between the contracting entities.',
        },
      ];

      const clauses = extractClausesFromPages(pages);
      expect(clauses.length).toBe(1);
      expect(clauses[0]?.pageNumber).toBe(1);
    });
  });

  describe('detectSemanticFieldChanges', () => {
    it('detects notice period changes (e.g. 30 days to 60 days)', () => {
      const base = 'Either party may terminate this agreement upon thirty (30) days notice.';
      const target = 'Either party may terminate this agreement upon sixty (60) days notice.';

      const changes = detectSemanticFieldChanges(base, target);
      expect(changes.length).toBeGreaterThanOrEqual(1);
      const periodChange = changes.find((c) => c.field === 'time_period');
      expect(periodChange).toBeDefined();
      expect(periodChange?.before).toContain('30');
      expect(periodChange?.after).toContain('60');
    });

    it('detects monetary changes (e.g. $5,000 to $10,000)', () => {
      const base = 'Tenant shall pay a security deposit of $5,000 upon execution.';
      const target = 'Tenant shall pay a security deposit of $10,000 upon execution.';

      const changes = detectSemanticFieldChanges(base, target);
      expect(changes.length).toBeGreaterThanOrEqual(1);
      const moneyChange = changes.find((c) => c.field === 'monetary_amount');
      expect(moneyChange).toBeDefined();
      expect(moneyChange?.before).toBe('$5,000');
      expect(moneyChange?.after).toBe('$10,000');
    });

    it('detects newly added indemnification language', () => {
      const base = 'Provider will deliver services using commercially reasonable care.';
      const target = 'Provider will deliver services and indemnify client against third party claims.';

      const changes = detectSemanticFieldChanges(base, target);
      const indemnChange = changes.find((c) => c.field === 'indemnification');
      expect(indemnChange).toBeDefined();
      expect(indemnChange?.after).toContain('Indemnification covenant introduced');
    });
  });

  describe('alignAndCompareClauses', () => {
    it('accurately identifies UNCHANGED, MODIFIED, ADDED, and REMOVED clauses', () => {
      const baseClauses = [
        {
          id: 'b1',
          sectionReference: '1.1',
          title: 'Parties',
          pageNumber: 1,
          quotedText: 'This agreement is between Alpha Inc and Beta LLC.',
          normalizedText: 'This agreement is between Alpha Inc and Beta LLC.',
          category: 'OTHER' as const,
        },
        {
          id: 'b2',
          sectionReference: '2.1',
          title: 'Notice Period',
          pageNumber: 2,
          quotedText: 'Termination requires 30 days written notice.',
          normalizedText: 'Termination requires 30 days written notice.',
          category: 'TERMINATION' as const,
        },
        {
          id: 'b3',
          sectionReference: '3.1',
          title: 'Old Provision',
          pageNumber: 3,
          quotedText: 'This is an obsolete provision that was removed.',
          normalizedText: 'This is an obsolete provision that was removed.',
          category: 'OTHER' as const,
        },
      ];

      const targetClauses = [
        {
          id: 't1',
          sectionReference: '1.1',
          title: 'Parties',
          pageNumber: 1,
          quotedText: 'This agreement is between Alpha Inc and Beta LLC.',
          normalizedText: 'This agreement is between Alpha Inc and Beta LLC.',
          category: 'OTHER' as const,
        },
        {
          id: 't2',
          sectionReference: '2.1',
          title: 'Notice Period',
          pageNumber: 2,
          quotedText: 'Termination requires 60 days written notice.',
          normalizedText: 'Termination requires 60 days written notice.',
          category: 'TERMINATION' as const,
        },
        {
          id: 't4',
          sectionReference: '4.1',
          title: 'New Indemnity',
          pageNumber: 4,
          quotedText: 'Beta LLC shall indemnify Alpha Inc.',
          normalizedText: 'Beta LLC shall indemnify Alpha Inc.',
          category: 'INDEMNITY' as const,
        },
      ];

      const diffs = alignAndCompareClauses(
        baseClauses,
        targetClauses,
        'doc_base',
        'doc_target',
        'Base Doc',
        'Target Doc'
      );

      expect(diffs.length).toBe(4);

      const unchanged = diffs.find((d) => d.type === 'UNCHANGED');
      expect(unchanged).toBeDefined();
      expect(unchanged?.title).toBe('Parties');
      expect(unchanged?.baseEvidence?.pageNumber).toBe(1);
      expect(unchanged?.targetEvidence?.pageNumber).toBe(1);

      const modified = diffs.find((d) => d.type === 'MODIFIED');
      expect(modified).toBeDefined();
      expect(modified?.title).toBe('Notice Period');
      expect(modified?.baseEvidence?.quotedText).toContain('30 days');
      expect(modified?.targetEvidence?.quotedText).toContain('60 days');
      expect(modified?.semanticChanges.length).toBeGreaterThan(0);

      const removed = diffs.find((d) => d.type === 'REMOVED');
      expect(removed).toBeDefined();
      expect(removed?.title).toBe('Old Provision');
      expect(removed?.baseEvidence).toBeDefined();
      expect(removed?.targetEvidence).toBeUndefined();

      const added = diffs.find((d) => d.type === 'ADDED');
      expect(added).toBeDefined();
      expect(added?.title).toBe('New Indemnity');
      expect(added?.targetEvidence).toBeDefined();
      expect(added?.baseEvidence).toBeUndefined();
      expect(added?.category).toBe('INDEMNITY');
    });

    it('ignores trivial whitespace differences and keeps them UNCHANGED without noise', () => {
      const baseClauses = [
        {
          id: 'b1',
          sectionReference: '1.1',
          title: 'Confidentiality',
          pageNumber: 1,
          quotedText: 'Recipient shall keep information   confidential.',
          normalizedText: 'Recipient shall keep information confidential.',
          category: 'CONFIDENTIALITY' as const,
        },
      ];

      const targetClauses = [
        {
          id: 't1',
          sectionReference: '1.1',
          title: 'Confidentiality',
          pageNumber: 1,
          quotedText: 'Recipient shall keep\ninformation confidential.',
          normalizedText: 'Recipient shall keep information confidential.',
          category: 'CONFIDENTIALITY' as const,
        },
      ];

      const diffs = alignAndCompareClauses(
        baseClauses,
        targetClauses,
        'doc_base',
        'doc_target',
        'Base Doc',
        'Target Doc'
      );

      expect(diffs.length).toBe(1);
      expect(diffs[0]?.type).toBe('UNCHANGED');
      expect(diffs[0]?.isSubstantive).toBe(false);
    });
  });
});
