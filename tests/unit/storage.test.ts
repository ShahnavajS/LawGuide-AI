import { describe, it, expect, afterAll } from 'vitest';
import { LocalStorageService } from '@/lib/document/storage';
import fs from 'fs/promises';
import path from 'path';

describe('Document Storage Abstraction (LocalStorageService)', () => {
  const testDir = './test-uploads';
  const storage = new LocalStorageService(testDir);
  let savedStoragePath = '';

  afterAll(async () => {
    // Cleanup test storage directory
    const resolved = path.resolve(process.cwd(), testDir);
    await fs.rm(resolved, { recursive: true, force: true });
  });

  it('saves an uploaded file buffer to isolated storage', async () => {
    const fileId = 'test-doc-123';
    const content = Buffer.from('Confidential Commercial Agreement Excerpt');

    const result = await storage.saveFile(fileId, {
      filename: 'contract.pdf',
      mimeType: 'application/pdf',
      content,
    });

    expect(result.storagePath).toContain('test-doc-123');
    expect(result.fileSize).toBe(content.byteLength);
    savedStoragePath = result.storagePath;
  });

  it('verifies that the saved file exists', async () => {
    const exists = await storage.fileExists(savedStoragePath);
    expect(exists).toBe(true);
  });

  it('retrieves the exact saved file buffer back', async () => {
    const buffer = await storage.getFile(savedStoragePath);
    expect(buffer.toString('utf-8')).toBe('Confidential Commercial Agreement Excerpt');
  });

  it('deletes the file cleanly', async () => {
    await storage.deleteFile(savedStoragePath);
    const exists = await storage.fileExists(savedStoragePath);
    expect(exists).toBe(false);
  });
});
