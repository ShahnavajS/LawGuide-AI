import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DocumentService } from '@/lib/document/service';
import { LocalStorageService } from '@/lib/document/storage';
import { getDb } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

describe('Document Service Integration & Workflow', () => {
  const testStorageDir = './test-service-uploads';
  let storage: LocalStorageService;
  let service: DocumentService;
  let createdDocId = '';

  beforeAll(async () => {
    storage = new LocalStorageService(testStorageDir);
    service = new DocumentService(storage);

    // Ensure database tables exist
    getDb();
  });

  afterAll(async () => {
    // Cleanup created test records
    if (createdDocId) {
      try {
        await service.deleteDocument(createdDocId);
      } catch {
        // Ignore if already deleted
      }
    }

    // Cleanup physical test files
    const resolved = path.resolve(process.cwd(), testStorageDir);
    await fs.rm(resolved, { recursive: true, force: true });
  });

  it('rejects upload of invalid non-PDF file', async () => {
    const invalidBuffer = Buffer.from('Plain text content');
    await expect(
      service.uploadDocument({
        filename: 'terms.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: invalidBuffer,
      })
    ).rejects.toThrow(/supports PDF documents only/);
  });

  it('rejects upload of spoofed file renamed to .pdf', async () => {
    const fakeBuffer = Buffer.from('Plain text masquerading as PDF');
    await expect(
      service.uploadDocument({
        filename: 'secret.pdf',
        mimeType: 'application/pdf',
        buffer: fakeBuffer,
      })
    ).rejects.toThrow(/does not appear to be a valid PDF/);
  });

  it('successfully uploads and registers a valid PDF document', async () => {
    const validPdf = Buffer.from('%PDF-1.5\n%Header\nCommercial Real Estate Lease Content');
    const doc = await service.uploadDocument({
      filename: 'Commercial_Lease_2025.pdf',
      mimeType: 'application/pdf',
      buffer: validPdf,
    });

    expect(doc.id).toBeDefined();
    expect(doc.id.startsWith('doc_')).toBe(true);
    expect(doc.title).toBe('Commercial Lease 2025');
    expect(doc.originalFilename).toBe('Commercial_Lease_2025.pdf');
    expect(doc.mimeType).toBe('application/pdf');
    expect(doc.fileSize).toBe(validPdf.length);
    expect(doc.status).toBe('UPLOADED');
    expect((doc as unknown as { storagePath?: string }).storagePath).toBeUndefined(); // Storage path must not be exposed in DTO

    createdDocId = doc.id;
  });

  it('retrieves the uploaded document by ID', async () => {
    const doc = await service.getDocumentById(createdDocId);
    expect(doc).toBeDefined();
    expect(doc.id).toBe(createdDocId);
    expect(doc.title).toBe('Commercial Lease 2025');
  });

  it('lists uploaded documents in workspace', async () => {
    const docs = await service.getDocuments();
    expect(Array.isArray(docs)).toBe(true);
    const found = docs.find((d) => d.id === createdDocId);
    expect(found).toBeDefined();
  });

  it('streams the raw PDF file securely', async () => {
    const fileResult = await service.getDocumentFile(createdDocId);
    expect(fileResult.buffer).toBeDefined();
    expect(fileResult.buffer.toString()).toContain('Commercial Real Estate Lease Content');
    expect(fileResult.originalFilename).toBe('Commercial_Lease_2025.pdf');
    expect(fileResult.mimeType).toBe('application/pdf');
  });

  it('marks a missing PDF unavailable and returns a not-found error', async () => {
    const filePath = storage.resolveSafePath(`${createdDocId}/document.pdf`);
    const temporaryPath = `${filePath}.missing`;
    await fs.rename(filePath, temporaryPath);
    try {
      const doc = await service.getDocumentById(createdDocId);
      expect(doc.fileAvailable).toBe(false);
      const listed = (await service.getDocuments()).find((item) => item.id === createdDocId);
      expect(listed?.fileAvailable).toBe(false);
      await expect(service.getDocumentFile(createdDocId)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    } finally {
      await fs.rename(temporaryPath, filePath);
    }
  });

  it('prevents path traversal attempts in storage resolution', () => {
    expect(() => storage.resolveSafePath('../../etc/passwd')).toThrow(/Path traversal detected/);
    expect(() => storage.resolveSafePath('..\\..\\windows\\system32')).toThrow(/Path traversal detected/);
    expect(() => storage.resolveSafePath('valid_doc\x00_inject')).toThrow(/Null byte detected/);
  });

  it('deletes document cleanly from storage and database', async () => {
    const deleteResult = await service.deleteDocument(createdDocId);
    expect(deleteResult.success).toBe(true);
    expect(deleteResult.id).toBe(createdDocId);

    // Verify it cannot be found anymore in DB
    await expect(service.getDocumentById(createdDocId)).rejects.toThrow(/not found/);

    // Verify physical file was deleted
    const fileExists = await storage.fileExists(`${createdDocId}/document.pdf`);
    expect(fileExists).toBe(false);

    createdDocId = '';
  });
});
