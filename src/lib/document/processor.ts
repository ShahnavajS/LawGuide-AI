/**
 * Server-Side PDF Document Processor for LexiGuide AI.
 *
 * Implements page-aware text extraction and metadata derivation using pdfjs-dist.
 * Preserves page boundaries and raw extracted text for downstream evidence and citations.
 */

import { DocumentExtractionResult, ExtractedPageContent } from './types';
import { validatePdfBuffer } from './validation';
import { AppError } from '@/lib/utils/errors';

export interface DocumentProcessor {
  /**
   * Extracts page-level text and metadata from an uploaded document buffer.
   */
  extractText(buffer: Buffer, mimeType: string): Promise<DocumentExtractionResult>;

  /**
   * Validates file size, mime type, and integrity prior to processing.
   */
  validate(buffer: Buffer, mimeType: string): { valid: boolean; error?: string };
}

export class PdfDocumentProcessor implements DocumentProcessor {
  private static readonly MAX_PAGES = 100;
  private static readonly MAX_TEXT_CHARACTERS = 500_000;
  /**
   * Validates the PDF buffer using multi-tier safety checks.
   */
  validate(buffer: Buffer, mimeType: string): { valid: boolean; error?: string } {
    const result = validatePdfBuffer(buffer, mimeType);
    return { valid: result.isValid, error: result.error };
  }

  /**
   * Extracts page-level text and accurate page count using pdfjs-dist.
   * Preserves exact page boundaries and text integrity for citation anchoring.
   */
  async extractText(buffer: Buffer, mimeType: string): Promise<DocumentExtractionResult> {
    const validation = this.validate(buffer, mimeType);
    if (!validation.valid) {
      throw new AppError(
        validation.error || 'The document failed validation checks prior to processing.',
        400,
        'INVALID_DOCUMENT'
      );
    }

    try {
      // Load pdfjs-dist legacy build for Node.js runtime compatibility
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

      const uint8 = new Uint8Array(buffer);
      const loadingTask = pdfjs.getDocument({
        data: uint8,
        useSystemFonts: true,
      });

      const pdfDoc = await loadingTask.promise;
      const pageCount = pdfDoc.numPages;

      if (pageCount <= 0) {
        throw new AppError('Document contains no readable pages.', 422, 'PROCESSING_FAILED');
      }
      if (pageCount > PdfDocumentProcessor.MAX_PAGES) {
        throw new AppError('PDF exceeds the 100-page processing limit.', 413, 'PROCESSING_LIMIT');
      }

      const pages: ExtractedPageContent[] = [];
      const pageTexts: string[] = [];
      let totalCharacters = 0;

      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Join text items preserving natural token ordering.
        // We preserve source text faithfully without destructive normalization (e.g. no punctuation removal).
        const textItems = textContent.items
          .map((item) => ('str' in item ? (item as { str: string }).str : ''))
          .filter((str) => str.trim().length > 0);

        const pageText = textItems.join(' ').trim();
        totalCharacters += pageText.length;
        if (totalCharacters > PdfDocumentProcessor.MAX_TEXT_CHARACTERS) {
          throw new AppError('PDF contains too much extractable text to process safely.', 413, 'PROCESSING_LIMIT');
        }
        const hasText = pageText.length > 0;

        pages.push({
          pageNumber: pageNum,
          text: pageText,
          hasText,
        });

        if (hasText) {
          pageTexts.push(pageText);
        }
      }

      const fullText = pageTexts.join('\n\n');
      if (!fullText.trim()) {
        throw new AppError('This PDF has no selectable text. Please provide a text-based PDF.', 422, 'NO_EXTRACTABLE_TEXT');
      }

      return {
        pageCount,
        fullText,
        pages,
      };
    } catch (err: unknown) {
      if (err instanceof AppError) {
        throw err;
      }
      // Never leak internal document content or paths in the error
      throw new AppError(
        'Failed to extract pages and text from the PDF document.',
        500,
        'PROCESSING_FAILED'
      );
    }
  }
}

// Singleton default export for the document processor
export const documentProcessor = new PdfDocumentProcessor();
