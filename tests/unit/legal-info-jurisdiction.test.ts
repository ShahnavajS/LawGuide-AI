/**
 * Unit Tests for Jurisdiction Resolution Engine (LexiGuide AI Phase 7).
 */

import { describe, it, expect } from 'vitest';
import { LegalInformationService } from '@/lib/legal-info/service';
import { JURISDICTION_SOURCE_TYPES } from '@/lib/ai/safety';

describe('Phase 7: Jurisdiction Resolution & Non-Inference Engine', () => {
  const service = new LegalInformationService();

  it('classifies explicit document-established governing law as DOCUMENT_JURISDICTION', () => {
    const result = service.resolveJurisdiction('State of New York, USA');
    expect(result.source).toBe(JURISDICTION_SOURCE_TYPES.DOCUMENT_JURISDICTION);
    expect(result.country).toBe('State of New York, USA');
    expect(result.label).toContain('DOCUMENT JURISDICTION');
    expect(result.label).toContain('State of New York, USA');
  });

  it('classifies user-selected country and region as USER_PROVIDED_JURISDICTION', () => {
    const result = service.resolveJurisdiction(null, {
      country: 'India',
      region: 'Gujarat',
    });
    expect(result.source).toBe(JURISDICTION_SOURCE_TYPES.USER_PROVIDED_JURISDICTION);
    expect(result.country).toBe('India');
    expect(result.region).toBe('Gujarat');
    expect(result.label).toContain('USER-PROVIDED JURISDICTION');
    expect(result.label).toContain('Gujarat, India');
  });

  it('prioritizes explicit document jurisdiction over user input', () => {
    const result = service.resolveJurisdiction('Laws of England and Wales', {
      country: 'India',
      region: 'Maharashtra',
    });
    expect(result.source).toBe(JURISDICTION_SOURCE_TYPES.DOCUMENT_JURISDICTION);
    expect(result.country).toBe('Laws of England and Wales');
    expect(result.label).toContain('DOCUMENT JURISDICTION');
  });

  it('defaults to JURISDICTION_NOT_ESTABLISHED when neither is provided', () => {
    const result = service.resolveJurisdiction(null, undefined);
    expect(result.source).toBe(JURISDICTION_SOURCE_TYPES.JURISDICTION_NOT_ESTABLISHED);
    expect(result.country).toBeNull();
    expect(result.region).toBeNull();
    expect(result.label).toBe('JURISDICTION NOT ESTABLISHED');
  });

  it('treats boilerplate "Not identified" governing law as unestablished', () => {
    const result = service.resolveJurisdiction('Governing law was not identified in this document');
    expect(result.source).toBe(JURISDICTION_SOURCE_TYPES.JURISDICTION_NOT_ESTABLISHED);
    expect(result.label).toBe('JURISDICTION NOT ESTABLISHED');
  });

  it('strict non-inference: never infers jurisdiction from external location or empty values', () => {
    const emptyResult = service.resolveJurisdiction('   ', { country: '' });
    expect(emptyResult.source).toBe(JURISDICTION_SOURCE_TYPES.JURISDICTION_NOT_ESTABLISHED);
  });
});
