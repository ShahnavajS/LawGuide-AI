'use client';

import { apiFetch } from '@/lib/api/client';
import styles from '../MatterWorkspace.module.css';
import { Button } from '@/components/ui/Button/Button';
import { MatterSourceMapResponse } from '@/lib/ai/schemas';
import type { MatterWorkspaceModel } from '../useMatterWorkspace';

export function SourceMapPanel({ workspace }: { workspace: MatterWorkspaceModel }) {
  const {
    matterId, matter, setActiveTab,
    sourceMapData, setSourceMapData, evidenceLedger, setEvidenceLedger,
    sourceMapViewMode, setSourceMapViewMode,
    selectedSourceDocId, setSelectedSourceDocId,
    selectedSourcePage, setSelectedSourcePage,
    evidenceFilterClassification, setEvidenceFilterClassification,
    evidenceFilterVerification, setEvidenceFilterVerification,
    evidenceFilterDocId, setEvidenceFilterDocId,
    evidenceSearchQuery, setEvidenceSearchQuery,
    isLoadingSourceMap, setIsLoadingSourceMap, openViewer,
  } = workspace;
  if (!matter) return null;

  return (
        <div className={styles.tabPane}>
          <div className={styles.sourceMapContainer}>
            {/* Header with View Mode Toggle */}
            <div className={styles.sourceMapHeader}>
              <div className={styles.sourceMapTitleArea}>
                <h2>Evidence Intelligence & Source Map</h2>
                <p>
                  Trace every fact, finding, question, and action item to its exact supporting document, page, and verbatim quote.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div className={styles.sourceMapViewToggle}>
                  <button
                    type="button"
                    className={`${styles.sourceMapToggleBtn} ${
                      sourceMapViewMode === 'hierarchy' ? styles.sourceMapToggleBtnActive : ''
                    }`}
                    onClick={() => setSourceMapViewMode('hierarchy')}
                  >
                    <span>🌳</span>
                    <span>Visual Hierarchy</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.sourceMapToggleBtn} ${
                      sourceMapViewMode === 'ledger' ? styles.sourceMapToggleBtnActive : ''
                    }`}
                    onClick={() => setSourceMapViewMode('ledger')}
                  >
                    <span>📜</span>
                    <span>Evidence Ledger</span>
                  </button>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isLoadingSourceMap}
                  onClick={async () => {
                    setIsLoadingSourceMap(true);
                    try {
                      const res = await apiFetch(`/api/matters/${matterId}/source-map`);
                      if (res.ok) {
                        const sm = (await res.json()) as MatterSourceMapResponse;
                        setSourceMapData(sm);
                        setEvidenceLedger(sm.evidenceItems);
                      }
                    } finally {
                      setIsLoadingSourceMap(false);
                    }
                  }}
                >
                  {isLoadingSourceMap ? 'Syncing...' : '🔄 Re-Sync Evidence'}
                </Button>
              </div>
            </div>

            {/* Evidence Coverage Metrics Bar */}
            {sourceMapData?.coverage && (
              <div className={styles.coverageGrid}>
                <div className={styles.coverageCard}>
                  <span className={styles.coverageLabel}>Total Verified Evidence</span>
                  <span className={styles.coverageValue}>
                    {sourceMapData.coverage.verifiedEvidenceCount} / {sourceMapData.coverage.totalEvidenceItems}
                  </span>
                  <span className={styles.coverageSub}>Ground truth excerpts in matter</span>
                </div>

                <div className={styles.coverageCard}>
                  <span className={styles.coverageLabel}>Documents with Evidence</span>
                  <span className={styles.coverageValue}>
                    {sourceMapData.coverage.documentsWithVerifiedEvidence} / {sourceMapData.coverage.totalDocuments}
                  </span>
                  <span className={styles.coverageSub}>Verified document pages</span>
                </div>

                <div className={styles.coverageCard}>
                  <span className={styles.coverageLabel}>Findings with Citations</span>
                  <span className={styles.coverageValue}>
                    {sourceMapData.coverage.findingsWithCitations.withCitations} /{' '}
                    {sourceMapData.coverage.findingsWithCitations.total}
                  </span>
                  <span className={styles.coverageSub}>Consistency & relationship evidence</span>
                </div>

                <div className={styles.coverageCard}>
                  <span className={styles.coverageLabel}>Questions with Evidence</span>
                  <span className={styles.coverageValue}>
                    {sourceMapData.coverage.counselQuestionsWithEvidence.withEvidence} /{' '}
                    {sourceMapData.coverage.counselQuestionsWithEvidence.total}
                  </span>
                  <span className={styles.coverageSub}>Counsel questions anchored to text</span>
                </div>

                <div className={styles.coverageCard}>
                  <span className={styles.coverageLabel}>Items Needing Review</span>
                  <span className={styles.coverageValue} style={{ color: '#fbbf24' }}>
                    {sourceMapData.coverage.needsReviewEvidenceCount}
                  </span>
                  <span className={styles.coverageSub}>Unverified or partial citations</span>
                </div>
              </div>
            )}

            {/* VIEW MODE 1: VISUAL SOURCE HIERARCHY */}
            {sourceMapViewMode === 'hierarchy' && (
              <div className={styles.sourceHierarchyLayout}>
                {/* Left Pane: Member Document & Page Tree */}
                <div className={styles.sourceDocTree}>
                  <div
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Member Documents & Pages
                  </div>

                  {!sourceMapData || sourceMapData.documents.length === 0 ? (
                    <div role={isLoadingSourceMap ? 'status' : undefined} style={{ color: '#64748b', fontSize: '0.85rem' }}>
                      {isLoadingSourceMap ? 'Loading document map…' : 'No documents in this matter yet.'}
                    </div>
                  ) : (
                    sourceMapData.documents.map((docNode) => {
                      const isDocSelected = selectedSourceDocId === docNode.documentId;
                      return (
                        <article
                          key={docNode.documentId}
                          className={`${styles.sourceDocCard} ${
                            isDocSelected ? styles.sourceDocCardActive : ''
                          }`}
                        >
                          <button
                            type="button"
                            className={styles.sourceDocSelectButton}
                            aria-pressed={isDocSelected}
                            onClick={() => {
                              setSelectedSourceDocId(docNode.documentId);
                              setSelectedSourcePage(docNode.pagesWithEvidence[0]?.pageNumber || 1);
                            }}
                          >
                            <span className={styles.sourceDocCardHeader}>
                              <span className={styles.sourceDocTitle}>{docNode.title}</span>
                              <span className={styles.roleBadge}>{docNode.role.replace(/_/g, ' ')}</span>
                            </span>
                            <span className={styles.sourceDocSummary}>
                              {docNode.totalEvidenceCount} evidence item
                              {docNode.totalEvidenceCount === 1 ? '' : 's'} ·{' '}
                              {docNode.verifiedEvidenceCount} verified
                            </span>
                          </button>

                          {/* Page Pills Grid */}
                          {docNode.pagesWithEvidence.length > 0 ? (
                            <div className={styles.pagesGrid}>
                              {docNode.pagesWithEvidence.map((pageNode) => {
                                const isPageActive =
                                  isDocSelected && selectedSourcePage === pageNode.pageNumber;
                                return (
                                  <button
                                    key={pageNode.pageNumber}
                                    type="button"
                                    className={`${styles.pagePill} ${
                                      isPageActive ? styles.pagePillActive : ''
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedSourceDocId(docNode.documentId);
                                      setSelectedSourcePage(pageNode.pageNumber);
                                    }}
                                  >
                                    p. {pageNode.pageNumber} ({pageNode.evidenceItems.length})
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                              No extracted evidence for this document.
                            </div>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>

                {/* Right Pane: Page Evidence Detail */}
                <div className={styles.pageEvidencePane}>
                  {(() => {
                    const activeDoc = sourceMapData?.documents.find(
                      (d) => d.documentId === selectedSourceDocId
                    );
                    const activePageNode = activeDoc?.pagesWithEvidence.find(
                      (p) => p.pageNumber === selectedSourcePage
                    );

                    if (!activeDoc) {
                      return (
                        <div className={styles.emptyState}>
                          <p>Select a document and page from the tree to inspect evidence provenance.</p>
                        </div>
                      );
                    }

                    return (
                      <>
                        <div className={styles.pageEvidencePaneHeader}>
                          <div>
                            <h3 style={{ fontSize: '1.15rem', color: '#ffffff', margin: '0 0 0.25rem 0' }}>
                              📄 {activeDoc.title} — Page {selectedSourcePage || 1}
                            </h3>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              Role: {activeDoc.role.replace(/_/g, ' ')} ·{' '}
                              {activePageNode
                                ? `${activePageNode.evidenceItems.length} Evidence Excerpts`
                                : 'No evidence on this page'}
                            </span>
                          </div>

                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              openViewer(activeDoc.documentId, activeDoc.title, selectedSourcePage || 1)
                            }
                          >
                            🔍 Open in PDF Viewer (p.{selectedSourcePage || 1}) →
                          </Button>
                        </div>

                        {!activePageNode || activePageNode.evidenceItems.length === 0 ? (
                          <div className={styles.emptyState} style={{ padding: '3rem 1rem' }}>
                            <p>No verified evidence excerpts on Page {selectedSourcePage || 1}.</p>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() =>
                                openViewer(activeDoc.documentId, activeDoc.title, selectedSourcePage || 1)
                              }
                            >
                              Inspect Full Page in Viewer
                            </Button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {activePageNode.evidenceItems.map((evItem) => {
                              const isVerified = evItem.verificationStatus === 'VERIFIED';
                              const isReview = evItem.verificationStatus === 'NEEDS_REVIEW';

                              return (
                                <div
                                  key={evItem.id}
                                  style={{
                                    background: 'rgba(11, 15, 25, 0.5)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderRadius: '10px',
                                    padding: '1.1rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.65rem',
                                  }}
                                >
                                  {evItem.quotedText && (
                                    <blockquote className={styles.evidenceQuoteBlock}>
                                      &ldquo;{evItem.quotedText}&rdquo;
                                    </blockquote>
                                  )}

                                  <div className={styles.evidenceProvenanceRow}>
                                    <span className={styles.provenancePill}>
                                      {evItem.classification.replace(/_/g, ' ')}
                                    </span>

                                    <span
                                      className={
                                        isVerified
                                          ? styles.verificationBadgeVerified
                                          : isReview
                                          ? styles.verificationBadgeReview
                                          : styles.verificationBadgeUnverified
                                      }
                                    >
                                      {isVerified ? '✓ VERIFIED' : isReview ? '⚠️ NEEDS REVIEW' : '✕ UNVERIFIED'}
                                    </span>

                                    <span className={styles.datePill}>
                                      Confidence: {evItem.confidenceCategory}
                                    </span>

                                    {evItem.sourceReference && (
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {evItem.sourceReference}
                                      </span>
                                    )}
                                  </div>

                                  {/* Used By Lineage Chips */}
                                  {evItem.usedBy && evItem.usedBy.length > 0 && (
                                    <div className={styles.usedBySection}>
                                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                        Referenced In Matter Findings:
                                      </span>
                                      <div className={styles.usedByChips}>
                                        {evItem.usedBy.map((ub, idx) => (
                                          <button
                                            key={idx}
                                            type="button"
                                            className={styles.usedByChip}
                                            onClick={() => {
                                              if (ub.type === 'CONSISTENCY') setActiveTab('consistency');
                                              else if (ub.type === 'QUESTION') setActiveTab('questions');
                                              else if (ub.type === 'ACTION_ITEM') setActiveTab('actionPlan');
                                              else if (ub.type === 'RELATIONSHIP') setActiveTab('relationships');
                                              else if (ub.type === 'BRIEF') setActiveTab('prepare');
                                            }}
                                          >
                                            {ub.type === 'CONSISTENCY' && '⚖️ '}
                                            {ub.type === 'QUESTION' && '❓ '}
                                            {ub.type === 'ACTION_ITEM' && '✅ '}
                                            {ub.type === 'RELATIONSHIP' && '🔗 '}
                                            {ub.type === 'BRIEF' && '💼 '}
                                            {ub.title} →
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* VIEW MODE 2: SEARCHABLE EVIDENCE LEDGER */}
            {sourceMapViewMode === 'ledger' && (
              <div className={styles.ledgerContainer}>
                {/* Search & Filter Bar */}
                <div className={styles.ledgerFilterBar}>
                  <input
                    type="text"
                    placeholder="Search verified quotes, terms, or document titles..."
                    value={evidenceSearchQuery}
                    onChange={(e) => setEvidenceSearchQuery(e.target.value)}
                    className={styles.searchInput}
                    style={{ flex: 1, minWidth: '220px' }}
                  />

                  {/* Classification Filter */}
                  <select
                    value={evidenceFilterClassification}
                    onChange={(e) => setEvidenceFilterClassification(e.target.value)}
                    className={styles.searchInput}
                    style={{ minWidth: '150px' }}
                  >
                    <option value="ALL">All Classifications</option>
                    <option value="DOCUMENT_FACT">DOCUMENT_FACT</option>
                    <option value="AI_INTERPRETATION">AI_INTERPRETATION</option>
                    <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
                    <option value="USER_PROVIDED">USER_PROVIDED</option>
                  </select>

                  {/* Verification Status Filter */}
                  <select
                    value={evidenceFilterVerification}
                    onChange={(e) => setEvidenceFilterVerification(e.target.value)}
                    className={styles.searchInput}
                    style={{ minWidth: '140px' }}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="VERIFIED">VERIFIED</option>
                    <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
                    <option value="UNVERIFIED">UNVERIFIED</option>
                  </select>

                  {/* Document Filter */}
                  <select
                    value={evidenceFilterDocId}
                    onChange={(e) => setEvidenceFilterDocId(e.target.value)}
                    className={styles.searchInput}
                    style={{ minWidth: '160px' }}
                  >
                    <option value="ALL">All Documents</option>
                    {matter.documents.map((d) => (
                      <option key={d.documentId} value={d.documentId}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Ledger Cards & Filter Bar Info */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>
                    Showing <strong>{evidenceLedger.filter((ev) => {
                      if (evidenceFilterClassification !== 'ALL' && ev.classification !== evidenceFilterClassification) return false;
                      if (evidenceFilterVerification !== 'ALL' && ev.verificationStatus !== evidenceFilterVerification) return false;
                      if (evidenceFilterDocId !== 'ALL' && ev.documentId !== evidenceFilterDocId) return false;
                      if (evidenceSearchQuery.trim()) {
                        const q = evidenceSearchQuery.toLowerCase();
                        const matchesQuote = ev.quotedText && ev.quotedText.toLowerCase().includes(q);
                        const matchesDoc = ev.documentTitle && ev.documentTitle.toLowerCase().includes(q);
                        const matchesRef = ev.sourceReference && ev.sourceReference.toLowerCase().includes(q);
                        if (!matchesQuote && !matchesDoc && !matchesRef) return false;
                      }
                      return true;
                    }).length}</strong> evidence item(s)
                  </span>
                  {(evidenceFilterClassification !== 'ALL' || evidenceFilterVerification !== 'ALL' || evidenceFilterDocId !== 'ALL' || evidenceSearchQuery.trim()) && (
                    <button
                      type="button"
                      onClick={() => {
                        setEvidenceSearchQuery('');
                        setEvidenceFilterClassification('ALL');
                        setEvidenceFilterVerification('ALL');
                        setEvidenceFilterDocId('ALL');
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-gold, #c8a256)',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                {evidenceLedger.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>{isLoadingSourceMap ? 'Loading evidence…' : 'No evidence has been mapped yet.'}</p>
                  </div>
                ) : (
                  <div className={styles.ledgerCardList}>
                    {evidenceLedger
                      .filter((ev) => {
                        if (
                          evidenceFilterClassification !== 'ALL' &&
                          ev.classification !== evidenceFilterClassification
                        )
                          return false;
                        if (
                          evidenceFilterVerification !== 'ALL' &&
                          ev.verificationStatus !== evidenceFilterVerification
                        )
                          return false;
                        if (
                          evidenceFilterDocId !== 'ALL' &&
                          ev.documentId !== evidenceFilterDocId
                        )
                          return false;
                        if (evidenceSearchQuery.trim()) {
                          const q = evidenceSearchQuery.toLowerCase();
                          const matchesQuote =
                            ev.quotedText && ev.quotedText.toLowerCase().includes(q);
                          const matchesDoc =
                            ev.documentTitle && ev.documentTitle.toLowerCase().includes(q);
                          const matchesRef =
                            ev.sourceReference && ev.sourceReference.toLowerCase().includes(q);
                          if (!matchesQuote && !matchesDoc && !matchesRef) return false;
                        }
                        return true;
                      })
                      .map((ev) => {
                        const isVerified = ev.verificationStatus === 'VERIFIED';
                        const isReview = ev.verificationStatus === 'NEEDS_REVIEW';

                        return (
                          <div key={ev.id} className={styles.ledgerCard}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '0.5rem',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span className={styles.provenancePill}>
                                  {ev.classification.replace(/_/g, ' ')}
                                </span>
                                <span
                                  className={
                                    isVerified
                                      ? styles.verificationBadgeVerified
                                      : isReview
                                      ? styles.verificationBadgeReview
                                      : styles.verificationBadgeUnverified
                                  }
                                >
                                  {isVerified
                                    ? '✓ VERIFIED'
                                    : isReview
                                    ? '⚠️ NEEDS REVIEW'
                                    : '✕ UNVERIFIED'}
                                </span>
                                <span className={styles.datePill}>
                                  Confidence: {ev.confidenceCategory}
                                </span>
                              </div>

                              {ev.documentId && (
                                <button
                                  type="button"
                                  className={styles.jumpButton}
                                  onClick={() =>
                                    openViewer(
                                      ev.documentId!,
                                      ev.documentTitle || 'Document',
                                      ev.pageNumber || 1
                                    )
                                  }
                                >
                                  📄 {ev.documentTitle || 'Document'} (p.{ev.pageNumber || 1}) →
                                </button>
                              )}
                            </div>

                            {ev.quotedText && (
                              <blockquote className={styles.evidenceQuoteBlock}>
                                &ldquo;{ev.quotedText}&rdquo;
                              </blockquote>
                            )}

                            {ev.sourceReference && (
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                Source Reference: {ev.sourceReference}
                              </span>
                            )}

                            {/* Used By Lineage Chips */}
                            {ev.usedBy && ev.usedBy.length > 0 && (
                              <div className={styles.usedBySection}>
                                <span
                                  style={{
                                    fontSize: '0.74rem',
                                    color: 'var(--text-muted)',
                                    fontWeight: 600,
                                  }}
                                >
                                  Used by Matter Findings:
                                </span>
                                <div className={styles.usedByChips}>
                                  {ev.usedBy.map((ub, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      className={styles.usedByChip}
                                      onClick={() => {
                                        if (ub.type === 'CONSISTENCY') setActiveTab('consistency');
                                        else if (ub.type === 'QUESTION') setActiveTab('questions');
                                        else if (ub.type === 'ACTION_ITEM') setActiveTab('actionPlan');
                                        else if (ub.type === 'RELATIONSHIP') setActiveTab('relationships');
                                        else if (ub.type === 'BRIEF') setActiveTab('prepare');
                                      }}
                                    >
                                      {ub.title} →
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
}
