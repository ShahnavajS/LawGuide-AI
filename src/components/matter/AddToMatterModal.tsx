'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './AddToMatterModal.module.css';
import { Button } from '@/components/ui/Button/Button';
import { Spinner } from '@/components/ui/Spinner/Spinner';
import { MATTER_DOCUMENT_ROLES, MatterDocumentRole } from '@/lib/ai/safety';

const ROLE_LABELS: Record<MatterDocumentRole, string> = {
  PRIMARY_AGREEMENT: 'Primary Agreement — The main contract or agreement',
  REVISED_AGREEMENT: 'Revised Agreement — An updated version of the primary agreement',
  AMENDMENT: 'Amendment — A formal modification to an existing agreement',
  NOTICE: 'Notice — A formal notification document',
  POLICY: 'Policy — An organizational or procedural policy',
  ANNEXURE: 'Annexure — A supplementary document attached to the main agreement',
  SUPPORTING_DOCUMENT: 'Supporting Document — Background or reference material',
  OTHER: 'Other — Unclassified document',
};

interface MatterOption {
  id: string;
  title: string;
  documentCount: number;
}

interface AddToMatterModalProps {
  documentId: string;
  documentTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export const AddToMatterModal: React.FC<AddToMatterModalProps> = ({
  documentId,
  documentTitle,
  isOpen,
  onClose,
}) => {
  const [matters, setMatters] = useState<MatterOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMatterId, setSelectedMatterId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<MatterDocumentRole>('PRIMARY_AGREEMENT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let ignore = false;

    async function loadMatters() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const res = await fetch('/api/matters?status=ACTIVE');
        const data = await res.json();
        if (!ignore && res.ok) {
          setMatters(data.matters || []);
        }
      } catch {
        if (!ignore) setErrorMessage('Unable to load matters. Check your connection.');
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadMatters();
    return () => { ignore = true; };
  }, [isOpen]);

  const handleAdd = async () => {
    if (!selectedMatterId) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/matters/${selectedMatterId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, role: selectedRole }),
      });

      const data = await res.json();
      if (res.ok) {
        const matterName = matters.find((m) => m.id === selectedMatterId)?.title ?? 'the matter';
        setSuccessMessage(`"${documentTitle}" added to "${matterName}".`);
      } else {
        setErrorMessage(data?.error?.message || data?.message || 'Failed to add document to matter.');
      }
    } catch {
      setErrorMessage('Network error while adding document to matter.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedMatterId('');
    setSelectedRole('PRIMARY_AGREEMENT');
    setSuccessMessage(null);
    setErrorMessage(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="atm-title"
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <h2 id="atm-title" className={styles.title}>Add to a Matter</h2>
            <p className={styles.subtitle}>
              Select a matter to add <strong>{documentTitle}</strong> to.
            </p>
          </div>
          <button type="button" onClick={handleClose} className={styles.closeBtn} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {successMessage ? (
            <div className={styles.successState}>
              <div className={styles.successIcon} aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className={styles.successMsg}>{successMessage}</p>
              <div className={styles.successActions}>
                <Link href={`/matters/${selectedMatterId}`}>
                  <Button variant="primary" size="sm">Open Matter →</Button>
                </Link>
                <Button variant="secondary" size="sm" onClick={handleClose}>Done</Button>
              </div>
            </div>
          ) : isLoading ? (
            <div className={styles.loadingState}>
              <Spinner size="md" />
              <span>Loading your matters…</span>
            </div>
          ) : matters.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>You don&apos;t have any active matters yet.</p>
              <Link href="/matters" onClick={handleClose}>
                <Button variant="primary" size="sm">Create a Matter →</Button>
              </Link>
            </div>
          ) : (
            <>
              {errorMessage && (
                <div className={styles.errorBanner} role="alert">{errorMessage}</div>
              )}

              <div className={styles.field}>
                <label className={styles.label} htmlFor="atm-matter-select">Select Matter</label>
                <select
                  id="atm-matter-select"
                  className={styles.select}
                  value={selectedMatterId}
                  onChange={(e) => setSelectedMatterId(e.target.value)}
                >
                  <option value="">— Choose a matter —</option>
                  {matters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.documentCount} doc{m.documentCount === 1 ? '' : 's'})
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="atm-role-select">Document Role</label>
                <select
                  id="atm-role-select"
                  className={styles.select}
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as MatterDocumentRole)}
                >
                  {Object.values(MATTER_DOCUMENT_ROLES).map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.footer}>
                <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleAdd}
                  disabled={!selectedMatterId || isSubmitting}
                  isLoading={isSubmitting}
                >
                  Add to Matter
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
