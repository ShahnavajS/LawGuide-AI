/**
 * Unit Tests for Legal Information Taxonomy (LexiGuide AI Phase 7).
 */

import { describe, it, expect } from 'vitest';
import {
  LEGAL_TOPICS,
  resolveTaxonomyTopic,
  searchTaxonomyTopics,
} from '@/lib/legal-info/taxonomy';

describe('Phase 7: Legal Information Taxonomy', () => {
  it('contains all 29 controlled core contractual topics', () => {
    const topicKeys = Object.keys(LEGAL_TOPICS);
    expect(topicKeys.length).toBeGreaterThanOrEqual(29);

    const requiredTopics = [
      'TERMINATION',
      'NOTICE_PERIOD',
      'RENEWAL',
      'PAYMENT',
      'INTEREST',
      'PENALTIES',
      'INDEMNIFICATION',
      'LIABILITY',
      'LIMITATION_OF_LIABILITY',
      'CONFIDENTIALITY',
      'NON_DISCLOSURE',
      'INTELLECTUAL_PROPERTY',
      'DATA_PRIVACY',
      'GOVERNING_LAW',
      'JURISDICTION',
      'DISPUTE_RESOLUTION',
      'ARBITRATION',
      'MEDIATION',
      'FORCE_MAJEURE',
      'REPRESENTATIONS',
      'WARRANTIES',
      'ASSIGNMENT',
      'NON_COMPETE',
      'NON_SOLICITATION',
      'SEVERABILITY',
      'ENTIRE_AGREEMENT',
      'AMENDMENT',
      'WAIVER',
      'DEFINITIONS',
    ];

    for (const required of requiredTopics) {
      expect(LEGAL_TOPICS[required]).toBeDefined();
      expect(LEGAL_TOPICS[required].id).toBe(required);
      expect(LEGAL_TOPICS[required].label.length).toBeGreaterThan(0);
      expect(LEGAL_TOPICS[required].shortExplanation.length).toBeGreaterThan(10);
      expect(LEGAL_TOPICS[required].generalMeaning.length).toBeGreaterThan(20);
      expect(LEGAL_TOPICS[required].whatItGenerallyDoes.length).toBeGreaterThan(0);
      expect(LEGAL_TOPICS[required].standardQuestionsForCounsel.length).toBeGreaterThan(0);
      expect(LEGAL_TOPICS[required].importantLimitations.length).toBeGreaterThan(0);
    }
  });

  it('resolves exact topic IDs case-insensitively and with hyphens', () => {
    expect(resolveTaxonomyTopic('TERMINATION')?.id).toBe('TERMINATION');
    expect(resolveTaxonomyTopic('termination')?.id).toBe('TERMINATION');
    expect(resolveTaxonomyTopic('notice-period')?.id).toBe('NOTICE_PERIOD');
    expect(resolveTaxonomyTopic('limitation_of_liability')?.id).toBe('LIMITATION_OF_LIABILITY');
  });

  it('resolves search aliases to canonical topics', () => {
    expect(resolveTaxonomyTopic('indemnity')?.id).toBe('INDEMNIFICATION');
    expect(resolveTaxonomyTopic('hold harmless')?.id).toBe('INDEMNIFICATION');
    expect(resolveTaxonomyTopic('evergreen')?.id).toBe('RENEWAL');
    expect(resolveTaxonomyTopic('nda')?.id).toBe('NON_DISCLOSURE');
    expect(resolveTaxonomyTopic('arbitral tribunal')?.id).toBe('ARBITRATION');
    expect(resolveTaxonomyTopic('act of god')?.id).toBe('FORCE_MAJEURE');
    expect(resolveTaxonomyTopic('blue pencil')?.id).toBe('SEVERABILITY');
  });

  it('returns null for empty or completely unknown queries', () => {
    expect(resolveTaxonomyTopic('')).toBeNull();
    expect(resolveTaxonomyTopic('   ')).toBeNull();
    expect(resolveTaxonomyTopic('quantum_physics_formula')).toBeNull();
  });

  it('searches topics with query filtering and returns all when query is empty', () => {
    const all = searchTaxonomyTopics('');
    expect(all.length).toBeGreaterThanOrEqual(29);

    const indemnitySearch = searchTaxonomyTopics('indemn');
    expect(indemnitySearch.some((t) => t.id === 'INDEMNIFICATION')).toBe(true);

    const disputeSearch = searchTaxonomyTopics('dispute');
    expect(disputeSearch.length).toBeGreaterThan(0);
  });
});
