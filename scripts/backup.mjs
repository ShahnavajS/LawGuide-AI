/**
 * SQLite WAL-Safe Online Backup Script for LexiGuide AI.
 *
 * Safely checkpoints SQLite WAL journal and creates a consistent snapshot
 * of the database and uploaded document storage directory.
 *
 * Usage: node scripts/backup.mjs [destination_dir]
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

async function runBackup() {
  const dbPath = process.env.DATABASE_URL || './data/lexiguide.db';
  const storageDir = process.env.STORAGE_DIR || './uploads';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const targetDir = process.argv[2] || path.join(process.cwd(), 'backups', `backup-${timestamp}`);

  console.log(`[Backup] Starting backup for LexiGuide AI...`);
  console.log(`[Backup] Source DB: ${dbPath}`);
  console.log(`[Backup] Source Storage: ${storageDir}`);
  console.log(`[Backup] Destination: ${targetDir}`);

  if (!fs.existsSync(dbPath)) {
    console.error(`[Backup Error] Database file does not exist at: ${dbPath}`);
    process.exit(1);
  }

  // Create destination directory
  fs.mkdirSync(targetDir, { recursive: true });

  // 1. Safe SQLite online backup
  const backupDbPath = path.join(targetDir, 'lexiguide.db');
  console.log(`[Backup] Checkpointing SQLite WAL and streaming database snapshot...`);
  const db = new Database(dbPath);
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    await db.backup(backupDbPath);
    console.log(`[Backup] Database successfully backed up to: ${backupDbPath}`);
  } finally {
    db.close();
  }

  // 2. Document storage directory copy
  const destStorageDir = path.join(targetDir, 'uploads');
  if (fs.existsSync(storageDir)) {
    console.log(`[Backup] Copying uploaded documents to: ${destStorageDir}...`);
    fs.cpSync(storageDir, destStorageDir, { recursive: true });
    console.log(`[Backup] Storage files successfully copied.`);
  } else {
    fs.mkdirSync(destStorageDir, { recursive: true });
    console.log(`[Backup] Storage directory was empty; created placeholder.`);
  }

  // 3. Write metadata manifest
  const manifest = {
    timestamp: new Date().toISOString(),
    version: 'Phase 13',
    dbFile: 'lexiguide.db',
    storageDir: 'uploads',
  };
  fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`[Backup Complete] Backup successfully created at: ${targetDir}`);
}

runBackup().catch((err) => {
  console.error('[Backup Failed]', err.message);
  process.exit(1);
});
