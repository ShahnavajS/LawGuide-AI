import type { ZodType } from 'zod';

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function assertBoundedJsonValue(value: unknown): void {
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  let nodes = 0;
  while (stack.length > 0) {
    const current = stack.pop()!;
    nodes += 1;
    if (nodes > 5_000 || current.depth > 12) {
      throw new Error('Model output exceeds structural limits.');
    }
    if (typeof current.value === 'string' && current.value.length > 20_000) {
      throw new Error('Model output contains an oversized string.');
    }
    if (!current.value || typeof current.value !== 'object') continue;
    if (!Array.isArray(current.value) && Object.getPrototypeOf(current.value) !== Object.prototype) {
      throw new Error('Model output contains an unsupported object.');
    }
    for (const [key, child] of Object.entries(current.value)) {
      if (DANGEROUS_KEYS.has(key)) throw new Error('Model output contains an unsafe key.');
      stack.push({ value: child, depth: current.depth + 1 });
    }
  }
}

/** Applies resource bounds first, then a named field-level runtime schema. */
export function parseModelOutput<T>(schema: ZodType<T>, value: unknown): T {
  assertBoundedJsonValue(value);
  return schema.parse(value);
}

export function parseStoredArtifact<T>(
  raw: string,
  shape: { arrays?: readonly string[]; objects?: readonly string[]; strings?: readonly string[] }
): T {
  if (Buffer.byteLength(raw, 'utf8') > 5_000_000) {
    throw new Error('Stored artifact exceeds the size limit.');
  }
  const parsed: unknown = JSON.parse(raw);
  assertBoundedJsonValue(parsed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Stored artifact must be an object.');
  }
  const record = parsed as Record<string, unknown>;
  for (const name of shape.arrays || []) {
    if (!Array.isArray(record[name])) throw new Error(`Stored artifact field ${name} must be an array.`);
  }
  for (const name of shape.objects || []) {
    if (!record[name] || typeof record[name] !== 'object' || Array.isArray(record[name])) {
      throw new Error(`Stored artifact field ${name} must be an object.`);
    }
  }
  for (const name of shape.strings || []) {
    if (typeof record[name] !== 'string' || !record[name]) {
      throw new Error(`Stored artifact field ${name} must be a non-empty string.`);
    }
  }
  return parsed as T;
}

/** Small runtime boundary for model JSON before domain services read it. */
export function assertModelCollections(value: unknown, names: readonly string[], maxItems = 100): void {
  assertBoundedJsonValue(value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Model output must be a JSON object.');
  }
  const result = value as Record<string, unknown>;
  for (const name of names) {
    const items = result[name];
    if (items === undefined) continue;
    if (!Array.isArray(items) || items.length > maxItems || items.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
      throw new Error(`Invalid model output collection: ${name}.`);
    }
  }
}

export function assertCitedModelItems(value: unknown, names: readonly string[], maxPage: number): void {
  assertModelCollections(value, names);
  const result = value as Record<string, unknown>;
  for (const name of names) {
    for (const item of (result[name] || []) as Array<Record<string, unknown>>) {
      if (!Number.isInteger(item.pageNumber) || Number(item.pageNumber) < 1 || Number(item.pageNumber) > maxPage ||
          typeof item.quotedText !== 'string' || !item.quotedText.trim() || item.quotedText.length > 2000) {
        throw new Error(`Invalid page citation in model output: ${name}.`);
      }
    }
  }
}
