/**
 * Document types and storage abstractions for LexiGuide AI.
 */

export type DocumentProcessingStatus = 'UPLOADED' | 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface DocumentDto {
  id: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  pageCount?: number | null;
  documentType?: string | null;
  status: DocumentProcessingStatus;
  processingError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentPageDto {
  id: string;
  documentId: string;
  pageNumber: number;
  text: string;
  createdAt: string;
}

export interface DocumentUploadResponse {
  document: DocumentDto;
}

export interface DocumentProcessResponse {
  document: DocumentDto;
  pageCount: number;
}

export interface DocumentPagesResponse {
  documentId: string;
  pageCount: number;
  pages: DocumentPageDto[];
}

export interface DocumentListResponse {
  documents: DocumentDto[];
}

export interface StoredFileRef {
  storagePath: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
}

export interface UploadDocumentInput {
  filename: string;
  mimeType: string;
  content: Buffer;
}

export interface ExtractedPageContent {
  pageNumber: number;
  text: string;
  hasText: boolean;
}

export interface DocumentExtractionResult {
  documentId?: string;
  pageCount: number;
  fullText: string;
  pages: ExtractedPageContent[];
}
