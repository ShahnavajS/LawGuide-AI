/**
 * Utility for generating consistent unique IDs across the application.
 */

export function generateId(prefix?: string): string {
  const uuid = crypto.randomUUID();
  return prefix ? `${prefix}_${uuid}` : uuid;
}
