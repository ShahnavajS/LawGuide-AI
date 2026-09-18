/** Small runtime boundary for model JSON before domain services read it. */
export function assertModelCollections(value: unknown, names: readonly string[], maxItems = 100): void {
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
