/**
 * Document File Validation and Sanitization.
 * Enforces strict verification of legal PDF uploads.
 */

export const MAX_DOCUMENT_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
export const ALLOWED_MIME_TYPES = ['application/pdf', 'application/x-pdf'];
export const ALLOWED_EXTENSIONS = ['.pdf'];
export const PDF_MAGIC_BYTES = Buffer.from('%PDF-'); // 0x25, 0x50, 0x44, 0x46, 0x2D

export interface DocumentValidationResult {
  isValid: boolean;
  error?: string;
  errorCode?: 'UNSUPPORTED_TYPE' | 'FILE_TOO_LARGE' | 'INVALID_SIGNATURE' | 'EMPTY_FILE' | 'INVALID_FILENAME';
  statusCode?: number;
}

/**
 * Sanitizes original filename for metadata display and storage safety.
 * Strips directory traversal sequences, control characters, and excess length.
 */
export function sanitizeOriginalFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'document.pdf';
  }

  // Remove directory separators, null bytes, and path traversal sequences
  const baseName = filename
    .replace(/[/\\]+/g, '')
    .replace(/\.\.+/g, '')
    .replace(/^[\s.]+/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();

  // Truncate to maximum 120 characters while preserving extension
  if (baseName.length > 120) {
    const ext = baseName.endsWith('.pdf') ? '.pdf' : '';
    return `${baseName.substring(0, 116)}${ext}`;
  }

  return baseName || 'document.pdf';
}

/**
 * Validates that the filename has a .pdf extension.
 */
export function validatePdfExtension(filename: string): DocumentValidationResult {
  if (!filename || typeof filename !== 'string') {
    return {
      isValid: false,
      error: 'Filename is missing or invalid.',
      errorCode: 'INVALID_FILENAME',
      statusCode: 400,
    };
  }

  const lower = filename.toLowerCase();
  const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));

  if (!hasValidExt) {
    return {
      isValid: false,
      error: 'LawGuide currently supports PDF documents only.',
      errorCode: 'UNSUPPORTED_TYPE',
      statusCode: 415,
    };
  }

  return { isValid: true };
}

/**
 * Validates the reported MIME type.
 */
export function validatePdfMimeType(mimeType: string): DocumentValidationResult {
  if (!mimeType) {
    return {
      isValid: false,
      error: 'MIME type is missing.',
      errorCode: 'UNSUPPORTED_TYPE',
      statusCode: 415,
    };
  }

  const normalized = mimeType.toLowerCase().trim();
  if (!ALLOWED_MIME_TYPES.includes(normalized)) {
    return {
      isValid: false,
      error: 'LawGuide currently supports PDF documents only.',
      errorCode: 'UNSUPPORTED_TYPE',
      statusCode: 415,
    };
  }

  return { isValid: true };
}

/**
 * Validates the file size against the 20 MB limit and verifies it is not empty.
 */
export function validatePdfFileSize(sizeBytes: number): DocumentValidationResult {
  if (sizeBytes <= 0) {
    return {
      isValid: false,
      error: 'The uploaded file is empty.',
      errorCode: 'EMPTY_FILE',
      statusCode: 400,
    };
  }

  if (sizeBytes > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `That file is larger than the 20 MB limit.`,
      errorCode: 'FILE_TOO_LARGE',
      statusCode: 413,
    };
  }

  return { isValid: true };
}

/**
 * Validates the binary header/signature for %PDF- magic bytes.
 * Protects against spoofed files renamed with a .pdf extension.
 */
export function validatePdfMagicBytes(buffer: Buffer): DocumentValidationResult {
  if (!buffer || buffer.length < 5) {
    return {
      isValid: false,
      error: 'The uploaded file is too small to be a valid PDF.',
      errorCode: 'INVALID_SIGNATURE',
      statusCode: 400,
    };
  }

  // Per ISO 32000-1, the %PDF- header should appear in the first 1024 bytes
  const headerSlice = buffer.subarray(0, Math.min(buffer.length, 1024));
  const hasMagicBytes = headerSlice.indexOf(PDF_MAGIC_BYTES) !== -1;

  if (!hasMagicBytes) {
    return {
      isValid: false,
      error: 'The uploaded file does not appear to be a valid PDF.',
      errorCode: 'INVALID_SIGNATURE',
      statusCode: 400,
    };
  }

  return { isValid: true };
}

/**
 * Executes server-side validation pipeline for a PDF buffer.
 */
export function validatePdfBuffer(
  buffer: Buffer,
  mimeType: string
): DocumentValidationResult {
  const mimeCheck = validatePdfMimeType(mimeType);
  if (!mimeCheck.isValid) return mimeCheck;

  const sizeCheck = validatePdfFileSize(buffer.length);
  if (!sizeCheck.isValid) return sizeCheck;

  const magicCheck = validatePdfMagicBytes(buffer);
  if (!magicCheck.isValid) return magicCheck;

  return { isValid: true };
}

/**
 * Executes full server-side validation pipeline for an uploaded document.
 */
export function validateDocumentUpload(
  filename: string,
  mimeType: string,
  buffer: Buffer
): DocumentValidationResult {
  // 1. Extension check
  const extCheck = validatePdfExtension(filename);
  if (!extCheck.isValid) return extCheck;

  // 2. MIME type, size, and magic bytes check
  return validatePdfBuffer(buffer, mimeType);
}

