'use client';

import React from 'react';
import styles from './DocumentList.module.css';
import { DocumentCard } from './DocumentCard';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';
import { DocumentDto } from '@/lib/document/types';

export interface DocumentListProps {
  documents: DocumentDto[];
  isLoading?: boolean;
  onDelete?: (id: string) => Promise<void> | void;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  isLoading = false,
  onDelete,
}) => {
  if (isLoading) {
    return (
      <div className={styles.grid}>
        <Skeleton height={180} />
        <Skeleton height={180} />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundColor: 'var(--color-brand-50)',
            color: 'var(--color-brand-600)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--space-2)',
          }}
          aria-hidden="true"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <h3 className={styles.emptyTitle}>No documents yet</h3>
        <p className={styles.emptyText}>
          Upload a legal contract, lease, or agreement above to analyze your first document with Legal X-Ray.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>
          Uploaded Documents ({documents.length})
        </h2>
      </div>

      <div className={styles.grid}>
        {documents.map((doc) => (
          <DocumentCard key={doc.id} document={doc} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
};
