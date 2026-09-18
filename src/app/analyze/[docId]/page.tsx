'use client';

import { LinkButton } from '@/components/ui/Button/LinkButton';

import React, { useState, useEffect, use } from 'react';
import styles from './analyze.module.css';
import { DocumentViewer } from '@/components/document/DocumentViewer';
import { DocumentQuestionPanel } from '@/components/document/DocumentQuestionPanel';
import { LegalXRay } from '@/components/analysis/LegalXRay';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { AddToMatterModal } from '@/components/matter/AddToMatterModal';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import { DocumentDto } from '@/lib/document/types';
import { LegalXRayAnalysis } from '@/lib/ai/schemas';
import { LEGAL_DISCLAIMERS } from '@/lib/ai/safety';

interface AnalyzePageProps {
  params: Promise<{ docId: string }>;
}

export default function AnalyzePage({ params }: AnalyzePageProps) {
  const { docId } = use(params);

  const [document, setDocument] = useState<DocumentDto | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isNotFound, setIsNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Phase 4: Legal X-Ray & Citation Navigation State
  const [analysis, setAnalysis] = useState<LegalXRayAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<number>(1);
  const [isAddToMatterOpen, setIsAddToMatterOpen] = useState(false);

  // Initialize workspace & fetch document + cached analysis
  useEffect(() => {
    let ignore = false;

    async function initDocumentWorkspace() {
      try {
        const res = await fetch(`/api/documents/${docId}`);
        if (ignore) return;

        if (res.status === 404) {
          setIsNotFound(true);
          return;
        }

        const data = await res.json();
        if (ignore) return;

        if (res.ok && data.document) {
          setDocument(data.document);

          // If document is newly uploaded, trigger initial preparation automatically
          if (data.document.status === 'UPLOADED' && data.document.fileAvailable !== false) {
            setIsProcessing(true);
            try {
              const procRes = await fetch(`/api/documents/${docId}/process`, {
                method: 'POST',
              });
              const procData = await procRes.json();
              if (ignore) return;

              if (procRes.ok && procData.document) {
                setDocument(procData.document);
              } else {
                setErrorMessage(
                  procData?.error?.message ||
                    'Something went wrong while preparing this document.'
                );
              }
            } catch {
              if (!ignore) {
                setErrorMessage('Network error while processing document.');
              }
            } finally {
              if (!ignore) {
                setIsProcessing(false);
              }
            }
          }

          // If document is already READY, check for existing analysis
          if (data.document.status === 'READY') {
            try {
              const anaRes = await fetch(`/api/documents/${docId}/analysis`);
              const anaData = await anaRes.json();
              if (!ignore && anaRes.ok && anaData.analysis) {
                setAnalysis(anaData.analysis);
              }
            } catch {
              // Ignore failure to load cached analysis; user can click Analyze
            }
          }
        } else {
          setErrorMessage(data?.error?.message || 'Failed to load document metadata.');
        }
      } catch {
        if (!ignore) {
          setErrorMessage('Network error loading document.');
        }
      } finally {
        if (!ignore) {
          setIsLoadingDoc(false);
        }
      }
    }

    initDocumentWorkspace();

    return () => {
      ignore = true;
    };
  }, [docId]);

  // Document processing retry trigger
  const handleRetryProcessing = async () => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);
      setErrorMessage(null);

      const res = await fetch(`/api/documents/${docId}/process`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok && data.document) {
        setDocument(data.document);
      } else {
        setErrorMessage(
          data?.error?.message || 'Something went wrong while preparing this document.'
        );
      }
    } catch {
      setErrorMessage('Network connection lost while processing document.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Phase 4: Legal X-Ray Trigger
  const handleRunAnalysis = async (force = false) => {
    if (isAnalyzing) return;

    try {
      setIsAnalyzing(true);
      setAnalysisError(null);

      const res = await fetch(`/api/documents/${docId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });

      const data = await res.json();

      if (res.ok && data.analysis) {
        setAnalysis(data.analysis);
      } else {
        setAnalysisError(
          data?.error?.message ||
            'Something went wrong during legal analysis. Please check your document and retry.'
        );
      }
    } catch {
      setAnalysisError('Network error while performing Legal X-Ray analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isNotFound) {
    return (
      <div className={`container ${styles.notFoundContainer}`}>
        <h2>Document Not Found</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          The requested document could not be found or has been removed from your workspace.
        </p>
        <LinkButton href="/dashboard" variant="primary">Return to Workspace</LinkButton>
      </div>
    );
  }

  if (document?.fileAvailable === false) {
    return (
      <div className={`container ${styles.notFoundContainer}`}>
        <h2>PDF Unavailable</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          The stored PDF is missing. Remove this record from Documents and upload a new copy.
        </p>
        <LinkButton href="/dashboard" variant="primary">Return to Documents</LinkButton>
      </div>
    );
  }

  return (
    <div className={styles.workspaceWrapper}>
      {/* Top Header & Breadcrumbs */}
      <div className={styles.topBar}>
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Documents', href: '/dashboard' },
            { label: document?.title || (isLoadingDoc ? 'Loading document...' : docId) },
            ...(analysis ? [{ label: 'Legal X-Ray' }] : []),
          ]}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {analysis && (
            <Badge variant="fact" showDot>
              Legal X-Ray Ready
            </Badge>
          )}

          {document?.status && (
            <Badge
              variant={
                document.status === 'READY'
                  ? 'fact'
                  : document.status === 'FAILED'
                  ? 'risk'
                  : 'review'
              }
              showDot
            >
              {document.status === 'READY'
                ? 'Document Ready'
                : document.status === 'PROCESSING' || isProcessing
                ? 'Processing...'
                : document.status === 'FAILED'
                ? 'Processing Failed'
                : 'Uploaded'}
            </Badge>
          )}

          {analysis && (
            <LinkButton href={`/prepare?docId=${docId}`} size="sm" variant="primary">Prepare for Lawyer</LinkButton>
          )}

          <LinkButton href={`/legal-info?docId=${docId}`} size="sm" variant="outline">Legal Navigator</LinkButton>

          <LinkButton href="/dashboard" size="sm" variant="ghost">Back to Dashboard</LinkButton>
        </div>
      </div>

      {/* Post-Analysis Next Steps Banner */}
      {analysis && document && (
        <div className={styles.nextStepsBanner} role="region" aria-label="Recommended next steps">
          <span className={styles.nextStepsLabel}>Next steps with this document:</span>
          <div className={styles.nextStepsActions}>
            <LinkButton href={`/compare?docId=${docId}`} size="sm" variant="outline">⇄ Compare with Another Version</LinkButton>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAddToMatterOpen(true)}
            >
              + Add to a Matter
            </Button>
            <LinkButton href="/matters" size="sm" variant="ghost">View All Matters →</LinkButton>
          </div>
        </div>
      )}

      {/* Two-Pane Workspace Layout */}
      <div className={styles.twoPaneContainer}>
        {/* LEFT PANE: Legal X-Ray Intelligence & Processing Lifecycle */}
        <aside className={styles.leftPane} aria-label="Document Metadata and Legal X-Ray Analysis">
          {/* Case 1: Analysis Available -> Render Interactive Legal X-Ray */}
          {analysis ? (
            <>
              <DocumentQuestionPanel documentId={docId} onCitationClick={(page) => setActivePage(page)} />
              <LegalXRay
                analysis={analysis}
                documentId={docId}
                onCitationClick={(page) => setActivePage(page)}
                onReanalyze={() => handleRunAnalysis(true)}
                isReanalyzing={isAnalyzing}
              />
            </>
          ) : (
            <>
              {/* Document Details Card */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>Document Details</h2>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    {document?.id}
                  </span>
                </div>

                <div className={styles.metaList}>
                  <div className={styles.metaItem}>
                    <span>Filename</span>
                    <strong title={document?.originalFilename}>
                      {document?.originalFilename || '–'}
                    </strong>
                  </div>
                  <div className={styles.metaItem}>
                    <span>Page Count</span>
                    <strong>
                      {document?.pageCount != null ? `${document.pageCount} pages` : 'Pending processing'}
                    </strong>
                  </div>
                  <div className={styles.metaItem}>
                    <span>File Size</span>
                    <strong>
                      {document?.fileSize
                        ? `${(document.fileSize / (1024 * 1024)).toFixed(2)} MB`
                        : '–'}
                    </strong>
                  </div>
                  <div className={styles.metaItem}>
                    <span>MIME Type</span>
                    <strong>{document?.mimeType || 'application/pdf'}</strong>
                  </div>
                </div>
              </div>

              {/* Document Preparation Status Box */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>Document Preparation</h2>
                  {document?.status === 'READY' ? (
                    <Badge variant="fact">Completed</Badge>
                  ) : (
                    <Badge variant="review">Active</Badge>
                  )}
                </div>

                <div className={styles.statusBox}>
                  <div className={styles.statusHeader}>
                    <strong>Current State:</strong>
                    <span>
                      {isProcessing
                        ? 'Processing pages...'
                        : document?.status === 'READY'
                        ? 'Document ready.'
                        : document?.status === 'FAILED'
                        ? 'Preparation failed.'
                        : 'Document uploaded.'}
                    </span>
                  </div>

                  <p className={styles.statusMessage}>
                    {isProcessing ? (
                      'Extracting page boundaries, indexing text, and preparing for grounded citations...'
                    ) : document?.status === 'READY' ? (
                      `Successfully extracted ${document.pageCount || 0} pages. Document text and page structure are indexed and ready for downstream analysis.`
                    ) : document?.status === 'FAILED' ? (
                      document.processingError || 'Something went wrong while preparing this document.'
                    ) : (
                      'Preparing your document...'
                    )}
                  </p>

                  {(document?.status === 'FAILED' || errorMessage) && (
                    <div style={{ marginTop: 'var(--space-2)' }}>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleRetryProcessing}
                        disabled={isProcessing}
                        isLoading={isProcessing}
                      >
                        Try Again
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Phase 4 Legal X-Ray Activation Card */}
              {document?.status === 'READY' && (
                <div className={styles.phase4Notice}>
                  <span className={styles.phase4Title}>Legal X-Ray Analysis</span>
                  <p className={styles.phase4Text}>
                    Generate a structured legal breakdown with plain-English obligations, contracting
                    parties, key deadlines, material clauses, and review attention areas—with every
                    factual assertion anchored to verified page citations.
                  </p>

                  {analysisError && (
                    <div
                      role="alert"
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#f87171',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-xs)',
                      }}
                    >
                      {analysisError}
                    </div>
                  )}

                  <div style={{ marginTop: 'var(--space-2)' }}>
                    <Button
                      variant="primary"
                      onClick={() => handleRunAnalysis(false)}
                      disabled={isAnalyzing}
                      isLoading={isAnalyzing}
                      style={{ width: '100%' }}
                    >
                      {isAnalyzing ? 'Analyzing Document with Gemini...' : 'Run Legal X-Ray'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Safe raw file download link */}
          <div style={{ marginTop: 'auto' }}>
            <LinkButton
              href={`/api/documents/${docId}/file`}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              variant="outline"
              style={{ width: '100%' }}
            >
              Download Raw PDF
            </LinkButton>
          </div>
        </aside>

        {/* RIGHT PANE: Interactive PDF Viewer */}
        <section className={styles.rightPane} aria-label="Interactive Document Viewer">
          <DocumentViewer
            fileUrl={`/api/documents/${docId}/file`}
            initialPage={1}
            activePage={activePage}
            onPageChange={(p) => setActivePage(p)}
          />
        </section>
      </div>

      {/* Safety Notice Footer */}
      <div className={styles.disclaimerBanner} role="note">
        <strong>Legal Safety Notice:</strong> {LEGAL_DISCLAIMERS.GLOBAL_FOOTER}
      </div>

      {/* Add to Matter Modal */}
      {document && (
        <AddToMatterModal
          isOpen={isAddToMatterOpen}
          onClose={() => setIsAddToMatterOpen(false)}
          documentId={document.id}
          documentTitle={document.title}
        />
      )}
    </div>
  );
}
