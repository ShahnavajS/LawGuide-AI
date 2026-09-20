import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PUBLIC_ROUTE_FILES = new Set([
  'auth/login/route.ts',
  'auth/logout/route.ts',
  'auth/me/route.ts',
  'auth/signup/route.ts',
  'health/route.ts',
  'legal-info/legal-aid/route.ts',
  'legal-info/topics/[topicId]/route.ts',
  'legal-info/topics/route.ts',
]);

function routeFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(fullPath);
    return entry.name === 'route.ts' ? [fullPath] : [];
  });
}

describe('API authorization inventory', () => {
  it('keeps every non-public route behind the route-level auth boundary', () => {
    const root = path.join(process.cwd(), 'src', 'app', 'api');
    const files = routeFiles(root);
    const unwrapped = files
      .filter((file) => !fs.readFileSync(file, 'utf8').includes('withAuth('))
      .map((file) => path.relative(root, file).replaceAll('\\', '/'))
      .sort();

    expect(unwrapped).toEqual([...PUBLIC_ROUTE_FILES].sort());
  });
});
