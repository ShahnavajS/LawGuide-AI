'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import type { DocumentViewerProps } from './DocumentViewerImpl';
import styles from './DocumentViewer.module.css';

export type { DocumentViewerProps };

/**
 * Dynamic client-only DocumentViewer wrapper.
 * Guarantees pdfjs-dist and react-pdf are never evaluated during SSR.
 */
export const DocumentViewer = dynamic<DocumentViewerProps>(
  () => import('./DocumentViewerImpl').then((mod) => mod.DocumentViewerImpl),
  {
    ssr: false,
    loading: () => (
      <div className={styles.viewerPlaceholder} role="status" aria-live="polite">
        <div className={styles.spinner} aria-hidden="true" />
        <span>Preparing the PDF viewer…</span>
        <small>The first open can take a moment.</small>
      </div>
    ),
  }
);
