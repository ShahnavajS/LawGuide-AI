/**
 * Document Service Layer.
 *
 * Coordinates validation, filesystem storage, and database persistence
 * for uploaded legal documents while keeping HTTP routes clean.
 */

import { getDb, schema } from '@/lib/db';
import { getDocumentStorage, DocumentStorageService } from './storage';
import { validateDocumentUpload, sanitizeOriginalFilename } from './validation';
import { DocumentDto, DocumentPageDto, DocumentProcessingStatus } from './types';
import { documentProcessor, DocumentProcessor } from './processor';
import { geminiService, GeminiService } from '@/lib/ai/gemini';
import { generateId } from '@/lib/utils/id';
import { AppError, NotFoundError, ValidationError } from '@/lib/utils/errors';
import { eq, desc, asc } from 'drizzle-orm';

export class DocumentService {
  private storage: DocumentStorageService;
  private processor: DocumentProcessor;
  private gemini: GeminiService;

  constructor(
    customStorage?: DocumentStorageService,
    customProcessor?: DocumentProcessor,
    customGemini?: GeminiService
  ) {
    this.storage = customStorage || getDocumentStorage();
    this.processor = customProcessor || documentProcessor;
    this.gemini = customGemini || geminiService;
  }

  /**
   * Transforms internal database DocumentRecord into a safe client DTO.
   * Eliminates internal storage filesystem paths and server implementation details.
   */
  public toDto(doc: typeof schema.documents.$inferSelect): DocumentDto {
    return {
      id: doc.id,
      title: doc.title,
      originalFilename: doc.originalFilename,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      pageCount: doc.pageCount,
      documentType: doc.documentType,
      status: doc.status as DocumentProcessingStatus,
      processingError: doc.processingError,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  /**
   * Uploads, validates, stores, and registers a legal document.
   */
  public async uploadDocument(input: {
    filename: string;
    mimeType: string;
    buffer: Buffer;
  }): Promise<DocumentDto> {
    // 1. Server-side validation
    const validation = validateDocumentUpload(input.filename, input.mimeType, input.buffer);
    if (!validation.isValid) {
      throw new AppError(
        validation.error || 'Invalid document upload.',
        validation.statusCode || 400,
        validation.errorCode || 'VALIDATION_ERROR'
      );
    }

    // 2. Safe metadata preparation
    const sanitizedFilename = sanitizeOriginalFilename(input.filename);
    const docId = generateId('doc');
    const now = new Date().toISOString();

    // Human-readable title derived from filename
    const title = sanitizedFilename
      .replace(/\.pdf$/i, '')
      .replace(/[_-]+/g, ' ')
      .trim() || 'Legal Document';

    // 3. Save physical file to isolated storage
    let storageRef;
    try {
      storageRef = await this.storage.saveFile(docId, {
        filename: sanitizedFilename,
        mimeType: input.mimeType,
        content: input.buffer,
      });
    } catch {
      throw new AppError('Failed to persist uploaded document securely.', 500, 'STORAGE_ERROR');
    }

    // 4. Save metadata record to SQLite database
    try {
      const db = getDb();
      const [inserted] = await db
        .insert(schema.documents)
        .values({
          id: docId,
          title,
          originalFilename: sanitizedFilename,
          mimeType: input.mimeType,
          fileSize: input.buffer.length,
          storagePath: storageRef.storagePath,
          status: 'UPLOADED',
          documentType: null,
          pageCount: null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return this.toDto(inserted);
    } catch {
      // Rollback: delete the physical file if database transaction fails
      try {
        await this.storage.deleteFile(storageRef.storagePath);
      } catch {
        // Log silently or track orphaned storage cleanup
      }

      throw new AppError('Failed to record document metadata.', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Retrieves all user documents ordered by newest first.
   */
  public async getDocuments(): Promise<DocumentDto[]> {
    const db = getDb();
    const records = await db
      .select()
      .from(schema.documents)
      .orderBy(desc(schema.documents.createdAt));

    return records.map((doc) => this.toDto(doc));
  }

  /**
   * Retrieves a single document by its unique ID.
   */
  public async getDocumentById(id: string): Promise<DocumentDto> {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('Document ID is required.');
    }

    const db = getDb();
    const [record] = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, id))
      .limit(1);

    if (!record) {
      throw new NotFoundError('Document');
    }

    return this.toDto(record);
  }

  /**
   * Deletes a document and its stored physical file.
   */
  public async deleteDocument(id: string): Promise<{ success: boolean; id: string }> {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('Document ID is required.');
    }

    const db = getDb();
    const [record] = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, id))
      .limit(1);

    if (!record) {
      throw new NotFoundError('Document');
    }

    // 1. Delete physical file from storage
    try {
      await this.storage.deleteFile(record.storagePath);
    } catch {
      // Continue to DB deletion even if storage was already cleaned up
    }

    // 2. Delete database record
    await db.delete(schema.documents).where(eq(schema.documents.id, id));

    return { success: true, id };
  }

  /**
   * Retrieves the raw document buffer for secure streaming/downloading.
   */
  public async getDocumentFile(id: string): Promise<{
    buffer: Buffer;
    originalFilename: string;
    mimeType: string;
  }> {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('Document ID is required.');
    }

    const db = getDb();
    const [record] = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, id))
      .limit(1);

    if (!record) {
      throw new NotFoundError('Document');
    }

    const buffer = await this.storage.getFile(record.storagePath);

    return {
      buffer,
      originalFilename: record.originalFilename,
      mimeType: record.mimeType,
    };
  }

  /**
   * Processes an uploaded document: extracts page boundaries and text,
   * uploads to Gemini Files API if configured, and updates status to READY.
   * Fully idempotent: already READY documents are returned immediately without reprocessing.
   */
  public async processDocument(id: string): Promise<{ document: DocumentDto; pageCount: number }> {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('Document ID is required.');
    }

    const db = getDb();
    const [record] = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, id))
      .limit(1);

    if (!record) {
      throw new NotFoundError('Document');
    }

    // Idempotency: If already READY, return existing state
    if (record.status === 'READY') {
      return {
        document: this.toDto(record),
        pageCount: record.pageCount || 0,
      };
    }

    const now = new Date().toISOString();

    // 1. Transition state to PROCESSING
    await db
      .update(schema.documents)
      .set({
        status: 'PROCESSING',
        processingError: null,
        updatedAt: now,
      })
      .where(eq(schema.documents.id, id));

    try {
      // 2. Fetch raw file from safe storage
      const fileBuffer = await this.storage.getFile(record.storagePath);

      // 3. Extract page-aware text and metadata
      const extractionResult = await this.processor.extractText(fileBuffer, record.mimeType);

      // 4. Clean up any previous pages if this is a retry
      await db.delete(schema.documentPages).where(eq(schema.documentPages.documentId, id));

      // 5. Insert structured pages preserving ordering and page numbers
      if (extractionResult.pages.length > 0) {
        const pageRecords = extractionResult.pages.map((p) => ({
          id: generateId('page'),
          documentId: id,
          pageNumber: p.pageNumber,
          text: p.text,
          createdAt: now,
        }));

        await db.insert(schema.documentPages).values(pageRecords);
      }

      // 6. Optional Gemini Files API upload for AI grounding
      let geminiFileUri: string | null = record.geminiFileUri || null;
      if (!geminiFileUri && this.gemini.isConfigured()) {
        try {
          const geminiFile = await this.gemini.uploadFile(
            fileBuffer,
            record.mimeType,
            record.originalFilename
          );
          if (geminiFile) {
            geminiFileUri = geminiFile.uri;
          }
        } catch {
          // Non-fatal: Gemini upload failure does not break local text processing
        }
      }

      // 7. Transition status to READY
      const [updatedRecord] = await db
        .update(schema.documents)
        .set({
          status: 'READY',
          pageCount: extractionResult.pageCount,
          geminiFileUri,
          processingError: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.documents.id, id))
        .returning();

      return {
        document: this.toDto(updatedRecord),
        pageCount: extractionResult.pageCount,
      };
    } catch (err: unknown) {
      // Set status to FAILED with a safe, non-leaking message
      const safeErrorMessage =
        err instanceof AppError
          ? err.message
          : 'Something went wrong while preparing this document.';

      await db
        .update(schema.documents)
        .set({
          status: 'FAILED',
          processingError: safeErrorMessage,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.documents.id, id));

      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError(safeErrorMessage, 500, 'PROCESSING_FAILED');
    }
  }

  /**
   * Retrieves extracted pages for a document ordered by page number.
   */
  public async getDocumentPages(id: string): Promise<DocumentPageDto[]> {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('Document ID is required.');
    }

    const db = getDb();
    const [record] = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, id))
      .limit(1);

    if (!record) {
      throw new NotFoundError('Document');
    }

    const pages = await db
      .select()
      .from(schema.documentPages)
      .where(eq(schema.documentPages.documentId, id))
      .orderBy(asc(schema.documentPages.pageNumber));

    return pages.map((p) => ({
      id: p.id,
      documentId: p.documentId,
      pageNumber: p.pageNumber,
      text: p.text,
      createdAt: p.createdAt,
    }));
  }
}

let documentServiceInstance: DocumentService | null = null;

export function getDocumentService(): DocumentService {
  if (typeof window !== 'undefined') {
    throw new Error('FATAL: Attempted to access document service from browser bundle.');
  }

  if (!documentServiceInstance) {
    documentServiceInstance = new DocumentService();
  }
  return documentServiceInstance;
}
