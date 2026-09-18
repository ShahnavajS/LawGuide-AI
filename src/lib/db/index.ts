/**
 * SQLite + Drizzle ORM Database Connection.
 *
 * Establishes a server-side SQLite connection using better-sqlite3.
 * Automatically ensures the database directory exists and runs migrations.
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';
import { getServerConfig } from '@/lib/config/env';

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqliteClient: Database.Database | null = null;

export function getDb() {
  if (typeof window !== 'undefined') {
    throw new Error('FATAL: Attempted to initialize database client in a browser bundle.');
  }

  if (dbInstance) {
    return dbInstance;
  }

  const { db } = getServerConfig();
  const dbFilePath = db.url === ':memory:' ? ':memory:' : path.resolve(/*turbopackIgnore: true*/ process.cwd(), db.url);
  const dbDir = path.dirname(dbFilePath);

  // Ensure directory exists
  if (dbFilePath !== ':memory:' && !fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  sqliteClient = new Database(dbFilePath);
  const journalMode = dbFilePath === ':memory:' ? 'MEMORY' : process.env.SQLITE_JOURNAL_MODE || (process.env.NODE_ENV === 'production' ? 'DELETE' : 'WAL');
  try {
    sqliteClient.pragma(`journal_mode = ${journalMode}`);
  } catch {
    try {
      sqliteClient.pragma('journal_mode = DELETE');
    } catch {
      // Non-fatal if pragma cannot be set
    }
  }
  try {
    sqliteClient.pragma('foreign_keys = ON');
  } catch {
    // Non-fatal
  }

  dbInstance = drizzle(sqliteClient, { schema });

  // Automatically apply migrations if migrations folder exists
  const migrationsFolder = path.resolve(process.cwd(), './src/lib/db/migrations');
  if (fs.existsSync(migrationsFolder)) {
    try {
      migrate(dbInstance, { migrationsFolder });
    } catch (migErr) {
      dbInstance = null;
      sqliteClient.close();
      sqliteClient = null;
      throw new Error('Database migration failed; refusing to serve an inconsistent schema.', { cause: migErr });
    }
  }

  return dbInstance;
}

export { schema };
