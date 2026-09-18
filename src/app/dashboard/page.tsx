'use client';

import React, { useState, useEffect } from 'react';
import styles from './dashboard.module.css';
import { DocumentUpload } from '@/components/document/DocumentUpload';
import { DocumentList } from '@/components/document/DocumentList';
import { OnboardingBanner } from '@/components/onboarding/OnboardingBanner';
import { DocumentDto } from '@/lib/document/types';
import { LEGAL_DISCLAIMERS } from '@/lib/ai/safety';
import Link from 'next/link';

export default function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadWorkspace() {
      try {
        const res = await fetch('/api/documents');
        const data = await res.json();

        if (!ignore) {
          if (res.ok && Array.isArray(data.documents)) {
            setDocuments(data.documents);
          } else {
            setErrorMessage(data?.error?.message || 'Failed to load workspace documents.');
          }
        }
      } catch {
        if (!ignore) {
          setErrorMessage('Network error while connecting to workspace.');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadWorkspace();

    return () => {
      ignore = true;
    };
  }, []);

  const handleUploadSuccess = (newDoc: DocumentDto) => {
    setDocuments((prev) => [newDoc, ...prev]);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== id));
      } else {
        const data = await res.json();
        alert(data?.error?.message || 'Failed to delete document.');
      }
    } catch {
      alert('Network error while attempting to delete document.');
    }
  };

  return (
    <div className={`container ${styles.dashboardWrapper}`}>
      {/* Onboarding Banner (dismissed via localStorage) */}
      <OnboardingBanner documentCount={documents.length} />

      {/* Dashboard Header */}
      <div className={styles.headerSection}>
        <div className={styles.titleGroup}>
          <p className={styles.eyebrow}>YOUR DOCUMENTS</p>
          <h1 className={styles.title}>A closer read starts here.</h1>
          <p className={styles.subtitle}>
            Add a PDF to understand its terms, ask questions, or compare it with another version.
          </p>
        </div>

        <span className={styles.headerAside}>DOCUMENT WORKSPACE <span aria-hidden="true">/</span> 01</span>
      </div>

      {/* Safety Notice Banner */}
      <div className={styles.banner}>
        <div className={styles.bannerDot} />
        <span>
          <strong>Notice:</strong> {LEGAL_DISCLAIMERS.ANALYSIS_BANNER}
        </span>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--status-risk-high-bg)',
            border: '1px solid var(--status-risk-high-border)',
            color: 'var(--status-risk-high-text)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-6)',
            fontSize: 'var(--font-size-xs)',
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Upload Dropzone Section */}
      <section className={styles.uploadSection} aria-label="Upload Legal Document">
        <DocumentUpload onUploadSuccess={handleUploadSuccess} />
      </section>

      {/* Uploaded Documents List */}
      <section className={styles.documentsSection} aria-label="Workspace Documents">
        <DocumentList
          documents={documents}
          isLoading={isLoading}
          onDelete={handleDelete}
        />
      </section>

      {/* Workflow CTA Cards */}
      <div className={styles.workflowGrid}>
        <Link href="/compare" className={styles.workflowCard}>
          <div className={styles.workflowIcon} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <div>
            <h3 className={styles.workflowTitle}>Compare Two Versions</h3>
            <p className={styles.workflowText}>
              Upload two versions of a contract to instantly identify substantive differences and shifted obligations.
            </p>
            <span className={styles.workflowLink}>Go to Compare →</span>
          </div>
        </Link>

        <Link href="/matters" className={styles.workflowCard}>
          <div className={styles.workflowIcon} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <h3 className={styles.workflowTitle}>Organize into a Matter</h3>
            <p className={styles.workflowText}>
              Group related documents under a Matter for cross-document intelligence, timelines, and counsel preparation.
            </p>
            <span className={styles.workflowLink}>View Matters →</span>
          </div>
        </Link>

        <Link href="/legal-info" className={styles.workflowCard}>
          <div className={styles.workflowIcon} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div>
            <h3 className={styles.workflowTitle}>Legal Navigator</h3>
            <p className={styles.workflowText}>
              Browse educational legal topics with curated source links, clear jurisdiction limits, and counsel questions.
            </p>
            <span className={styles.workflowLink}>Explore Topics →</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
