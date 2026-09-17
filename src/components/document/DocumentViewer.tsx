'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import type { DocumentViewerProps } from './DocumentViewerImpl';

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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '400px',
          backgroundColor: '#0f172a',
          borderRadius: '0.75rem',
          color: '#94a3b8',
          fontSize: '0.9rem',
        }}
      >
        Loading document viewer...
      </div>
    ),
  }
);
