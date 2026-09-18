import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('legacy preparation kind migration', () => {
  it('preserves existing matter briefs and document preparations as distinct kinds', () => {
    const sqlite = new Database(':memory:');
    try {
      sqlite.exec(`CREATE TABLE preparations (
        id TEXT PRIMARY KEY,
        matter_id TEXT,
        document_id TEXT,
        comparison_id TEXT,
        purpose TEXT
      )`);
      sqlite.prepare('INSERT INTO preparations VALUES (?, ?, ?, ?, ?)')
        .run('matter_brief', 'matter_a', null, null, 'Matter Counsel Brief: A');
      sqlite.prepare('INSERT INTO preparations VALUES (?, ?, ?, ?, ?)')
        .run('matter_preparation', 'matter_a', 'doc_a', null, 'Review agreement');
      sqlite.prepare('INSERT INTO preparations VALUES (?, ?, ?, ?, ?)')
        .run('document_preparation', null, 'doc_a', null, 'Review agreement');

      const migration = readFileSync(path.join(process.cwd(), 'src/lib/db/migrations/0011_old_starjammers.sql'), 'utf8');
      for (const statement of migration.split('--> statement-breakpoint')) {
        if (statement.trim()) sqlite.exec(statement);
      }
      const rows = sqlite.prepare('SELECT id, brief_kind FROM preparations ORDER BY id').all();
      expect(rows).toEqual([
        { id: 'document_preparation', brief_kind: 'PREPARATION' },
        { id: 'matter_brief', brief_kind: 'MATTER' },
        { id: 'matter_preparation', brief_kind: 'PREPARATION' },
      ]);
    } finally {
      sqlite.close();
    }
  });
});
