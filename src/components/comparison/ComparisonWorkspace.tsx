'use client';

import { apiFetch } from '@/lib/api/client';

import { LinkButton } from '@/components/ui/Button/LinkButton';

import React, { useState, useEffect, useMemo } from 'react';
import { DocumentDto } from '@/lib/document/types';
import {
  ComparisonResult,
  ComparisonDifferenceItem,
  ComparisonChangeType,
  AttentionCategory,
} from '@/lib/ai/schemas';
import { DocumentViewer } from '@/lib/../components/document/DocumentViewer';
import { Spinner } from '@/components/ui/Spinner/Spinner';
import { LegalInfoModal } from '@/components/legal-info/LegalInfoModal';
import styles from './ComparisonWorkspace.module.css';

interface ComparisonWorkspaceProps {
  initialBaseDocId?: string;
  initialTargetDocId?: string;
}

export const ComparisonWorkspace: React.FC<ComparisonWorkspaceProps> = ({
  initialBaseDocId,
  initialTargetDocId,
}) => {
  // Document state
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [baseDocId, setBaseDocId] = useState<string>(initialBaseDocId || '');
  const [targetDocId, setTargetDocId] = useState<string>(initialTargetDocId || '');
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(true);
  const [legalInfoTopic, setLegalInfoTopic] = useState<string | null>(null);

  // Comparison state
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter state
  const [selectedType, setSelectedType] = useState<'ALL' | ComparisonChangeType | 'ATTENTION'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Independent Viewer navigation state
  const [baseActivePage, setBaseActivePage] = useState<number | undefined>(undefined);
  const [targetActivePage, setTargetActivePage] = useState<number | undefined>(undefined);
  const [activeViewerTab, setActiveViewerTab] = useState<'DUAL' | 'BASE' | 'TARGET'>('DUAL');

  // Fetch available ready documents on mount
  useEffect(() => {
    let ignore = false;
    async function loadInitialDocuments() {
      try {
        const res = await apiFetch('/api/documents');
        if (ignore) return;
        if (res.ok) {
          const data = await res.json();
          if (ignore) return;
          const readyDocs: DocumentDto[] = (data.documents || []).filter(
            (d: DocumentDto) => d.status === 'READY' && d.fileAvailable !== false
          );
          setDocuments(readyDocs);
          setBaseDocId((prev) => prev || (readyDocs[0] ? readyDocs[0].id : ''));
          setTargetDocId((prev) => prev || (readyDocs[1] ? readyDocs[1].id : ''));
        }
      } catch {
        // Ignore network failure on initial load
      } finally {
        if (!ignore) {
          setIsLoadingDocs(false);
        }
      }
    }

    loadInitialDocuments();
    return () => {
      ignore = true;
    };
  }, []);

  // Execute or retrieve comparison
  const runComparison = async (force: boolean = false) => {
    if (!baseDocId || !targetDocId) return;
    if (baseDocId === targetDocId) {
      setErrorMessage('Cannot compare a document to itself. Please choose two distinct documents.');
      return;
    }

    try {
      setIsComparing(true);
      setErrorMessage(null);

      const res = await apiFetch('/api/comparisons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseDocumentId: baseDocId,
          targetDocumentId: targetDocId,
          force,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Comparison failed.');
      }

      setComparison(data.comparison);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during comparison.';
      setErrorMessage(msg);
    } finally {
      setIsComparing(false);
    }
  };

  // Auto-run if initial IDs are provided from URL
  useEffect(() => {
    if (!initialBaseDocId || !initialTargetDocId || initialBaseDocId === initialTargetDocId) {
      return;
    }

    let ignore = false;
    async function autoLoadComparison() {
      try {
        const res = await apiFetch('/api/comparisons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            baseDocumentId: initialBaseDocId,
            targetDocumentId: initialTargetDocId,
            force: false,
          }),
        });
        if (ignore) return;
        const data = await res.json();
        if (ignore) return;
        if (res.ok && data.comparison) {
          setComparison(data.comparison);
        }
      } catch {
        // Ignore auto-load failure; user can click button
      }
    }

    autoLoadComparison();
    return () => {
      ignore = true;
    };
  }, [initialBaseDocId, initialTargetDocId]);

  const handleSwapDocuments = () => {
    const prevBase = baseDocId;
    const prevTarget = targetDocId;
    setBaseDocId(prevTarget);
    setTargetDocId(prevBase);
    setComparison(null);
  };

  // Filtered differences
  const filteredDifferences = useMemo(() => {
    if (!comparison) return [];
    return comparison.differences.filter((diff: ComparisonDifferenceItem) => {
      // Filter by type
      if (selectedType === 'ATTENTION') {
        if (diff.attentionLevel !== 'HIGH' && diff.attentionLevel !== 'MEDIUM') return false;
      } else if (selectedType !== 'ALL' && diff.type !== selectedType) {
        return false;
      }

      // Filter by category
      if (selectedCategory !== 'ALL' && diff.category !== selectedCategory) {
        return false;
      }

      return true;
    });
  }, [comparison, selectedType, selectedCategory]);

  // Unique categories in current comparison
  const availableCategories = useMemo(() => {
    if (!comparison) return [];
    const set = new Set<AttentionCategory>();
    for (const d of comparison.differences) {
      set.add(d.category);
    }
    return Array.from(set);
  }, [comparison]);

  // Citation click handlers for dual viewer
  const handleBaseCitationClick = (page: number) => {
    setBaseActivePage(page);
    if (activeViewerTab === 'TARGET') {
      setActiveViewerTab('DUAL');
    }
  };

  const handleTargetCitationClick = (page: number) => {
    setTargetActivePage(page);
    if (activeViewerTab === 'BASE') {
      setActiveViewerTab('DUAL');
    }
  };

  return (
    <div className={styles.workspaceContainer}>
      {/* Top Document Selector Bar */}
      <section className={styles.selectionBar} aria-label="Document Version Selection">
        <div className={styles.selectionTitle}>
          <span>Compare versions</span>
        </div>

        <div className={styles.selectorsGrid}>
          {/* Base Document Selector */}
          <div className={styles.selectGroup}>
            <label htmlFor="base-doc-select" className={styles.selectLabel}>
              Original Version (Base Document)
            </label>
            <select
              id="base-doc-select"
              className={styles.selectInput}
              value={baseDocId}
              onChange={(e) => {
                setBaseDocId(e.target.value);
                setComparison(null);
              }}
              disabled={isLoadingDocs || isComparing}
            >
              <option value="">-- Select Original Document --</option>
              {documents.map((doc) => (
                <option key={`base_${doc.id}`} value={doc.id} disabled={doc.id === targetDocId}>
                  {doc.title} ({doc.pageCount ?? '?'} pgs)
                </option>
              ))}
            </select>
          </div>

          {/* Swap Button */}
          <button
            type="button"
            className={styles.swapBtn}
            onClick={handleSwapDocuments}
            title="Swap Base and Target documents"
            aria-label="Swap original and revised documents"
            disabled={!baseDocId || !targetDocId || isComparing}
          >
            ⇄
          </button>

          {/* Target Document Selector */}
          <div className={styles.selectGroup}>
            <label htmlFor="target-doc-select" className={styles.selectLabel}>
              Revised Version (Target Document)
            </label>
            <select
              id="target-doc-select"
              className={styles.selectInput}
              value={targetDocId}
              onChange={(e) => {
                setTargetDocId(e.target.value);
                setComparison(null);
              }}
              disabled={isLoadingDocs || isComparing}
            >
              <option value="">-- Select Revised Document --</option>
              {documents.map((doc) => (
                <option key={`target_${doc.id}`} value={doc.id} disabled={doc.id === baseDocId}>
                  {doc.title} ({doc.pageCount ?? '?'} pgs)
                </option>
              ))}
            </select>
          </div>

          {/* Compare Trigger Button */}
          <div className={styles.actionBtnWrapper}>
            <button
              type="button"
              className={styles.compareBtn}
              onClick={() => runComparison(false)}
              disabled={!baseDocId || !targetDocId || baseDocId === targetDocId || isComparing}
            >
              {isComparing ? (
                <>
                  <Spinner size="sm" />
                  <span>Comparing...</span>
                </>
              ) : (
                <>
                  <span aria-hidden="true">→</span>
                  <span>Compare Versions</span>
                </>
              )}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div
            style={{
              marginTop: '0.85rem',
              color: '#f87171',
              fontSize: '0.85rem',
              background: 'rgba(239, 68, 68, 0.12)',
              padding: '0.5rem 0.8rem',
              borderRadius: '6px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}
      </section>

      {/* Main Workspace Body */}
      {comparison ? (
        <section className={styles.workspaceBody} aria-label="Comparison results">
          {/* Left Pane: Differences Dossier */}
          <section className={styles.dossierPane} aria-label="Comparison Differences Dossier">
            {/* Executive Summary Card */}
            <div className={styles.summaryCard}>
              <div className={styles.summaryHeader}>
                <span className={styles.summaryTitle}>Version Summary</span>
                <button
                  type="button"
                  onClick={() => runComparison(true)}
                  disabled={isComparing}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-gold, #c8a256)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  {isComparing ? 'Re-analyzing...' : '↻ Re-run Comparison'}
                </button>
              </div>

              <p className={styles.summaryText}>{comparison.summary.plainLanguage}</p>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <span className={styles.governingLawTag}>
                  Base Law: {comparison.summary.baseGoverningLaw || 'Unidentified'}
                </span>
                <span className={styles.governingLawTag}>
                  Target Law: {comparison.summary.targetGoverningLaw || 'Unidentified'}
                </span>
              </div>

              {/* Statistics Bar */}
              <div className={styles.statsBar}>
                <span className={`${styles.statPill} ${styles.statPillModified}`}>
                  ~ {comparison.statistics.modifiedCount} Modified
                </span>
                <span className={`${styles.statPill} ${styles.statPillAdded}`}>
                  + {comparison.statistics.addedCount} Added
                </span>
                <span className={`${styles.statPill} ${styles.statPillRemoved}`}>
                  - {comparison.statistics.removedCount} Removed
                </span>
                <span className={`${styles.statPill} ${styles.statPillUnchanged}`}>
                  = {comparison.statistics.unchangedCount} Unchanged
                </span>
              </div>

              {/* Evidence Verification Health Bar */}
              {comparison.validationSummary.totalCitations > 0 && (
                <div className={styles.healthBarContainer}>
                  <div className={styles.healthBarHeader}>
                    <span>Evidence Verification Health</span>
                    <span>
                      {Math.round(
                        (comparison.validationSummary.validatedCount /
                          comparison.validationSummary.totalCitations) *
                          100
                      )}
                      % Verified ({comparison.validationSummary.validatedCount}/
                      {comparison.validationSummary.totalCitations})
                    </span>
                  </div>
                  <div className={styles.healthBarTrack}>
                    <div
                      className={styles.healthBarFill}
                      style={{
                        width: `${Math.round(
                          (comparison.validationSummary.validatedCount /
                            comparison.validationSummary.totalCitations) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Filter Toolbar */}
            <div className={styles.filterToolbar}>
              <div className={styles.filterPillsRow}>
                <button
                  type="button"
                  className={`${styles.filterPill} ${selectedType === 'ALL' ? styles.filterPillActive : ''}`}
                  onClick={() => setSelectedType('ALL')}
                >
                  All ({comparison.differences.length})
                </button>
                <button
                  type="button"
                  className={`${styles.filterPill} ${selectedType === 'MODIFIED' ? styles.filterPillActive : ''}`}
                  onClick={() => setSelectedType('MODIFIED')}
                >
                  Modified ({comparison.statistics.modifiedCount})
                </button>
                <button
                  type="button"
                  className={`${styles.filterPill} ${selectedType === 'ADDED' ? styles.filterPillActive : ''}`}
                  onClick={() => setSelectedType('ADDED')}
                >
                  Added ({comparison.statistics.addedCount})
                </button>
                <button
                  type="button"
                  className={`${styles.filterPill} ${selectedType === 'REMOVED' ? styles.filterPillActive : ''}`}
                  onClick={() => setSelectedType('REMOVED')}
                >
                  Removed ({comparison.statistics.removedCount})
                </button>
                <button
                  type="button"
                  className={`${styles.filterPill} ${selectedType === 'UNCHANGED' ? styles.filterPillActive : ''}`}
                  onClick={() => setSelectedType('UNCHANGED')}
                >
                  Unchanged ({comparison.statistics.unchangedCount})
                </button>
                <button
                  type="button"
                  className={`${styles.filterPill} ${selectedType === 'ATTENTION' ? styles.filterPillActive : ''}`}
                  onClick={() => setSelectedType('ATTENTION')}
                >
                  Attention Only
                </button>
              </div>

              {availableCategories.length > 0 && (
                <div className={styles.filterSelectRow}>
                  <label htmlFor="category-select" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Category:
                  </label>
                  <select
                    id="category-select"
                    className={styles.categorySelect}
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="ALL">All Categories ({availableCategories.length})</option>
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Difference Cards List */}
            {filteredDifferences.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No clauses match the selected filter criteria.
              </div>
            ) : (
              filteredDifferences.map((diff) => {
                const typeStyle =
                  diff.type === 'ADDED'
                    ? styles.typeAdded
                    : diff.type === 'REMOVED'
                    ? styles.typeRemoved
                    : diff.type === 'MODIFIED'
                    ? styles.typeModified
                    : styles.typeUnchanged;

                const attStyle =
                  diff.attentionLevel === 'HIGH'
                    ? styles.attHigh
                    : diff.attentionLevel === 'MEDIUM'
                    ? styles.attMedium
                    : diff.attentionLevel === 'LOW'
                    ? styles.attLow
                    : styles.attInfo;

                return (
                  <article key={diff.id} className={styles.differenceCard}>
                    <div className={styles.cardTopHeader}>
                      <div className={styles.cardBadges}>
                        <span className={`${styles.typeBadge} ${typeStyle}`}>{diff.type}</span>
                        <span className={`${styles.attentionBadge} ${attStyle}`}>
                          {diff.attentionLevel} ATTENTION
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          [{diff.category}]
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
                        {diff.sectionReference && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-gold, #c8a256)', fontWeight: 600 }}>
                            {diff.sectionReference}
                          </span>
                        )}
                        <button
                          type="button"
                          style={{
                            background: 'rgba(212, 175, 55, 0.1)',
                            color: '#facc15',
                            border: '1px solid rgba(212, 175, 55, 0.35)',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          onClick={() => setLegalInfoTopic(diff.category || diff.title)}
                          title="Learn about this legal concept in the Legal Navigator"
                        >
                          📖 Concept
                        </button>
                      </div>
                    </div>

                    <h3 className={styles.cardTitle}>{diff.title}</h3>

                    {/* Dual Evidence Box */}
                    {(diff.baseEvidence || diff.targetEvidence) && (
                      <div className={styles.evidenceGrid}>
                        {/* Base Document Evidence */}
                        {diff.baseEvidence ? (
                          <div className={styles.evidenceBox}>
                            <div className={styles.evidenceHeader}>
                              <span className={styles.evidenceLabel}>Original (Base)</span>
                              <button
                                type="button"
                                className={styles.citationSeal}
                                onClick={() => handleBaseCitationClick(diff.baseEvidence!.pageNumber)}
                                title="Navigate Base Document to this page"
                              >
                                <span>📄 Page {diff.baseEvidence.pageNumber}</span>
                                {diff.baseEvidence.sectionReference && (
                                  <span>· {diff.baseEvidence.sectionReference}</span>
                                )}
                              </button>
                            </div>
                            <div className={styles.evidenceQuote}>
                              &ldquo;{diff.baseEvidence.quotedText}&rdquo;
                            </div>
                            {!diff.baseEvidence.isValidated && (
                              <div className={styles.unverifiedNotice}>
                                ⚠️ Evidence requires review (quote could not be confirmed on page)
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className={styles.evidenceBox} style={{ opacity: 0.5 }}>
                            <span className={styles.evidenceLabel}>Original (Base)</span>
                            <div className={styles.evidenceQuote}>Not present in original version.</div>
                          </div>
                        )}

                        {/* Target Document Evidence */}
                        {diff.targetEvidence ? (
                          <div className={styles.evidenceBox}>
                            <div className={styles.evidenceHeader}>
                              <span className={styles.evidenceLabel}>Revised (Target)</span>
                              <button
                                type="button"
                                className={styles.citationSeal}
                                onClick={() => handleTargetCitationClick(diff.targetEvidence!.pageNumber)}
                                title="Navigate Revised Document to this page"
                              >
                                <span>📄 Page {diff.targetEvidence.pageNumber}</span>
                                {diff.targetEvidence.sectionReference && (
                                  <span>· {diff.targetEvidence.sectionReference}</span>
                                )}
                              </button>
                            </div>
                            <div className={styles.evidenceQuote}>
                              &ldquo;{diff.targetEvidence.quotedText}&rdquo;
                            </div>
                            {!diff.targetEvidence.isValidated && (
                              <div className={styles.unverifiedNotice}>
                                ⚠️ Evidence requires review (quote could not be confirmed on page)
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className={styles.evidenceBox} style={{ opacity: 0.5 }}>
                            <span className={styles.evidenceLabel}>Revised (Target)</span>
                            <div className={styles.evidenceQuote}>Omitted in revised version.</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* What Changed */}
                    <div className={styles.changeSummaryBlock}>
                      <div className={styles.changeSummaryLabel}>What Changed</div>
                      <p className={styles.changeSummaryText}>{diff.changeSummary}</p>

                      {/* Semantic Field Changes */}
                      {diff.semanticChanges.length > 0 && (
                        <div className={styles.semanticDeltasTable}>
                          {diff.semanticChanges.map((sc, scIdx) => (
                            <div key={`sc_${diff.id}_${scIdx}`} className={styles.semanticRow}>
                              <span className={styles.semanticField}>{sc.field.replace(/_/g, ' ')}:</span>
                              <span className={styles.semanticBefore}>{sc.before}</span>
                              <span className={styles.semanticArrow}>→</span>
                              <span className={styles.semanticAfter}>{sc.after}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Practical Implications */}
                    {diff.practicalImplications && (
                      <div className={styles.implicationsBlock}>
                        <div className={styles.implicationsLabel}>Practical Implication</div>
                        <p>{diff.practicalImplications}</p>
                      </div>
                    )}

                    {/* Lawyer Question */}
                    {diff.lawyerQuestion && (
                      <div className={styles.lawyerQuestionBlock}>
                        <div className={styles.lawyerQuestionLabel}>
                          <span>💬</span>
                          <span>Question to Discuss With Counsel</span>
                        </div>
                        <p className={styles.lawyerQuestionText}>&ldquo;{diff.lawyerQuestion}&rdquo;</p>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </section>

          {/* Right Pane: Dual Document Viewer */}
          <section className={styles.viewerPane} aria-label="Synchronized PDF Viewers">
            <div className={styles.viewerTabs}>
              <button
                type="button"
                className={`${styles.viewerTab} ${activeViewerTab === 'DUAL' ? styles.viewerTabActive : ''}`}
                onClick={() => setActiveViewerTab('DUAL')}
              >
                Side-by-Side Dual View
              </button>
              <button
                type="button"
                className={`${styles.viewerTab} ${activeViewerTab === 'BASE' ? styles.viewerTabActive : ''}`}
                onClick={() => setActiveViewerTab('BASE')}
              >
                Original Document Only
              </button>
              <button
                type="button"
                className={`${styles.viewerTab} ${activeViewerTab === 'TARGET' ? styles.viewerTabActive : ''}`}
                onClick={() => setActiveViewerTab('TARGET')}
              >
                Revised Document Only
              </button>
            </div>

            <div className={styles.viewersGrid}>
              {/* Base Document Viewer */}
              {(activeViewerTab === 'DUAL' || activeViewerTab === 'BASE') && (
                <div className={styles.viewerColumn}>
                  <div className={styles.viewerHeader}>
                    <span className={styles.viewerHeaderTitle} title={comparison.summary.baseDocumentTitle}>
                      Original: {comparison.summary.baseDocumentTitle}
                    </span>
                    <span
                      className={styles.viewerHeaderBadge}
                      style={{ background: 'rgba(200, 162, 86, 0.15)', color: 'var(--color-gold, #c8a256)' }}
                    >
                      BASE
                    </span>
                  </div>
                  <DocumentViewer
                    fileUrl={`/api/documents/${baseDocId}/file`}
                    activePage={baseActivePage}
                  />
                </div>
              )}

              {/* Target Document Viewer */}
              {(activeViewerTab === 'DUAL' || activeViewerTab === 'TARGET') && (
                <div className={styles.viewerColumn}>
                  <div className={styles.viewerHeader}>
                    <span className={styles.viewerHeaderTitle} title={comparison.summary.targetDocumentTitle}>
                      Revised: {comparison.summary.targetDocumentTitle}
                    </span>
                    <span
                      className={styles.viewerHeaderBadge}
                      style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }}
                    >
                      REVISED
                    </span>
                  </div>
                  <DocumentViewer
                    fileUrl={`/api/documents/${targetDocId}/file`}
                    activePage={targetActivePage}
                  />
                </div>
              )}
            </div>
          </section>
        </section>
      ) : (
        /* Empty State when no comparison loaded */
        <div className={styles.emptyStateContainer}>
          <div className={styles.emptyStateIcon} aria-hidden="true">01 / 02</div>
          {documents.length < 2 ? (
            <>
              <h2 className={styles.emptyStateTitle}>No comparisons yet</h2>
              <p className={styles.emptyStateText}>
                Upload at least two versions of a contract or agreement to begin side-by-side comparison, substantive diff detection, and obligation shifts.
              </p>
              <div style={{ marginTop: '1.25rem' }}>
                <LinkButton href="/dashboard" variant="primary">Upload Documents to Compare &rarr;</LinkButton>
              </div>
            </>
          ) : (
            <>
              <h2 className={styles.emptyStateTitle}>What changed between these documents?</h2>
              <p className={styles.emptyStateText}>
                Choose an original contract and its revised version above, then click &ldquo;Compare Versions&rdquo;
                to extract clause modifications, detect notice period and numerical shifts, and inspect verified evidence.
              </p>
            </>
          )}
        </div>
      )}

      <LegalInfoModal
        isOpen={!!legalInfoTopic}
        onClose={() => setLegalInfoTopic(null)}
        topic={legalInfoTopic || undefined}
        comparisonId={comparison?.id}
        documentId={baseDocId}
      />
    </div>
  );
};
