'use client';

import React, { useState, useEffect, useMemo } from 'react';
import styles from './PreparationWorkspace.module.css';
import { DocumentDto } from '@/lib/document/types';
import {
  PreparationBrief,
  PreparationLawyerQuestion,
  PreparationChecklistItem,
  AttentionLevel,
} from '@/lib/ai/schemas';
import { DocumentViewer } from '@/components/document/DocumentViewer';
import { Badge } from '@/components/ui/Badge/Badge';
import { Spinner } from '@/components/ui/Spinner/Spinner';

interface PreparationWorkspaceProps {
  initialDocId?: string;
  initialComparisonId?: string;
}

type TabType =
  | 'ALL'
  | 'OVERVIEW'
  | 'FACTS'
  | 'OBLIGATIONS'
  | 'ATTENTION'
  | 'CHANGES'
  | 'QUESTIONS'
  | 'CHECKLIST'
  | 'NEEDED'
  | 'NOTES';

export const PreparationWorkspace: React.FC<PreparationWorkspaceProps> = ({
  initialDocId,
  initialComparisonId,
}) => {
  // Source Selection State
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>(initialDocId || '');
  const [selectedComparisonId] = useState<string>(initialComparisonId || '');
  const [purpose, setPurpose] = useState<string>('');
  const [userNoteInput, setUserNoteInput] = useState<string>('');

  // Generation & Preparation State
  const [preparation, setPreparation] = useState<PreparationBrief | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isLoadingSources, setIsLoadingSources] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Workspace View State
  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [preparedQuestions, setPreparedQuestions] = useState<Set<string>>(new Set());
  const [copiedQuestionId, setCopiedQuestionId] = useState<string | null>(null);

  // Document Viewer State
  const [viewerDocId, setViewerDocId] = useState<string>('');
  const [viewerActivePage, setViewerActivePage] = useState<number | undefined>(undefined);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(true);

  // Suggested purpose chips
  const suggestedPurposes = [
    'Review revised agreement before signing',
    'Assess termination rights and notice periods',
    'Evaluate liability caps and indemnities',
    'Clarify ambiguous obligations and milestones',
    'Pre-negotiation audit with legal counsel',
  ];

  // 1. Fetch available ready documents on mount
  useEffect(() => {
    let ignore = false;
    async function loadSources() {
      try {
        const res = await fetch('/api/documents');
        if (ignore) return;
        if (res.ok) {
          const data = await res.json();
          if (ignore) return;
          const readyDocs: DocumentDto[] = (data.documents || []).filter(
            (d: DocumentDto) => d.status === 'READY' && d.fileAvailable !== false
          );
          setDocuments(readyDocs);
          if (!selectedDocId && readyDocs[0]) {
            setSelectedDocId(readyDocs[0].id);
          }
        }
      } catch {
        // Source loading failure can be handled silently or with fallback
      } finally {
        if (!ignore) {
          setIsLoadingSources(false);
        }
      }
    }

    loadSources();
    return () => {
      ignore = true;
    };
  }, [selectedDocId]);

  // 2. Auto-load cached preparation if initial IDs are provided
  useEffect(() => {
    if (!initialDocId && !initialComparisonId) return;

    let ignore = false;
    async function autoLoad() {
      try {
        const params = new URLSearchParams();
        if (initialDocId) params.set('documentId', initialDocId);
        if (initialComparisonId) params.set('comparisonId', initialComparisonId);

        const res = await fetch(`/api/preparations?${params.toString()}`);
        if (ignore) return;
        if (res.ok) {
          const data = await res.json();
          if (ignore) return;
          if (data.preparation) {
            setPreparation(data.preparation);
            setViewerDocId(initialDocId || data.preparation.documentsUnderReview[0]?.documentId || '');
          }
        }
      } catch {
        // Ignore auto-load failure
      }
    }

    autoLoad();
    return () => {
      ignore = true;
    };
  }, [initialDocId, initialComparisonId]);

  // 3. Trigger Generation or Retrieval
  const handleGenerate = async (force: boolean = false) => {
    if (!selectedDocId && !selectedComparisonId) {
      setErrorMessage('Please select a document or comparison to prepare for counsel.');
      return;
    }

    try {
      setIsGenerating(true);
      setErrorMessage(null);

      const allNotes = userNoteInput.trim() ? [userNoteInput.trim()] : [];

      const res = await fetch('/api/preparations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocId || undefined,
          comparisonId: selectedComparisonId || undefined,
          purpose: purpose.trim() || undefined,
          userNotes: allNotes,
          force,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Preparation brief generation failed.');
      }

      setPreparation(data.preparation);
      setViewerDocId(selectedDocId || data.preparation.documentsUnderReview[0]?.documentId || '');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred generating the brief.';
      setErrorMessage(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // 4. Checklist Item Toggle Handler
  const handleChecklistToggle = async (itemId: string, currentStatus: boolean) => {
    if (!preparation) return;

    // Optimistic UI update
    const nextStatus = !currentStatus;
    setPreparation((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        checklist: prev.checklist.map((item) =>
          item.id === itemId ? { ...item, isCompleted: nextStatus } : item
        ),
      };
    });

    try {
      await fetch(`/api/preparations/${preparation.id}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, isCompleted: nextStatus }),
      });
    } catch {
      // Revert optimistic update on failure
      setPreparation((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          checklist: prev.checklist.map((item) =>
            item.id === itemId ? { ...item, isCompleted: currentStatus } : item
          ),
        };
      });
    }
  };

  // 5. Citation Navigation Click
  const handleCitationClick = (pageNumber: number, targetDocId?: string) => {
    setViewerActivePage(pageNumber);
    if (targetDocId) {
      setViewerDocId(targetDocId);
    }
    setIsViewerOpen(true);
  };

  // 6. Copy Question
  const handleCopyQuestion = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedQuestionId(id);
    setTimeout(() => setCopiedQuestionId(null), 2000);
  };

  const togglePreparedQuestion = (id: string) => {
    setPreparedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getAttentionBadge = (level: AttentionLevel) => {
    switch (level) {
      case 'HIGH':
        return <Badge variant="risk">High Attention</Badge>;
      case 'MEDIUM':
        return <Badge variant="review">Medium Attention</Badge>;
      case 'LOW':
        return <Badge variant="general">Low Attention</Badge>;
      default:
        return <Badge variant="default">Informational</Badge>;
    }
  };

  const effectiveViewerDocId = viewerDocId || preparation?.documentsUnderReview[0]?.documentId || '';

  const activeDocTitle = useMemo(() => {
    if (!preparation) return '';
    const found = preparation.documentsUnderReview.find((d) => d.documentId === effectiveViewerDocId);
    return found ? found.title : preparation.documentsUnderReview[0]?.title || '';
  }, [preparation, effectiveViewerDocId]);

  return (
    <div className={styles.workspaceContainer}>
      {/* ------------------------------------------------------------
          Top Selection & Consultation Objective Bar
          ------------------------------------------------------------ */}
      <section className={styles.selectionBar} aria-label="Consultation Brief Setup">
        <div className={styles.selectionTitle}>
          <span>⚖️</span>
          <span>Prepare for Legal Consultation</span>
        </div>

        <div className={styles.selectorsGrid}>
          {/* Document Selector */}
          <div className={styles.inputGroup}>
            <label htmlFor="doc-select" className={styles.inputLabel}>
              Analyzed Document
            </label>
            <select
              id="doc-select"
              className={styles.selectInput}
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              disabled={isLoadingSources || isGenerating}
            >
              <option value="">-- Select Analyzed Document --</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title} ({doc.pageCount ?? '?'} pgs)
                </option>
              ))}
            </select>
          </div>

          {/* Consultation Purpose Input */}
          <div className={styles.inputGroup}>
            <label htmlFor="purpose-input" className={styles.inputLabel}>
              Purpose of Consultation
            </label>
            <input
              id="purpose-input"
              type="text"
              className={styles.textInput}
              placeholder="e.g. Review revised employment agreement before signing"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              disabled={isGenerating}
            />
            {/* Quick Purpose Chips */}
            <div className={styles.chipsRow}>
              {suggestedPurposes.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={styles.chipButton}
                  onClick={() => setPurpose(p)}
                >
                  + {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* User Notes Input */}
        <div className={styles.inputGroup}>
          <label htmlFor="notes-input" className={styles.inputLabel}>
            Your Notes &amp; Concerns (Labeled as User-Provided Context)
          </label>
          <textarea
            id="notes-input"
            className={styles.textArea}
            placeholder="Add specific context, prior oral agreements, or questions you want the attorney to review..."
            value={userNoteInput}
            onChange={(e) => setUserNoteInput(e.target.value)}
            disabled={isGenerating}
          />
        </div>

        {/* Action Trigger */}
        <div className={styles.actionRow}>
          {errorMessage && (
            <span style={{ color: '#f87171', fontSize: '0.8rem' }}>⚠️ {errorMessage}</span>
          )}

          <button
            type="button"
            className={styles.generateBtn}
            onClick={() => handleGenerate(false)}
            disabled={(!selectedDocId && !selectedComparisonId) || isGenerating}
          >
            {isGenerating ? (
              <>
                <Spinner size="sm" />
                <span>Generating Preparation Dossier...</span>
              </>
            ) : (
              <>
                <span>✦</span>
                <span>Generate Consultation Brief</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* ------------------------------------------------------------
          Main Workspace: Dossier on Left, PDF Viewer on Right
          ------------------------------------------------------------ */}
      {preparation ? (
        <section className={styles.workspaceBody} aria-label="Consultation brief">
          {/* Left Pane: Structured Dossier */}
          <section className={styles.dossierPane} aria-label="Executive Consultation Dossier">
            {/* Header Card */}
            <div className={styles.headerCard}>
              <div className={styles.headerActions}>
                <div>
                  <span className={styles.brandOverline}>Lawyer Consultation Dossier</span>
                  <h1 className={styles.dossierTitle}>{preparation.overview.title}</h1>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    className={styles.printBtn}
                    onClick={() => window.print()}
                    title="Print or Save as PDF"
                  >
                    <span>🖨️</span>
                    <span>Print / Save as PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGenerate(true)}
                    disabled={isGenerating}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-gold, #c8a256)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    {isGenerating ? 'Regenerating...' : '↻ Regenerate'}
                  </button>
                </div>
              </div>

              {/* Consultation Purpose Banner */}
              <div className={styles.purposeBanner}>
                <strong>Consultation Objective: </strong>
                {preparation.purpose}
              </div>

              {/* Documents & Jurisdiction Metadata */}
              <div className={styles.metaPillsRow}>
                <span className={styles.metaPill}>
                  📄 {preparation.overview.documentType}
                </span>
                <span className={styles.metaPill}>
                  ⚖️ {preparation.overview.governingLaw}
                </span>
                {preparation.documentsUnderReview.map((d) => (
                  <span key={d.documentId} className={styles.metaPill}>
                    {d.role}: {d.title} ({d.pageCount} pgs)
                  </span>
                ))}
              </div>

              {/* Evidence Verification Health */}
              {preparation.validationSummary.totalCitations > 0 && (
                <div className={styles.healthBarContainer}>
                  <div className={styles.healthBarHeader}>
                    <span>Citation Verification Health</span>
                    <span>
                      {Math.round(
                        (preparation.validationSummary.validatedCount /
                          preparation.validationSummary.totalCitations) *
                          100
                      )}
                      % Grounded in Document Text ({preparation.validationSummary.validatedCount}/
                      {preparation.validationSummary.totalCitations})
                    </span>
                  </div>
                  <div className={styles.healthBarTrack}>
                    <div
                      className={styles.healthBarFill}
                      style={{
                        width: `${Math.round(
                          (preparation.validationSummary.validatedCount /
                            preparation.validationSummary.totalCitations) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Tab Navigation */}
            <nav className={styles.tabBar} aria-label="Dossier Sections">
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'ALL' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('ALL')}
              >
                All Sections
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'QUESTIONS' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('QUESTIONS')}
              >
                Questions for Counsel
                <span className={styles.tabCount}>{preparation.lawyerQuestions.length}</span>
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'CHECKLIST' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('CHECKLIST')}
              >
                Action Checklist
                <span className={styles.tabCount}>{preparation.checklist.length}</span>
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'FACTS' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('FACTS')}
              >
                Facts &amp; Timeline
                <span className={styles.tabCount}>
                  {preparation.keyFacts.length + preparation.keyDates.length}
                </span>
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'OBLIGATIONS' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('OBLIGATIONS')}
              >
                Obligations &amp; Rights
                <span className={styles.tabCount}>
                  {preparation.obligations.length + preparation.rights.length}
                </span>
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'ATTENTION' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('ATTENTION')}
              >
                Attention Areas
                <span className={styles.tabCount}>{preparation.attentionAreas.length}</span>
              </button>
              {preparation.versionChanges && (
                <button
                  type="button"
                  className={`${styles.tabBtn} ${activeTab === 'CHANGES' ? styles.tabBtnActive : ''}`}
                  onClick={() => setActiveTab('CHANGES')}
                >
                  Version Changes
                  <span className={styles.tabCount}>{preparation.versionChanges.length}</span>
                </button>
              )}
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'NEEDED' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('NEEDED')}
              >
                Documents to Bring
                <span className={styles.tabCount}>{preparation.documentsToBring.length}</span>
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'NOTES' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('NOTES')}
              >
                User Notes
                <span className={styles.tabCount}>{preparation.userNotes.length}</span>
              </button>
            </nav>

            {/* --------------------------------------------------------
                Section 1: Questions for Counsel
                -------------------------------------------------------- */}
            {(activeTab === 'ALL' || activeTab === 'QUESTIONS') && (
              <section className={styles.sectionCard} aria-label="Questions for Counsel">
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>
                    <span>💬</span>
                    <span>Prioritized Questions for Legal Counsel</span>
                  </h2>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {preparation.lawyerQuestions.length} Questions
                  </span>
                </div>

                {preparation.lawyerQuestions.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No specific questions synthesized.</p>
                ) : (
                  preparation.lawyerQuestions.map((q: PreparationLawyerQuestion, idx: number) => {
                    const isPrepared = preparedQuestions.has(q.id);
                    return (
                      <article key={q.id} className={styles.questionCard}>
                        <div className={styles.questionTop}>
                          <span className={styles.questionNum}>
                            Question {idx + 1} · {q.category}
                          </span>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              type="button"
                              className={styles.copyBtn}
                              onClick={() => handleCopyQuestion(q.id, q.question)}
                            >
                              {copiedQuestionId === q.id ? '✓ Copied' : 'Copy Question'}
                            </button>
                            <button
                              type="button"
                              className={styles.copyBtn}
                              style={{
                                color: isPrepared ? '#10b981' : undefined,
                                borderColor: isPrepared ? 'rgba(16, 185, 129, 0.4)' : undefined,
                              }}
                              onClick={() => togglePreparedQuestion(q.id)}
                            >
                              {isPrepared ? '✓ Prepared' : 'Mark Prepared'}
                            </button>
                          </div>
                        </div>

                        <p className={styles.questionText}>&ldquo;{q.question}&rdquo;</p>

                        {q.whyItMatters && (
                          <div className={styles.whyItMatters}>
                            <strong>Why this matters: </strong>
                            {q.whyItMatters}
                          </div>
                        )}

                        {q.pageNumber && q.quotedText && (
                          <div className={styles.citationBar}>
                            <button
                              type="button"
                              className={styles.citationBtn}
                              onClick={() => handleCitationClick(q.pageNumber!, q.documentId)}
                            >
                              <span>📄 Page {q.pageNumber}</span>
                            </button>
                            <span className={styles.quoteExcerpt}>&ldquo;{q.quotedText}&rdquo;</span>
                          </div>
                        )}
                      </article>
                    );
                  })
                )}
              </section>
            )}

            {/* --------------------------------------------------------
                Section 2: Actionable Preparation Checklist
                -------------------------------------------------------- */}
            {(activeTab === 'ALL' || activeTab === 'CHECKLIST') && (
              <section className={styles.sectionCard} aria-label="Actionable Preparation Checklist">
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>
                    <span>✅</span>
                    <span>Actionable Preparation Checklist</span>
                  </h2>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {preparation.checklist.filter((c) => c.isCompleted).length} of{' '}
                    {preparation.checklist.length} Completed
                  </span>
                </div>

                {/* Group: Before Consultation */}
                <div className={styles.checklistGroup}>
                  <span className={styles.checklistGroupTitle}>1. Before Consultation</span>
                  {preparation.checklist
                    .filter((c) => c.category === 'BEFORE_CONSULTATION')
                    .map((item: PreparationChecklistItem) => (
                      <label key={item.id} className={styles.checkItem}>
                        <input
                          type="checkbox"
                          className={styles.checkboxInput}
                          checked={item.isCompleted}
                          onChange={() => handleChecklistToggle(item.id, item.isCompleted)}
                        />
                        <div>
                          <p
                            className={`${styles.checkItemText} ${
                              item.isCompleted ? styles.checkItemCompleted : ''
                            }`}
                          >
                            {item.item}
                          </p>
                          {item.whyRelevant && (
                            <p className={styles.checkWhy}>{item.whyRelevant}</p>
                          )}
                        </div>
                      </label>
                    ))}
                </div>

                {/* Group: For the Lawyer */}
                <div className={styles.checklistGroup}>
                  <span className={styles.checklistGroupTitle}>2. For the Meeting / Counsel</span>
                  {preparation.checklist
                    .filter((c) => c.category === 'FOR_THE_LAWYER')
                    .map((item: PreparationChecklistItem) => (
                      <label key={item.id} className={styles.checkItem}>
                        <input
                          type="checkbox"
                          className={styles.checkboxInput}
                          checked={item.isCompleted}
                          onChange={() => handleChecklistToggle(item.id, item.isCompleted)}
                        />
                        <div>
                          <p
                            className={`${styles.checkItemText} ${
                              item.isCompleted ? styles.checkItemCompleted : ''
                            }`}
                          >
                            {item.item}
                          </p>
                          {item.whyRelevant && (
                            <p className={styles.checkWhy}>{item.whyRelevant}</p>
                          )}
                        </div>
                      </label>
                    ))}
                </div>

                {/* Group: After Consultation */}
                <div className={styles.checklistGroup}>
                  <span className={styles.checklistGroupTitle}>3. After Consultation</span>
                  {preparation.checklist
                    .filter((c) => c.category === 'AFTER_CONSULTATION')
                    .map((item: PreparationChecklistItem) => (
                      <label key={item.id} className={styles.checkItem}>
                        <input
                          type="checkbox"
                          className={styles.checkboxInput}
                          checked={item.isCompleted}
                          onChange={() => handleChecklistToggle(item.id, item.isCompleted)}
                        />
                        <div>
                          <p
                            className={`${styles.checkItemText} ${
                              item.isCompleted ? styles.checkItemCompleted : ''
                            }`}
                          >
                            {item.item}
                          </p>
                          {item.whyRelevant && (
                            <p className={styles.checkWhy}>{item.whyRelevant}</p>
                          )}
                        </div>
                      </label>
                    ))}
                </div>
              </section>
            )}

            {/* --------------------------------------------------------
                Section 3: Key Facts & Dates Timeline
                -------------------------------------------------------- */}
            {(activeTab === 'ALL' || activeTab === 'FACTS') && (
              <section className={styles.sectionCard} aria-label="Key Facts & Timeline">
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>
                    <span>📌</span>
                    <span>Document Facts &amp; Timeline</span>
                  </h2>
                </div>

                {/* Key Facts */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {preparation.keyFacts.map((fact) => (
                    <div key={fact.id} className={styles.itemCard}>
                      <span className={styles.itemParty}>{fact.label}</span>
                      <p className={styles.itemTitle}>{fact.value}</p>
                      {fact.pageNumber && fact.quotedText && (
                        <div className={styles.citationBar}>
                          <button
                            type="button"
                            className={styles.citationBtn}
                            onClick={() => handleCitationClick(fact.pageNumber!, fact.documentId)}
                          >
                            <span>📄 Page {fact.pageNumber}</span>
                          </button>
                          {!fact.isValidated && (
                            <span className={styles.unverifiedNotice}>⚠ Needs Review</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Key Dates Timeline */}
                <h3
                  style={{
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--color-gold, #c8a256)',
                    marginTop: '0.75rem',
                  }}
                >
                  Chronological Timeline
                </h3>
                {preparation.keyDates.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No specific dates identified.</p>
                ) : (
                  preparation.keyDates.map((dt) => (
                    <div key={dt.id} className={styles.itemCard}>
                      <div className={styles.itemHeader}>
                        <span className={styles.itemParty}>{dt.label}</span>
                        <strong style={{ color: 'var(--color-gold, #c8a256)', fontSize: '0.85rem' }}>
                          {dt.dateValue}
                        </strong>
                      </div>
                      {dt.description && <p className={styles.checkWhy}>{dt.description}</p>}
                      {dt.pageNumber && dt.quotedText && (
                        <div className={styles.citationBar}>
                          <button
                            type="button"
                            className={styles.citationBtn}
                            onClick={() => handleCitationClick(dt.pageNumber!, dt.documentId)}
                          >
                            <span>📄 Page {dt.pageNumber}</span>
                          </button>
                          <span className={styles.quoteExcerpt}>&ldquo;{dt.quotedText}&rdquo;</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </section>
            )}

            {/* --------------------------------------------------------
                Section 4: Obligations & Rights
                -------------------------------------------------------- */}
            {(activeTab === 'ALL' || activeTab === 'OBLIGATIONS') && (
              <section className={styles.sectionCard} aria-label="Obligations and Rights">
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>
                    <span>⚖️</span>
                    <span>Obligations &amp; Rights</span>
                  </h2>
                </div>

                {preparation.obligations.map((ob) => (
                  <div key={ob.id} className={styles.itemCard}>
                    <div className={styles.itemHeader}>
                      <div>
                        <span className={styles.itemParty}>{ob.party}</span>
                        <h4 className={styles.itemTitle}>{ob.obligation}</h4>
                      </div>
                      {getAttentionBadge(ob.attentionLevel)}
                    </div>

                    {ob.explanation && (
                      <div className={styles.plainLangBox}>
                        <strong>Plain English: </strong>
                        {ob.explanation}
                      </div>
                    )}

                    {ob.conditionOrDeadline && (
                      <p className={styles.checkWhy}>
                        <strong>Timing/Condition: </strong>
                        {ob.conditionOrDeadline}
                      </p>
                    )}

                    {ob.pageNumber && (
                      <div className={styles.citationBar}>
                        <button
                          type="button"
                          className={styles.citationBtn}
                          onClick={() => handleCitationClick(ob.pageNumber)}
                        >
                          <span>📄 Page {ob.pageNumber}</span>
                          {ob.sectionReference && <span>· {ob.sectionReference}</span>}
                        </button>
                        {ob.quotedText && (
                          <span className={styles.quoteExcerpt}>&ldquo;{ob.quotedText}&rdquo;</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </section>
            )}

            {/* --------------------------------------------------------
                Section 5: Attention Areas
                -------------------------------------------------------- */}
            {(activeTab === 'ALL' || activeTab === 'ATTENTION') && (
              <section className={styles.sectionCard} aria-label="Attention Areas">
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>
                    <span>⚠️</span>
                    <span>Areas Warranting Closer Review</span>
                  </h2>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {preparation.attentionAreas.length} Areas
                  </span>
                </div>

                {preparation.attentionAreas.map((att) => (
                  <div key={att.id} className={styles.itemCard}>
                    <div className={styles.itemHeader}>
                      <div>
                        <span className={styles.itemParty}>{att.category}</span>
                        <h4 className={styles.itemTitle}>{att.title}</h4>
                      </div>
                      {getAttentionBadge(att.attentionLevel)}
                    </div>

                    <p className={styles.checkWhy}>{att.description}</p>

                    {att.whyItMatters && (
                      <div className={styles.whyItMatters}>
                        <strong>Why review is recommended: </strong>
                        {att.whyItMatters}
                      </div>
                    )}

                    {att.pageNumber && (
                      <div className={styles.citationBar}>
                        <button
                          type="button"
                          className={styles.citationBtn}
                          onClick={() => handleCitationClick(att.pageNumber)}
                        >
                          <span>📄 Page {att.pageNumber}</span>
                        </button>
                        {att.quotedText && (
                          <span className={styles.quoteExcerpt}>&ldquo;{att.quotedText}&rdquo;</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </section>
            )}

            {/* --------------------------------------------------------
                Section 6: Version Changes (Comparison mode)
                -------------------------------------------------------- */}
            {preparation.versionChanges && (activeTab === 'ALL' || activeTab === 'CHANGES') && (
              <section className={styles.sectionCard} aria-label="Version Changes">
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>
                    <span>⇄</span>
                    <span>Changes Between Versions</span>
                  </h2>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {preparation.versionChanges.length} Differences
                  </span>
                </div>

                {preparation.versionChanges.map((ch) => (
                  <div key={ch.id} className={styles.itemCard}>
                    <div className={styles.itemHeader}>
                      <div>
                        <span className={styles.itemParty}>[{ch.type}] {ch.category}</span>
                        <h4 className={styles.itemTitle}>{ch.title}</h4>
                      </div>
                      {getAttentionBadge(ch.attentionLevel)}
                    </div>

                    <p className={styles.checkWhy}>{ch.changeSummary}</p>

                    {ch.semanticChanges.length > 0 && (
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                        {ch.semanticChanges.map((sc, i) => (
                          <div key={i} style={{ fontSize: '0.75rem', color: '#e5e7eb' }}>
                            <strong>{sc.field}: </strong>
                            <span style={{ color: '#ef4444' }}>{sc.before}</span> →{' '}
                            <span style={{ color: '#10b981' }}>{sc.after}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {ch.baseEvidence && (
                      <div className={styles.citationBar}>
                        <button
                          type="button"
                          className={styles.citationBtn}
                          onClick={() =>
                            handleCitationClick(ch.baseEvidence!.pageNumber, ch.baseEvidence!.documentId)
                          }
                        >
                          <span>BASE · 📄 Page {ch.baseEvidence.pageNumber}</span>
                        </button>
                        <span className={styles.quoteExcerpt}>
                          &ldquo;{ch.baseEvidence.quotedText}&rdquo;
                        </span>
                      </div>
                    )}

                    {ch.targetEvidence && (
                      <div className={styles.citationBar}>
                        <button
                          type="button"
                          className={styles.citationBtn}
                          onClick={() =>
                            handleCitationClick(ch.targetEvidence!.pageNumber, ch.targetEvidence!.documentId)
                          }
                        >
                          <span>REVISED · 📄 Page {ch.targetEvidence.pageNumber}</span>
                        </button>
                        <span className={styles.quoteExcerpt}>
                          &ldquo;{ch.targetEvidence.quotedText}&rdquo;
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </section>
            )}

            {/* --------------------------------------------------------
                Section 7: Documents to Bring & Missing Information
                -------------------------------------------------------- */}
            {(activeTab === 'ALL' || activeTab === 'NEEDED') && (
              <section className={styles.sectionCard} aria-label="Documents to Bring & Missing Information">
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>
                    <span>📂</span>
                    <span>Documents to Bring &amp; Missing Information</span>
                  </h2>
                </div>

                <div className={styles.checklistGroup}>
                  <span className={styles.checklistGroupTitle}>Documents to Bring</span>
                  {preparation.documentsToBring.map((dtb) => (
                    <div key={dtb.id} className={styles.itemCard}>
                      <h4 className={styles.itemTitle}>📋 {dtb.documentName}</h4>
                      <p className={styles.checkWhy}>{dtb.reason}</p>
                    </div>
                  ))}
                </div>

                <div className={styles.checklistGroup}>
                  <span className={styles.checklistGroupTitle}>Information Still Needed</span>
                  {preparation.missingInformation.map((m) => (
                    <div key={m.id} className={styles.itemCard}>
                      <h4 className={styles.itemTitle}>❓ {m.item}</h4>
                      <p className={styles.checkWhy}>{m.whyItMatters}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* --------------------------------------------------------
                Section 8: User Notes & Context
                -------------------------------------------------------- */}
            {(activeTab === 'ALL' || activeTab === 'NOTES') && (
              <section className={styles.sectionCard} aria-label="User Notes">
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>
                    <span>📝</span>
                    <span>User-Provided Notes &amp; Context</span>
                  </h2>
                  <Badge variant="general">User Provided</Badge>
                </div>

                {preparation.userNotes.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No personal notes or specific concerns provided.
                  </p>
                ) : (
                  preparation.userNotes.map((note) => (
                    <div key={note.id} className={styles.itemCard}>
                      <p className={styles.itemTitle}>&ldquo;{note.note}&rdquo;</p>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Added {new Date(note.createdAt).toLocaleString()} · USER_PROVIDED
                      </span>
                    </div>
                  ))
                )}
              </section>
            )}

            {/* Legal Disclaimer Footer */}
            <div className={styles.disclaimerFooter}>
              <strong>Legal Notice: </strong>
              {preparation.disclaimer}
            </div>
          </section>

          {/* Right Pane: Document Viewer with Citation Sync */}
          {isViewerOpen && effectiveViewerDocId && (
            <aside className={styles.viewerPane} aria-label="Source Document Reference">
              <div className={styles.viewerHeader}>
                <span className={styles.viewerHeaderTitle} title={activeDocTitle}>
                  📄 {activeDocTitle}
                </span>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  {preparation.documentsUnderReview.length > 1 && (
                    <select
                      className={styles.selectInput}
                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.72rem', width: 'auto' }}
                      value={effectiveViewerDocId}
                      onChange={(e) => {
                        setViewerDocId(e.target.value);
                        setViewerActivePage(undefined);
                      }}
                    >
                      {preparation.documentsUnderReview.map((d) => (
                        <option key={d.documentId} value={d.documentId}>
                          {d.role}: {d.title}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                    onClick={() => setIsViewerOpen(false)}
                    title="Collapse Viewer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className={styles.viewerBody}>
                <DocumentViewer
                  fileUrl={`/api/documents/${effectiveViewerDocId}/file`}
                  activePage={viewerActivePage}
                />
              </div>
            </aside>
          )}
        </section>
      ) : (
        /* Empty State when no preparation brief is loaded yet */
        <div className={styles.emptyState}>
          <span className={styles.emptyIndex}>NEXT / 01</span>
          <h2>Bring the document. Leave with better questions.</h2>
          <p>Select an analyzed document and describe your consultation goal. LawGuide can organize document facts, dates, and questions for a qualified legal professional to review.</p>
        </div>
      )}
    </div>
  );
};
