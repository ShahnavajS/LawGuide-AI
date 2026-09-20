'use client';

import { apiFetch } from '@/lib/api/client';

import { LinkButton } from '@/components/ui/Button/LinkButton';

import React, { useState, useEffect, useRef } from 'react';
import styles from './MatterList.module.css';
import { Button } from '@/components/ui/Button/Button';
import { Spinner } from '@/components/ui/Spinner/Spinner';

interface MatterSummary {
  id: string;
  title: string;
  description: string | null;
  jurisdiction: string | null;
  jurisdictionProvenance: string;
  status: string;
  documentCount: number;
  analyzedCount: number;
  createdAt: string;
  updatedAt: string;
}

export const MatterList: React.FC = () => {
  const [matters, setMatters] = useState<MatterSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const createDialogRef = useRef<HTMLDialogElement>(null);

  // New matter form state
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newJurisdiction, setNewJurisdiction] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  useEffect(() => {
    const dialog = createDialogRef.current;
    if (isCreateModalOpen && dialog && !dialog.open) dialog.showModal();
    if (!isCreateModalOpen && dialog?.open) dialog.close();
    return () => { if (dialog?.open) dialog.close(); };
  }, [isCreateModalOpen]);

  useEffect(() => {
    let ignore = false;
    async function loadMatters() {
      try {
        const res = await apiFetch(`/api/matters?status=${statusFilter}`);
        if (ignore) return;
        if (!res.ok) {
          throw new Error('Failed to load legal matters.');
        }
        const data = await res.json();
        if (ignore) return;
        setMatters(data.matters || []);
        setError(null);
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to load matters.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadMatters();
    return () => {
      ignore = true;
    };
  }, [statusFilter, refreshTrigger]);

  const handleCreateMatter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await apiFetch('/api/matters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
          jurisdiction: newJurisdiction.trim() || undefined,
          jurisdictionProvenance: newJurisdiction.trim()
            ? 'USER_PROVIDED'
            : 'NOT_ESTABLISHED',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to create matter.');
      }

      setNewTitle('');
      setNewDescription('');
      setNewJurisdiction('');
      setIsCreateModalOpen(false);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error creating matter');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Hero Header */}
      <div className={styles.heroHeader}>
        <div className={styles.heroTitleGroup}>
          <div className={styles.heroBadge}>
            <span>MATTER WORKSPACE</span>
          </div>
          <h1 className={styles.heroTitle}>Legal Matters</h1>
          <p className={styles.heroSubtitle}>
            Organize related contracts, amendments, notices, policies, and supporting documents under unified
            case context. Explore cross-document references, detect potential inconsistencies, and prepare for counsel.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsCreateModalOpen(true)}
          aria-label="Create New Legal Matter"
        >
          + Create Matter
        </Button>
      </div>

      {/* Filter Controls */}
      <div className={styles.filterControls}>
        <div className={styles.tabGroup} role="tablist" aria-label="Matter Status">
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'ACTIVE'}
            className={`${styles.tabBtn} ${statusFilter === 'ACTIVE' ? styles.tabBtnActive : ''}`}
            onClick={() => setStatusFilter('ACTIVE')}
          >
            Active Matters
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'ARCHIVED'}
            className={`${styles.tabBtn} ${statusFilter === 'ARCHIVED' ? styles.tabBtnActive : ''}`}
            onClick={() => setStatusFilter('ARCHIVED')}
          >
            Archived
          </button>
        </div>

        <div className={styles.statsText}>
          {matters.length} {statusFilter === 'ACTIVE' ? 'active' : 'archived'} matter
          {matters.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⚠️</div>
          <h2 className={styles.emptyTitle}>Unable to load matters</h2>
          <p className={styles.emptyDesc}>{error}</p>
          <Button variant="secondary" onClick={() => setRefreshTrigger((p) => p + 1)}>
            Retry
          </Button>
        </div>
      ) : matters.length === 0 ? (
        <div className={styles.emptyState}>
          {statusFilter === 'ACTIVE' ? (
            <>
              <div className={styles.emptyIllustration}>
                <div className={styles.emptyStep}>
                  <div className={styles.emptyStepIcon}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>
                  <div>
                    <div className={styles.emptyStepTitle}>Analyze a Document</div>
                    <p className={styles.emptyStepDesc}>Upload a contract or lease and run Legal X-Ray to extract key provisions.</p>
                    <a href="/dashboard" className={styles.emptyStepLink}>Go to Documents →</a>
                  </div>
                </div>
                <div className={styles.emptyStepArrow} aria-hidden="true">›</div>
                <div className={styles.emptyStep}>
                  <div className={styles.emptyStepIcon}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className={styles.emptyStepTitle}>Create a Matter</div>
                    <p className={styles.emptyStepDesc}>Group related documents under a shared case context for cross-document intelligence.</p>
                    <button type="button" onClick={() => setIsCreateModalOpen(true)} className={styles.emptyStepLink}>
                      + Create Matter
                    </button>
                  </div>
                </div>
                <div className={styles.emptyStepArrow} aria-hidden="true">›</div>
                <div className={styles.emptyStep}>
                  <div className={styles.emptyStepIcon}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div>
                    <div className={styles.emptyStepTitle}>Add Documents</div>
                    <p className={styles.emptyStepDesc}>Add your analyzed documents to explore relationships, timelines, and prepare for counsel.</p>
                  </div>
                </div>
              </div>
              <div className={styles.emptyActions}>
                <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
                  + Create Your First Matter
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.emptyIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h2 className={styles.emptyTitle}>No archived matters</h2>
              <p className={styles.emptyDesc}>Matters that you archive will appear here.</p>
            </>
          )}
        </div>
      ) : (
        <div className={styles.mattersGrid}>
          {matters.map((matter) => (
            <div key={matter.id} className={styles.matterCard}>
              <div>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>{matter.title}</h2>
                  <span
                    className={`${styles.jurisdictionPill} ${
                      matter.jurisdictionProvenance === 'NOT_ESTABLISHED'
                        ? styles.jurisdictionNotEstablished
                        : ''
                    }`}
                  >
                    🏛️ {matter.jurisdiction || 'Jurisdiction Not Set'}
                  </span>
                </div>

                <p className={styles.cardDescription}>
                  {matter.description || 'No description provided for this legal matter.'}
                </p>

                <div className={styles.cardMetrics}>
                  <div className={styles.metricItem}>
                    <span className={styles.metricLabel}>Documents</span>
                    <span className={styles.metricValue}>{matter.documentCount}</span>
                  </div>
                  <div className={styles.metricItem}>
                    <span className={styles.metricLabel}>Analyzed</span>
                    <span className={styles.metricValue}>
                      {matter.analyzedCount} / {matter.documentCount}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.dateText}>
                  Updated {new Date(matter.updatedAt).toLocaleDateString()}
                </span>
                <LinkButton href={`/matters/${matter.id}`} size="sm" variant="secondary">Open Matter →</LinkButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Matter Modal */}
      <dialog
          ref={createDialogRef}
          className={styles.modalBackdrop}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreateModalOpen(false);
          }}
          onCancel={(e) => { e.preventDefault(); setIsCreateModalOpen(false); }}
          aria-labelledby="modal-title"
        >
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 id="modal-title" className={styles.modalTitle}>
                Create Legal Matter
              </h2>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setIsCreateModalOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMatter}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="matter-title">
                  Matter Title *
                </label>
                <input
                  id="matter-title"
                  type="text"
                  required
                  placeholder="e.g. Employment Agreement Review — Acme Corp"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className={styles.formInput}
                  autoFocus
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="matter-desc">
                  Description / Context
                </label>
                <textarea
                  id="matter-desc"
                  rows={3}
                  placeholder="Brief summary of this legal matter, parties involved, or background context..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className={styles.formTextArea}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="matter-jurisdiction">
                  Governing Jurisdiction (Optional)
                </label>
                <input
                  id="matter-jurisdiction"
                  type="text"
                  placeholder="e.g. India / California / United Kingdom"
                  value={newJurisdiction}
                  onChange={(e) => setNewJurisdiction(e.target.value)}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.modalActions}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting || !newTitle.trim()}>
                  {isSubmitting ? 'Creating...' : 'Create Matter'}
                </Button>
              </div>
            </form>
          </div>
      </dialog>
    </div>
  );
};
