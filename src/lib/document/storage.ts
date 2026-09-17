/**
 * Document Storage Abstraction.
 *
 * Implements a storage interface that decouples physical document persistence from business logic.
 * Enforces strict isolation: files are stored using server-generated IDs and fixed filenames
 * outside the public directory, eliminating path traversal risks and filesystem injection vulnerabilities.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { UploadDocumentInput, StoredFileRef } from './types';
import { getServerConfig } from '@/lib/config/env';

export interface DocumentStorageService {
  saveFile(fileId: string, input: UploadDocumentInput): Promise<StoredFileRef>;
  getFile(storagePath: string): Promise<Buffer>;
  deleteFile(storagePath: string): Promise<void>;
  fileExists(storagePath: string): Promise<boolean>;
  resolveSafePath(storagePath: string): string;
}

export class LocalStorageService implements DocumentStorageService {
  private baseDir: string;

  constructor(customBaseDir?: string) {
    if (customBaseDir) {
      this.baseDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), customBaseDir);
    } else {
      const config = getServerConfig();
      this.baseDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), config.storage.dir);
    }

    // Ensure base storage directory exists
    if (!fsSync.existsSync(this.baseDir)) {
      fsSync.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /**
   * Resolves a storage path securely, ensuring it does not escape baseDir via traversal attempts.
   */
  public resolveSafePath(storagePath: string): string {
    // Disallow null bytes
    if (storagePath.indexOf('\0') !== -1) {
      throw new Error('SECURITY_ERROR: Null byte detected in storage path.');
    }

    const resolved = path.resolve(this.baseDir, storagePath);
    const normalizedBase = path.resolve(this.baseDir);

    // Verify resolved path is strictly within baseDir
    if (!resolved.startsWith(normalizedBase + path.sep) && resolved !== normalizedBase) {
      throw new Error('SECURITY_ERROR: Path traversal detected in storage path.');
    }

    return resolved;
  }

  public async saveFile(fileId: string, input: UploadDocumentInput): Promise<StoredFileRef> {
    // Sanitize fileId to allow only URL/filename-safe alphanumeric, underscore, hyphen
    const safeFileId = fileId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeFileId) {
      throw new Error('SECURITY_ERROR: Invalid file ID format.');
    }

    const documentDir = path.join(this.baseDir, safeFileId);
    if (!fsSync.existsSync(documentDir)) {
      await fs.mkdir(documentDir, { recursive: true });
    }

    // Controlled internal filename (never user-provided)
    const fixedFilename = 'document.pdf';
    const targetPath = path.join(documentDir, fixedFilename);
    const relativeStorageKey = `${safeFileId}/${fixedFilename}`;

    await fs.writeFile(targetPath, input.content);

    return {
      storagePath: relativeStorageKey,
      originalFilename: input.filename,
      fileSize: input.content.byteLength,
      mimeType: input.mimeType,
    };
  }

  public async getFile(storagePath: string): Promise<Buffer> {
    const safePath = this.resolveSafePath(storagePath);
    return await fs.readFile(safePath);
  }

  public async deleteFile(storagePath: string): Promise<void> {
    const safePath = this.resolveSafePath(storagePath);
    if (fsSync.existsSync(safePath)) {
      await fs.unlink(safePath);
    }

    // If the parent directory is the document folder, clean it up
    const parentDir = path.dirname(safePath);
    if (parentDir !== this.baseDir && fsSync.existsSync(parentDir)) {
      try {
        const remaining = await fs.readdir(parentDir);
        if (remaining.length === 0) {
          await fs.rmdir(parentDir);
        }
      } catch {
        // Non-fatal if directory cleanup cannot complete immediately
      }
    }
  }

  public async fileExists(storagePath: string): Promise<boolean> {
    try {
      const safePath = this.resolveSafePath(storagePath);
      await fs.access(safePath);
      return true;
    } catch {
      return false;
    }
  }
}

let storageInstance: DocumentStorageService | null = null;

export function getDocumentStorage(): DocumentStorageService {
  if (typeof window !== 'undefined') {
    throw new Error('FATAL: Attempted to access storage service from browser.');
  }

  if (!storageInstance) {
    storageInstance = new LocalStorageService();
  }
  return storageInstance;
}
