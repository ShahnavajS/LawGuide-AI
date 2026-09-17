/**
 * Safe Restore Script for LexiGuide AI.
 *
 * Restores a consistent backup snapshot into target database and upload directories.
 *
 * Usage: node scripts/restore.mjs <backup_directory>
 */

import fs from 'fs';
import path from 'path';

async function runRestore() {
  const backupDir = process.argv[2];
  if (!backupDir) {
    console.error(`[Restore Error] Usage: node scripts/restore.mjs <backup_directory>`);
    process.exit(1);
  }

  const resolvedBackupDir = path.resolve(process.cwd(), backupDir);
  if (!fs.existsSync(resolvedBackupDir)) {
    console.error(`[Restore Error] Backup directory not found at: ${resolvedBackupDir}`);
    process.exit(1);
  }

  const backupDbFile = path.join(resolvedBackupDir, 'lexiguide.db');
  const backupUploadsDir = path.join(resolvedBackupDir, 'uploads');

  if (!fs.existsSync(backupDbFile)) {
    console.error(`[Restore Error] Backup does not contain 'lexiguide.db'`);
    process.exit(1);
  }

  const targetDbPath = process.env.DATABASE_URL || './data/lexiguide.db';
  const targetStorageDir = process.env.STORAGE_DIR || './uploads';

  console.log(`[Restore] Restoring LexiGuide AI from: ${resolvedBackupDir}...`);
  console.log(`[Restore] Target DB: ${targetDbPath}`);
  console.log(`[Restore] Target Storage: ${targetStorageDir}`);

  // Ensure target DB directory exists
  const targetDbDir = path.dirname(path.resolve(process.cwd(), targetDbPath));
  if (!fs.existsSync(targetDbDir)) {
    fs.mkdirSync(targetDbDir, { recursive: true });
  }

  // Restore database file
  fs.copyFileSync(backupDbFile, targetDbPath);
  console.log(`[Restore] Database file restored.`);

  // Remove existing WAL / SHM files if any to prevent state mismatch
  const walFile = `${targetDbPath}-wal`;
  const shmFile = `${targetDbPath}-shm`;
  if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
  if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);

  // Restore storage directory
  if (fs.existsSync(backupUploadsDir)) {
    const resolvedTargetStorage = path.resolve(process.cwd(), targetStorageDir);
    if (!fs.existsSync(resolvedTargetStorage)) {
      fs.mkdirSync(resolvedTargetStorage, { recursive: true });
    }
    fs.cpSync(backupUploadsDir, resolvedTargetStorage, { recursive: true });
    console.log(`[Restore] Document files restored.`);
  }

  console.log(`[Restore Complete] System successfully restored from backup.`);
}

runRestore().catch((err) => {
  console.error('[Restore Failed]', err.message);
  process.exit(1);
});
