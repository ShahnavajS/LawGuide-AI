import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PdfDocumentProcessor } from '@/lib/document/processor';
import { DocumentService } from '@/lib/document/service';
import { LocalStorageService } from '@/lib/document/storage';
import { getDb } from '@/lib/db';
import { AppError, NotFoundError, ValidationError } from '@/lib/utils/errors';
import fs from 'fs/promises';
import path from 'path';

// Deterministic multi-page test PDF fixture with clear clause text
function createMultiPageTestPdf(): Buffer {
  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 9 0 R >> >> >>
endobj
4 0 obj
<< /Length 54 >>
stream
BT
/F1 18 Tf
50 700 Td
(LexiGuide Test Document. Page 1) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 9 0 R >> >> >>
endobj
6 0 obj
<< /Length 59 >>
stream
BT
/F1 18 Tf
50 700 Td
(Termination. Thirty days notice.) Tj
ET
endstream
endobj
7 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 8 0 R /Resources << /Font << /F1 9 0 R >> >> >>
endobj
8 0 obj
<< /Length 58 >>
stream
BT
/F1 18 Tf
50 700 Td
(Confidentiality. Remain secret.) Tj
ET
endstream
endobj
9 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 10
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000130 00000 n 
0000000249 00000 n 
0000000354 00000 n 
0000000473 00000 n 
0000000583 00000 n 
0000000702 00000 n 
0000000811 00000 n 
trailer
<< /Size 10 /Root 1 0 R >>
startxref
880
%%EOF`;
  return Buffer.from(pdfString);
}

// Deterministic single-page PDF with no text stream (simulating image/scanned page)
function createEmptyPageTestPdf(): Buffer {
  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000114 00000 n 
trailer
<< /Size 4 /Root 1 0 R >>
startxref
192
%%EOF`;
  return Buffer.from(pdfString);
}

describe('Phase 3: Document Processor & Page Extraction', () => {
  const processor = new PdfDocumentProcessor();

  it('accurately counts pages in a multi-page PDF document', async () => {
    const pdfBuffer = createMultiPageTestPdf();
    const result = await processor.extractText(pdfBuffer, 'application/pdf');

    expect(result.pageCount).toBe(3);
    expect(result.pages.length).toBe(3);
  });

  it('extracts page-level text preserving ordering and exact page boundaries', async () => {
    const pdfBuffer = createMultiPageTestPdf();
    const result = await processor.extractText(pdfBuffer, 'application/pdf');

    // Page 1
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].text).toContain('LexiGuide Test Document. Page 1');
    expect(result.pages[0].hasText).toBe(true);

    // Page 2
    expect(result.pages[1].pageNumber).toBe(2);
    expect(result.pages[1].text).toContain('Termination. Thirty days notice.');
    expect(result.pages[1].hasText).toBe(true);

    // Page 3
    expect(result.pages[2].pageNumber).toBe(3);
    expect(result.pages[2].text).toContain('Confidentiality. Remain secret.');
    expect(result.pages[2].hasText).toBe(true);
  });

  it('preserves text integrity without destructive transformations for citations', async () => {
    const pdfBuffer = createMultiPageTestPdf();
    const result = await processor.extractText(pdfBuffer, 'application/pdf');

    // Source punctuation and exact casing must remain intact
    expect(result.pages[1].text).toBe('Termination. Thirty days notice.');
  });

  it('handles empty/scanned pages honestly without hallucinating text', async () => {
    const emptyPdfBuffer = createEmptyPageTestPdf();
    const result = await processor.extractText(emptyPdfBuffer, 'application/pdf');

    expect(result.pageCount).toBe(1);
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].text).toBe('');
    expect(result.pages[0].hasText).toBe(false);
  });

  it('rejects invalid or non-PDF buffers safely', async () => {
    const invalidBuffer = Buffer.from('Non-PDF string');
    await expect(processor.extractText(invalidBuffer, 'application/pdf')).rejects.toThrow(
      /valid PDF/
    );
  });
});

