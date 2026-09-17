'use client';

import React, { useEffect } from 'react';
import { LegalInfoWorkspace } from './LegalInfoWorkspace';

export interface LegalInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic?: string;
  documentId?: string;
  comparisonId?: string;
  onNavigateToDocument?: (docId: string, pageNumber: number) => void;
}

export const LegalInfoModal: React.FC<LegalInfoModalProps> = ({
  isOpen,
  onClose,
  topic = 'TERMINATION',
  documentId,
  comparisonId,
  onNavigateToDocument,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        overflowY: 'auto',
        padding: '2rem 1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Legal Concept Information"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1280px',
          background: '#0b0f19',
          border: '1px solid #d4af37',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
          position: 'relative',
          padding: '1rem',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: '#1e293b',
            color: '#f8fafc',
            border: '1px solid #475569',
            borderRadius: '6px',
            padding: '0.4rem 0.8rem',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.85rem',
            zIndex: 10,
          }}
          aria-label="Close dialog"
        >
          ✕ Close
        </button>

        <LegalInfoWorkspace
          initialTopic={topic}
          initialDocId={documentId}
          initialComparisonId={comparisonId}
          onNavigateToDocument={(docId, page) => {
            onClose();
            onNavigateToDocument?.(docId, page);
          }}
        />
      </div>
    </div>
  );
};
