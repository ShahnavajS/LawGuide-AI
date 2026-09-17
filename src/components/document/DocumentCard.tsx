'use client';

import React, { useState } from 'react';
import styles from './DocumentCard.module.css';
import { Button } from '@/components/ui/Button/Button';
import { Badge } from '@/components/ui/Badge/Badge';
import { Modal } from '@/components/ui/Modal/Modal';
import { AddToMatterModal } from '@/components/matter/AddToMatterModal';
import { DocumentDto } from '@/lib/document/types';

export interface DocumentCardProps {
  document: DocumentDto;
  onDelete?: (id: string) => Promise<void> | void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recent';
  }
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  onDelete,
}) => {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddToMatterOpen, setIsAddToMatterOpen] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;
    try {
      setIsDeleting(true);
      await onDelete(document.id);
      setIsDeleteModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className={styles.card} tabIndex={0} aria-label={`Document card for ${document.title}`}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <div className={styles.docIcon} aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <div className={styles.titleGroup}>
              <h3 className={styles.title} title={document.title}>
                {document.title}
              </h3>
              <span className={styles.filename} title={document.originalFilename}>
                {document.originalFilename}
              </span>
            </div>
          </div>

          <Badge variant="fact" showDot>
            {document.status === 'UPLOADED' ? 'Uploaded' : document.status}
          </Badge>
        </div>

        <div className={styles.metaRow}>
          <div className={styles.metaItem}>
            <span>Size:</span>
            <strong>{formatFileSize(document.fileSize)}</strong>
          </div>
          {document.pageCount != null && (
            <div className={styles.metaItem}>
              <span>Pages:</span>
              <strong>{document.pageCount}</strong>
            </div>
          )}
          <div className={styles.metaItem}>
            <span>Uploaded:</span>
            <strong>{formatDate(document.createdAt)}</strong>
          </div>
          <div className={styles.metaItem}>
            <span>Status:</span>
            <Badge
              variant={
                document.status === 'READY'
                  ? 'fact'
                  : document.status === 'FAILED'
                  ? 'risk'
                  : 'review'
              }
            >
              {document.status}
            </Badge>
          </div>
        </div>

        <div className={styles.actionsRow}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {document.status === 'READY'
              ? 'Ready — open workspace to analyze'
              : document.status === 'PROCESSING'
              ? 'Processing document pages…'
              : 'Uploaded — click to prepare'}
          </span>

          <div className={styles.actionButtons}>
            <a
              href={`/analyze/${document.id}`}
              aria-label={`Open ${document.title} in document workspace`}
            >
              <Button size="sm" variant="primary">
                Open Workspace
              </Button>
            </a>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsAddToMatterOpen(true)}
              aria-label={`Add ${document.title} to a legal matter`}
            >
              + Add to Matter
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsDeleteModalOpen(true)}
              aria-label={`Remove ${document.title} from workspace`}
            >
              Remove
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
        title="Remove Document"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={isDeleting}
            >
              Remove from Workspace
            </Button>
          </>
        }
      >
        <p>
          Are you sure you want to remove <strong>{document.originalFilename}</strong> from your legal workspace?
        </p>
        <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          This will permanently delete the stored document file and its registered metadata.
        </p>
      </Modal>

      {/* Add to Matter Modal */}
      <AddToMatterModal
        isOpen={isAddToMatterOpen}
        onClose={() => setIsAddToMatterOpen(false)}
        documentId={document.id}
        documentTitle={document.title}
      />
    </>
  );
};
