import { describe, it, expect } from 'vitest';
import {
  validatePdfExtension,
  validatePdfMimeType,
  validatePdfFileSize,
  validatePdfMagicBytes,
  validateDocumentUpload,
  sanitizeOriginalFilename,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
} from '@/lib/document/validation';

describe('Document Validation Suite', () => {
  describe('File Extension Validation', () => {
    it('accepts valid lowercase and uppercase .pdf extensions', () => {
      expect(validatePdfExtension('contract.pdf').isValid).toBe(true);
      expect(validatePdfExtension('LEASE_AGREEMENT.PDF').isValid).toBe(true);
      expect(validatePdfExtension('non-disclosure.Pdf').isValid).toBe(true);
    });

    it('rejects unsupported file formats', () => {
      const unsupported = [
        'contract.docx',
        'terms.doc',
        'policy.txt',
        'id_scan.png',
        'document.jpg',
        'archive.zip',
        'page.html',
        'malware.exe',
        'no_extension',
      ];

      for (const filename of unsupported) {
        const result = validatePdfExtension(filename);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('supports PDF documents only');
        expect(result.statusCode).toBe(415);
      }
    });
  });

  describe('MIME Type Validation', () => {
    it('accepts standard PDF MIME types', () => {
      expect(validatePdfMimeType('application/pdf').isValid).toBe(true);
      expect(validatePdfMimeType('application/x-pdf').isValid).toBe(true);
      expect(validatePdfMimeType(' APPLICATION/PDF ').isValid).toBe(true);
    });

    it('rejects non-PDF MIME types', () => {
      const invalidMimes = [
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png',
        'image/jpeg',
        'application/octet-stream',
      ];

      for (const mime of invalidMimes) {
        const result = validatePdfMimeType(mime);
        expect(result.isValid).toBe(false);
        expect(result.statusCode).toBe(415);
      }
    });
  });

  describe('File Size Validation', () => {
    it('accepts files within the 20 MB limit', () => {
      expect(validatePdfFileSize(1024).isValid).toBe(true); // 1 KB
      expect(validatePdfFileSize(5 * 1024 * 1024).isValid).toBe(true); // 5 MB
      expect(validatePdfFileSize(MAX_DOCUMENT_FILE_SIZE_BYTES).isValid).toBe(true); // exactly 20 MB
    });

    it('rejects empty files (0 bytes)', () => {
      const result = validatePdfFileSize(0);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('file is empty');
      expect(result.statusCode).toBe(400);
    });

    it('rejects files exceeding 20 MB', () => {
      const result = validatePdfFileSize(MAX_DOCUMENT_FILE_SIZE_BYTES + 1);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('larger than the 20 MB limit');
      expect(result.statusCode).toBe(413);
    });
  });

  describe('PDF Magic Bytes (Signature) Validation', () => {
    it('accepts files with valid %PDF- header at offset 0', () => {
      const validPdfBuffer = Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj...');
      const result = validatePdfMagicBytes(validPdfBuffer);
      expect(result.isValid).toBe(true);
    });

    it('accepts files with valid %PDF- header within the first 1024 bytes', () => {
      const leadingWhitespace = Buffer.from('\r\n   %PDF-2.0 valid header');
      const result = validatePdfMagicBytes(leadingWhitespace);
      expect(result.isValid).toBe(true);
    });

    it('rejects spoofed text files renamed to .pdf', () => {
      const fakePdfBuffer = Buffer.from('This is a plain text file renamed to test.pdf');
      const result = validatePdfMagicBytes(fakePdfBuffer);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('does not appear to be a valid PDF');
      expect(result.statusCode).toBe(400);
    });

    it('rejects Windows executable (PE/MZ) renamed to .pdf', () => {
      const exeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00ThisIsAnExecutable');
      const result = validatePdfMagicBytes(exeBuffer);
      expect(result.isValid).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it('rejects ZIP/DOCX files (PK header) renamed to .pdf', () => {
      const zipBuffer = Buffer.from('PK\x03\x04\x14\x00\x00\x00ZipArchiveContent');
      const result = validatePdfMagicBytes(zipBuffer);
      expect(result.isValid).toBe(false);
      expect(result.statusCode).toBe(400);
    });
  });

  describe('Filename Sanitization & Path Traversal Prevention', () => {
    it('neutralizes directory traversal patterns', () => {
      expect(sanitizeOriginalFilename('../../../etc/passwd')).not.toContain('..');
      expect(sanitizeOriginalFilename('../../../etc/passwd')).not.toContain('/');
      expect(sanitizeOriginalFilename('..\\..\\secret.pdf')).toBe('secret.pdf');
      expect(sanitizeOriginalFilename('../../database.db')).toBe('database.db');
    });

    it('removes control characters and dangerous symbols', () => {
      const dangerous = 'agreement\x00\x1F<script>"test".pdf';
      const sanitized = sanitizeOriginalFilename(dangerous);
      expect(sanitized).not.toContain('\x00');
      expect(sanitized).not.toContain('\x1F');
      expect(sanitized.endsWith('.pdf')).toBe(true);
    });

    it('truncates excessively long filenames while retaining the extension', () => {
      const veryLong = 'a'.repeat(200) + '.pdf';
      const sanitized = sanitizeOriginalFilename(veryLong);
      expect(sanitized.length).toBeLessThanOrEqual(120);
      expect(sanitized.endsWith('.pdf')).toBe(true);
    });
  });

  describe('Full Document Upload Validation Pipeline', () => {
    it('passes for a conforming PDF upload', () => {
      const validBuffer = Buffer.from('%PDF-1.4\nLegal Content');
      const result = validateDocumentUpload('contract.pdf', 'application/pdf', validBuffer);
      expect(result.isValid).toBe(true);
    });

    it('fails if extension is invalid even with PDF magic bytes', () => {
      const validBuffer = Buffer.from('%PDF-1.4\nLegal Content');
      const result = validateDocumentUpload('contract.docx', 'application/pdf', validBuffer);
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('UNSUPPORTED_TYPE');
    });

    it('fails if MIME type is mismatched even with valid extension', () => {
      const validBuffer = Buffer.from('%PDF-1.4\nLegal Content');
      const result = validateDocumentUpload('contract.pdf', 'image/png', validBuffer);
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('UNSUPPORTED_TYPE');
    });

    it('fails if binary signature does not match PDF', () => {
      const badBuffer = Buffer.from('Not a pdf file');
      const result = validateDocumentUpload('contract.pdf', 'application/pdf', badBuffer);
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('INVALID_SIGNATURE');
    });
  });
});
