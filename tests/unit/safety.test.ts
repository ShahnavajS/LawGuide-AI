import { describe, it, expect } from 'vitest';
import {
  LEGAL_DISCLAIMERS,
  EVIDENCE_CLASSIFICATIONS,
  LEGAL_GUARDRAILS,
  SYSTEM_SAFETY_DIRECTIVE,
} from '@/lib/ai/safety';

describe('Legal Safety Framework', () => {
  it('contains mandatory disclaimer regarding non-attorney status', () => {
    expect(LEGAL_DISCLAIMERS.GLOBAL_FOOTER).toContain('not legal advice');
    expect(LEGAL_DISCLAIMERS.GLOBAL_FOOTER).toContain('attorney-client relationship');
  });

  it('defines all 4 evidence classification tiers', () => {
    const keys = Object.keys(EVIDENCE_CLASSIFICATIONS);
    expect(keys).toContain('DOCUMENT_FACT');
    expect(keys).toContain('AI_INTERPRETATION');
    expect(keys).toContain('GENERAL_INFO');
    expect(keys).toContain('NEEDS_REVIEW');
  });

  it('includes strict prohibitions in system directive against declaring contracts illegal', () => {
    expect(SYSTEM_SAFETY_DIRECTIVE).toContain('NOT an attorney');
    expect(SYSTEM_SAFETY_DIRECTIVE).toContain('NEVER declare a clause "illegal"');
  });

  it('prohibits outcome prediction and litigation advice in guardrails', () => {
    expect(LEGAL_GUARDRAILS.STRICTLY_PROHIBITED).toContain(
      'Predicting judicial or arbitration outcomes'
    );
    expect(LEGAL_GUARDRAILS.STRICTLY_PROHIBITED).toContain(
      'Advising whether a party should sue, settle, or breach a contract'
    );
  });
});
