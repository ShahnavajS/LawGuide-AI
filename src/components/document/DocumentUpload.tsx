'use client';

import { apiFetch } from '@/lib/api/client';

import React, { useState, useRef } from 'react';
import styles from './DocumentUpload.module.css';
import { Spinner } from '@/components/ui/Spinner/Spinner';
import { DocumentDto } from '@/lib/document/types';
import { MAX_DOCUMENT_FILE_SIZE_BYTES } from '@/lib/document/validation';

export type UploadState = 'IDLE' | 'DRAGGING' | 'VALIDATING' | 'UPLOADING' | 'SUCCESS' | 'ERROR';

export interface DocumentUploadProps {
  onUploadSuccess?: (document: DocumentDto) => void;
  disabled?: boolean;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  onUploadSuccess,
  disabled = false,
}) => {
  const [state, setState] = useState<UploadState>('IDLE');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setState('IDLE');
    setErrorMessage(null);
    setStatusMessage('');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || state === 'UPLOADING') return;
    if (state !== 'DRAGGING') {
      setState('DRAGGING');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (state === 'DRAGGING') {
      setState('IDLE');
    }
  };

  const processFile = async (file: File) => {
    setErrorMessage(null);
    setState('VALIDATING');

    // 1. Client-side extension validation
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.pdf')) {
      setState('ERROR');
      setErrorMessage('LawGuide currently supports PDF documents only.');
      return;
    }

    // 2. Client-side size validation
    if (file.size <= 0) {
      setState('ERROR');
      setErrorMessage('The selected file is empty.');
      return;
    }

    if (file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
      setState('ERROR');
      setErrorMessage('That file is larger than the 20 MB limit.');
      return;
    }

    // 3. Upload to server
    setState('UPLOADING');
    setStatusMessage('Uploading document...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiFetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data?.error?.message || 'Failed to upload document.';
        setState('ERROR');
        setErrorMessage(errorMsg);
        return;
      }

      setState('SUCCESS');
      setStatusMessage(`"${data.document.title}" uploaded successfully.`);

      if (onUploadSuccess) {
        onUploadSuccess(data.document);
      }

      // Reset to IDLE after a short success display
      setTimeout(() => {
        setState('IDLE');
        setStatusMessage('');
      }, 3000);
    } catch {
      setState('ERROR');
      setErrorMessage('A network error occurred while uploading. Please check your connection and retry.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || state === 'UPLOADING') return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    } else {
      setState('IDLE');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleClick = () => {
    if (disabled || state === 'UPLOADING') return;
    fileInputRef.current?.click();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div className={styles.statusContainer} role="region" aria-label="Legal Document Upload Area">
      <div
        className={[
          styles.dropzone,
          state === 'DRAGGING' ? styles.dragging : '',
          state === 'UPLOADING' ? styles.uploading : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        tabIndex={disabled || state === 'UPLOADING' ? -1 : 0}
        role="button"
        aria-label="Upload PDF Document. Drag and drop file or press enter to browse."
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className={styles.fileInput}
          onChange={handleFileChange}
          disabled={disabled || state === 'UPLOADING'}
          tabIndex={-1}
        />

        {state === 'UPLOADING' ? (
          <div className={styles.progressContainer}>
            <Spinner size="lg" />
            <span className={styles.progressText}>{statusMessage}</span>
            <span className={styles.secondaryText}>Verifying format and registering document metadata</span>
          </div>
        ) : (
          <>
            <div className={styles.iconCircle} aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>

            <div>
              <p className={styles.primaryText}>
                <span className={styles.highlightText}>Choose a PDF</span> or drag it here
              </p>
              <p className={styles.secondaryText}>PDF documents only &bull; Up to 20 MB</p>
            </div>

            <p className={styles.uploadNote}>Review the document before relying on any AI explanation.</p>
          </>
        )}
      </div>

      {/* Screen Reader and Visual Alerts */}
      <div aria-live="polite" style={{ marginTop: 'var(--space-3)' }}>
        {state === 'ERROR' && errorMessage && (
          <div className={styles.errorMessage} role="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={resetState}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
              aria-label="Dismiss error"
            >
              &times;
            </button>
          </div>
        )}

        {state === 'SUCCESS' && statusMessage && (
          <div className={styles.successMessage}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>{statusMessage}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
