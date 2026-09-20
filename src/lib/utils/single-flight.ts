const activeOperations = new Map<string, Promise<unknown>>();

/** Shares one in-progress result for identical expensive operations in this process. */
export function runSingleFlight<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const existing = activeOperations.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const current = operation().finally(() => {
    if (activeOperations.get(key) === current) activeOperations.delete(key);
  });
  activeOperations.set(key, current);
  return current;
}