describe('Phase 3: Document Processing Service & Lifecycle', () => {
  const testStorageDir = './test-processor-uploads';
  let storage: LocalStorageService;
  let service: DocumentService;
  let testDocId = '';

  beforeAll(async () => {
    storage = new LocalStorageService(testStorageDir);
    service = new DocumentService(storage);
    getDb();
  });

  afterAll(async () => {
    if (testDocId) {
      try {
        await service.deleteDocument(testDocId);
      } catch {
        // Ignore
      }
    }
    const resolved = path.resolve(process.cwd(), testStorageDir);
    await fs.rm(resolved, { recursive: true, force: true });
  });

  it('processes an uploaded document through the full lifecycle: UPLOADED -> READY', async () => {
    const pdfBuffer = createMultiPageTestPdf();
    const doc = await service.uploadDocument({
      filename: 'Master_Services_Agreement.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBuffer,
    });

    testDocId = doc.id;
    expect(doc.status).toBe('UPLOADED');
    expect(doc.pageCount).toBeNull();

    // Process document
    const processResult = await service.processDocument(testDocId);
    expect(processResult.pageCount).toBe(3);
    expect(processResult.document.status).toBe('READY');
    expect(processResult.document.pageCount).toBe(3);
    expect(processResult.document.processingError).toBeNull();

    // Verify pages were persisted and can be retrieved
    const pages = await service.getDocumentPages(testDocId);
    expect(pages.length).toBe(3);
    expect(pages[0].pageNumber).toBe(1);
    expect(pages[0].text).toContain('LexiGuide Test Document. Page 1');
    expect(pages[1].pageNumber).toBe(2);
    expect(pages[1].text).toContain('Termination. Thirty days notice.');
    expect(pages[2].pageNumber).toBe(3);
    expect(pages[2].text).toContain('Confidentiality. Remain secret.');
  });

  it('guarantees idempotency when reprocessing an already READY document', async () => {
    const initialPages = await service.getDocumentPages(testDocId);

    // Reprocess the READY document
    const reprocessResult = await service.processDocument(testDocId);
    expect(reprocessResult.document.status).toBe('READY');
    expect(reprocessResult.pageCount).toBe(3);

    // Verify pages are not duplicated
    const postPages = await service.getDocumentPages(testDocId);
    expect(postPages.length).toBe(initialPages.length);
  });

  it('rejects processing with invalid or missing document ID', async () => {
    await expect(service.processDocument('')).rejects.toThrow(ValidationError);
    await expect(service.processDocument('non_existent_doc_id')).rejects.toThrow(NotFoundError);
  });

  it('handles processing failure safely without deleting the original PDF file', async () => {
    // Create a mock processor that throws an error
    const failingProcessor = {
      validate: () => ({ valid: true }),
      extractText: async () => {
        throw new AppError('Corrupted PDF syntax encountered.', 422, 'PROCESSING_FAILED');
      },
    };

    const failService = new DocumentService(storage, failingProcessor);

    const pdfBuffer = createMultiPageTestPdf();
    const doc = await failService.uploadDocument({
      filename: 'Corrupt_Document.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBuffer,
    });

    // Attempt processing which fails
    await expect(failService.processDocument(doc.id)).rejects.toThrow(/Corrupted PDF syntax/);

    // Verify document status is FAILED in database
    const failedDoc = await failService.getDocumentById(doc.id);
    expect(failedDoc.status).toBe('FAILED');
    expect(failedDoc.processingError).toBe('Corrupted PDF syntax encountered.');

    // CRITICAL: The original PDF must still exist so the user can retry!
    const file = await failService.getDocumentFile(doc.id);
    expect(file.buffer).toBeDefined();
    expect(file.buffer.length).toBe(pdfBuffer.length);

    // Cleanup
    await failService.deleteDocument(doc.id);
  });

  it('supports retry after failure and transitions to READY', async () => {
    // Initial failing processor
    let shouldFail = true;
    const flakeProcessor = {
      validate: () => ({ valid: true }),
      extractText: async () => {
        if (shouldFail) {
          throw new AppError('Temporary parsing glitch.', 500, 'PROCESSING_FAILED');
        }
        return {
          pageCount: 3,
          fullText: 'Recovered text',
          pages: [
            { pageNumber: 1, text: 'Recovered Page 1', hasText: true },
            { pageNumber: 2, text: 'Recovered Page 2', hasText: true },
            { pageNumber: 3, text: 'Recovered Page 3', hasText: true },
          ],
        };
      },
    };

    const retryService = new DocumentService(storage, flakeProcessor);

    const pdfBuffer = createMultiPageTestPdf();
    const doc = await retryService.uploadDocument({
      filename: 'Retryable_Document.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBuffer,
    });

    // First attempt: fails
    await expect(retryService.processDocument(doc.id)).rejects.toThrow(/Temporary parsing glitch/);
    const failedState = await retryService.getDocumentById(doc.id);
    expect(failedState.status).toBe('FAILED');

    // Second attempt: succeeds
    shouldFail = false;
    const retryResult = await retryService.processDocument(doc.id);
    expect(retryResult.document.status).toBe('READY');
    expect(retryResult.pageCount).toBe(3);

    const recoveredDoc = await retryService.getDocumentById(doc.id);
    expect(recoveredDoc.status).toBe('READY');
    expect(recoveredDoc.processingError).toBeNull();

    // Cleanup
    await retryService.deleteDocument(doc.id);
  });

  it('completes processing successfully even when Gemini is offline or unconfigured', async () => {
    // Mock Gemini service that is unconfigured
    const unconfiguredGemini = {
      isConfigured: () => false,
      generateText: async () => '',
      generateStructured: async () => ({}),
      uploadFile: async () => null,
    };

    const offlineService = new DocumentService(
      storage,
      new PdfDocumentProcessor(),
      unconfiguredGemini as unknown as typeof service['gemini']
    );

    const pdfBuffer = createMultiPageTestPdf();
    const doc = await offlineService.uploadDocument({
      filename: 'Offline_Mode_Document.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBuffer,
    });

    const result = await offlineService.processDocument(doc.id);
    expect(result.document.status).toBe('READY');
    expect(result.pageCount).toBe(3);

    // Cleanup
    await offlineService.deleteDocument(doc.id);
  });
});
