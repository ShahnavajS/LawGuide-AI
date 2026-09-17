import { describe, it, expect } from 'vitest';
import { generateId } from '@/lib/utils/id';

describe('ID Generation Utility', () => {
  it('generates standard UUID strings without prefix', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('prepends custom prefixes cleanly', () => {
    const docId = generateId('doc');
    expect(docId.startsWith('doc_')).toBe(true);

    const citationId = generateId('cit');
    expect(citationId.startsWith('cit_')).toBe(true);
  });

  it('generates unique values across consecutive calls', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toEqual(id2);
  });
});
