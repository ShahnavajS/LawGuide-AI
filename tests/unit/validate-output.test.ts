import { describe, expect, it } from 'vitest';
import { assertCitedModelItems, assertModelCollections } from '@/lib/ai/validate-output';

describe('model output boundary', () => {
  it('rejects primitive and malformed collections', () => {
    expect(() => assertModelCollections('answer', ['findings'])).toThrow();
    expect(() => assertModelCollections({ findings: [null] }, ['findings'])).toThrow();
    expect(() => assertModelCollections({ findings: Array.from({ length: 101 }, () => ({})) }, ['findings'])).toThrow();
  });

  it('requires bounded page quotes for document findings', () => {
    expect(() => assertCitedModelItems({ findings: [{ pageNumber: 2, quotedText: 'real quote' }] }, ['findings'], 2)).not.toThrow();
    expect(() => assertCitedModelItems({ findings: [{ pageNumber: 3, quotedText: 'wrong page' }] }, ['findings'], 2)).toThrow();
    expect(() => assertCitedModelItems({ findings: [{ pageNumber: 1, quotedText: '' }] }, ['findings'], 2)).toThrow();
  });
});
