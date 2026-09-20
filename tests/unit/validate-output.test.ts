import { describe, expect, it } from 'vitest';
import { assertBoundedJsonValue, assertCitedModelItems, assertModelCollections, parseStoredArtifact } from '@/lib/ai/validate-output';
import { parseStrictJson } from '@/lib/ai/gemini';

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

  it('rejects truncated or decorated JSON instead of repairing legal output', () => {
    expect(() => parseStrictJson('{"findings":[{"id":"one"}]')).toThrow();
    expect(() => parseStrictJson('```json\n{"findings":[]}\n```')).toThrow();
    expect(parseStrictJson('{"findings":[]}')).toEqual({ findings: [] });
  });

  it('bounds nested values and validates persisted artifact fields', () => {
    let nested: unknown = 'leaf';
    for (let index = 0; index < 14; index += 1) nested = { nested };
    expect(() => assertBoundedJsonValue(nested)).toThrow(/structural limits/);
    expect(() => parseStoredArtifact('{"id":"a","items":[]}', {
      strings: ['id'], arrays: ['items'], objects: ['summary'],
    })).toThrow(/summary/);
  });
});
