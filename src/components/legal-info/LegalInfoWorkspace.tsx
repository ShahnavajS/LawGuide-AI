'use client';

import React, { useState, useEffect, useMemo } from 'react';
import styles from './LegalInfoWorkspace.module.css';
import {
  searchTaxonomyTopics,
} from '@/lib/legal-info/taxonomy';
import {
  LegalInformationDossier,
  ConceptQuestionResponse,
} from '@/lib/legal-info/schemas';
import { LEGAL_INFO_MODES, LegalInfoMode } from '@/lib/ai/safety';

export interface LegalInfoWorkspaceProps {
  initialTopic?: string;
  initialDocId?: string;
  initialComparisonId?: string;
  onNavigateToDocument?: (docId: string, pageNumber: number) => void;
}

export const LegalInfoWorkspace: React.FC<LegalInfoWorkspaceProps> = ({
  initialTopic = 'TERMINATION',
  initialDocId,
  initialComparisonId,
  onNavigateToDocument,
}) => {
  // State
  const [selectedTopicId, setSelectedTopicId] = useState<string>(initialTopic);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [activeMode, setActiveMode] = useState<LegalInfoMode>(LEGAL_INFO_MODES.GENERAL_LEGAL_INFO);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dossier, setDossier] = useState<LegalInformationDossier | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Q&A State
  const [userQuestion, setUserQuestion] = useState<string>('');
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [qaResult, setQaResult] = useState<ConceptQuestionResponse | null>(null);
  const [qaError, setQaError] = useState<string | null>(null);
  const [copiedQuestionIndex, setCopiedQuestionIndex] = useState<number | null>(null);

  // Filtered topics in sidebar
  const filteredTopics = useMemo(() => {
    return searchTaxonomyTopics(searchQuery);
  }, [searchQuery]);

  // Load Topic Dossier
  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const queryParams = new URLSearchParams();
        if (initialDocId) queryParams.set('docId', initialDocId);
        if (initialComparisonId) queryParams.set('comparisonId', initialComparisonId);
        if (selectedCountry) queryParams.set('country', selectedCountry);

        const url = `/api/legal-info/topics/${encodeURIComponent(selectedTopicId)}?${queryParams.toString()}`;
        const res = await fetch(url);
        if (ignore) return;
        const data = await res.json();
        if (ignore) return;

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to load legal information dossier.');
        }

        setDossier(data.dossier);
        setActiveMode(data.dossier.mode || LEGAL_INFO_MODES.GENERAL_LEGAL_INFO);
        setLoadError(null);
      } catch (err: unknown) {
        if (!ignore) {
          setLoadError(err instanceof Error ? err.message : 'An unexpected error occurred.');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [selectedTopicId, selectedCountry, initialDocId, initialComparisonId]);

  // Handle Question Submission
  const handleAskQuestion = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userQuestion.trim()) return;

    setIsAsking(true);
    setQaError(null);

    try {
      const res = await fetch('/api/legal-info/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: selectedTopicId,
          question: userQuestion.trim(),
          documentId: initialDocId,
          jurisdiction: selectedCountry
            ? { country: selectedCountry, source: 'USER_PROVIDED_JURISDICTION' }
            : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 401) {
          throw new Error('Sign in to ask a question and save the answer to your workspace.');
        }
        throw new Error(data.error?.message || data.error || 'Failed to get answer for this concept.');
      }

      setQaResult(data.data);
    } catch (err: unknown) {
      setQaError(err instanceof Error ? err.message : 'Error answering question.');
    } finally {
      setIsAsking(false);
    }
  };

  const handleCopyQuestion = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedQuestionIndex(idx);
    setTimeout(() => setCopiedQuestionIndex(null), 2000);
  };

  return (
    <div className={styles.container} aria-label="Legal Information Navigator">
      {/* Top Hero Card */}
      <header className={styles.headerCard}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>Legal Information Navigator</h1>
            <p className={styles.subtitle}>
              Explore legal concepts, understand standard contract provisions, and prepare informed questions for counsel.
            </p>
          </div>
        </div>

        {/* Operational Modes Indicator */}
        <div className={styles.modeBar} aria-label="Operational Mode Selector">
          <span className={styles.modeBarLabel}>Active View Mode:</span>
          <div className={styles.modePills}>
            <button
              type="button"
              className={`${styles.modePill} ${
                activeMode === LEGAL_INFO_MODES.MY_DOCUMENT ? styles.modePillActive : ''
              }`}
              onClick={() => setActiveMode(LEGAL_INFO_MODES.MY_DOCUMENT)}
            >
              Mode 1: My Document Evidence
            </button>
            <button
              type="button"
              className={`${styles.modePill} ${
                activeMode === LEGAL_INFO_MODES.GENERAL_LEGAL_INFO ? styles.modePillActive : ''
              }`}
              onClick={() => setActiveMode(LEGAL_INFO_MODES.GENERAL_LEGAL_INFO)}
            >
              Mode 2: General Legal Information
            </button>
            <button
              type="button"
              className={`${styles.modePill} ${
                activeMode === LEGAL_INFO_MODES.PREPARE_FOR_COUNSEL ? styles.modePillActive : ''
              }`}
              onClick={() => setActiveMode(LEGAL_INFO_MODES.PREPARE_FOR_COUNSEL)}
            >
              Mode 3: Prepare for Counsel
            </button>
          </div>
        </div>

        {/* Jurisdiction Status & Selector */}
        <div className={styles.jurisdictionRow}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Jurisdiction:</span>
          {dossier && (
            <span
              className={`${styles.jurisdictionBadge} ${
                dossier.jurisdiction.source === 'DOCUMENT_JURISDICTION'
                  ? styles.jurisdictionDoc
                  : dossier.jurisdiction.source === 'USER_PROVIDED_JURISDICTION'
                  ? styles.jurisdictionUser
                  : styles.jurisdictionUnset
              }`}
            >
              {dossier.jurisdiction.source === 'DOCUMENT_JURISDICTION' && '🏛️ '}
              {dossier.jurisdiction.source === 'USER_PROVIDED_JURISDICTION' && '👤 '}
              {dossier.jurisdiction.source === 'JURISDICTION_NOT_ESTABLISHED' && '⚖️ '}
              {dossier.jurisdiction.label}
            </span>
          )}

          <select
            className={styles.jurisdictionSelect}
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            aria-label="Filter by Country"
          >
            <option value="">Set / Override Jurisdiction (Optional)</option>
            <option value="India">India</option>
            <option value="United States">United States</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="International">International Commercial</option>
          </select>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className={styles.workspaceGrid}>
        {/* Left: Taxonomy Navigation */}
        <aside className={styles.sidebarCard} aria-label="Legal Taxonomy Topics">
          <div className={styles.sidebarTitle}>
            <span>Browse Concepts</span>
            <span className={styles.topicCountBadge}>{filteredTopics.length} Topics</span>
          </div>

          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search clauses (e.g. indemnity, notice)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search Topics"
          />

          <nav className={styles.topicList}>
            {filteredTopics.map((topic) => (
              <button
                key={topic.id}
                type="button"
                className={`${styles.topicItem} ${
                  selectedTopicId === topic.id ? styles.topicItemActive : ''
                }`}
                onClick={() => setSelectedTopicId(topic.id)}
              >
                <span>{topic.label}</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{topic.category.split(' ')[0]}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Right: Dossier Content */}
        <section className={styles.mainDossier} aria-label="Legal information">
          {isLoading && (
            <div className={styles.card} style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: '#d4af37', fontWeight: 600 }}>Loading educational legal dossier...</p>
            </div>
          )}

          {loadError && (
            <div className={styles.card} style={{ borderColor: '#ef4444' }}>
              <h3 style={{ color: '#f87171', margin: '0 0 0.5rem 0' }}>Could Not Retrieve Concept</h3>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{loadError}</p>
            </div>
          )}

          {!isLoading && dossier && (
            <>
              {/* 1. Concept Overview */}
              <section className={styles.card} aria-label="Concept Meaning">
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardHeading}>
                    <span>📖</span>
                    <span>{dossier.topicLabel}</span>
                  </h2>
                  <span style={{ fontSize: '0.8rem', color: '#d4af37', fontWeight: 600 }}>
                    {dossier.category}
                  </span>
                </div>

                <p className={styles.plainText}>{dossier.generalMeaning}</p>

                <h4 style={{ fontSize: '0.9rem', color: '#f8fafc', margin: '1rem 0 0.5rem 0' }}>
                  What this provision generally does:
                </h4>
                <ul className={styles.bulletList}>
                  {dossier.whatItGenerallyDoes.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </section>

              {/* 2. Document Evidence (If Available) */}
              {dossier.documentEvidence.length > 0 && (
                <section className={styles.card} aria-label="Document Findings">
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardHeading}>
                      <span>📄</span>
                      <span>Verified Document Evidence</span>
                    </h3>
                    <span className={styles.documentCitationSeal}>
                      DOCUMENT FACT · {dossier.documentEvidence.length} Findings
                    </span>
                  </div>

                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
                    The following text was verified directly from your uploaded document. Click to view citations.
                  </p>

                  {dossier.documentEvidence.map((ev, idx) => (
                    <div key={idx} className={styles.evidenceBox}>
                      <div className={styles.evidenceHeader}>
                        <div>
                          <strong style={{ color: '#ffffff', fontSize: '0.9rem' }}>{ev.documentTitle}</strong>
                          {ev.sectionReference && (
                            <span style={{ color: '#d4af37', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                              · {ev.sectionReference}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            className={styles.documentCitationSeal}
                            onClick={() => onNavigateToDocument?.(ev.documentId, ev.pageNumber)}
                            title={`Jump to Page ${ev.pageNumber}`}
                          >
                            📄 Page {ev.pageNumber}
                          </button>
                          {ev.isValidated ? (
                            <span className={styles.verifiedBadge}>✓ Verified</span>
                          ) : (
                            <span className={styles.unverifiedBadge}>⚠ Unconfirmed Quote</span>
                          )}
                        </div>
                      </div>

                      <blockquote className={styles.quoteBlock}>&ldquo;{ev.quotedText}&rdquo;</blockquote>

                      {ev.discrepancyNote && (
                        <p style={{ color: '#f59e0b', fontSize: '0.75rem', margin: '0.25rem 0 0 0' }}>
                          Note: {ev.discrepancyNote}
                        </p>
                      )}
                    </div>
                  ))}
                </section>
              )}

              {/* 3. Authoritative Sources */}
              <section className={styles.card} aria-label="Authoritative Legal Sources">
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardHeading}>
                    <span>🏛️</span>
                    <span>Authoritative Sources &amp; Public Portals</span>
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Checked on {dossier.retrievedAt.split('T')[0]}
                  </span>
                </div>

                <div className={styles.sourceGrid}>
                  {dossier.sources.map((src) => (
                    <div key={src.id} className={styles.sourceCard}>
                      <div>
                        <div className={styles.sourceTop}>
                          <h4 className={styles.sourceTitle}>{src.title}</h4>
                          <span
                            className={
                              src.authorityLevel === 'PRIMARY'
                                ? styles.authorityPrimary
                                : styles.authoritySecondary
                            }
                          >
                            {src.authorityLevel}
                          </span>
                        </div>
                        <p className={styles.sourceDesc}>{src.description}</p>
                      </div>

                      <div className={styles.sourceFooter}>
                        <span>{src.governingBody}</span>
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.sourceLink}
                        >
                          Official Portal ↗
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 4. What LexiGuide Cannot Determine (Limitations) */}
              <div className={styles.limitationsBox} role="alert">
                <div className={styles.limitationsTitle}>
                  <span>⚠️</span>
                  <span>What LexiGuide Cannot Determine</span>
                </div>
                <ul className={styles.limitationsList}>
                  {dossier.importantLimitations.map((lim, idx) => (
                    <li key={idx}>{lim}</li>
                  ))}
                </ul>
              </div>

              {/* 5. Questions for Counsel */}
              <section className={styles.card} aria-label="Questions for Counsel">
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardHeading}>
                    <span>💬</span>
                    <span>Recommended Questions for Your Attorney</span>
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Grounded in standard practice</span>
                </div>

                {dossier.questionsForCounsel.map((q, idx) => (
                  <div key={idx} className={styles.questionCard}>
                    <p className={styles.questionText}>
                      <strong style={{ color: '#d4af37', marginRight: '0.5rem' }}>{idx + 1}.</strong>
                      {q}
                    </p>
                    <button
                      type="button"
                      className={styles.copyBtn}
                      onClick={() => handleCopyQuestion(q, idx)}
                    >
                      {copiedQuestionIndex === idx ? '✓ Copied' : 'Copy Question'}
                    </button>
                  </div>
                ))}
              </section>

              {/* 6. Ask About This Concept (Controlled Q&A) */}
              <section className={styles.qaSection} aria-label="Concept Q&A">
                <h3 className={styles.cardHeading} style={{ marginBottom: '1rem' }}>
                  <span>❓</span>
                  <span>Ask About This Concept</span>
                </h3>

                <div className={styles.suggestedPills}>
                  <button
                    type="button"
                    className={styles.suggestedBtn}
                    onClick={() => setUserQuestion(`What happens if notice is not given as required?`)}
                  >
                    &ldquo;What happens if notice is late?&rdquo;
                  </button>
                  <button
                    type="button"
                    className={styles.suggestedBtn}
                    onClick={() => setUserQuestion(`What is standard commercial practice for this provision?`)}
                  >
                    &ldquo;What is standard commercial practice?&rdquo;
                  </button>
                  <button
                    type="button"
                    className={styles.suggestedBtn}
                    onClick={() => setUserQuestion(`Are there common statutory exceptions to this clause?`)}
                  >
                    &ldquo;Are there common statutory exceptions?&rdquo;
                  </button>
                </div>

                <form onSubmit={handleAskQuestion} className={styles.qaInputGroup}>
                  <input
                    type="text"
                    className={styles.qaInput}
                    placeholder={`Ask an educational question about ${dossier.topicLabel}...`}
                    value={userQuestion}
                    onChange={(e) => setUserQuestion(e.target.value)}
                    disabled={isAsking}
                  />
                  <button type="submit" className={styles.askBtn} disabled={isAsking || !userQuestion.trim()}>
                    {isAsking ? 'Analyzing...' : 'Ask Concept'}
                  </button>
                </form>

                {qaError && (
                  <p style={{ color: '#f87171', fontSize: '0.85rem', marginTop: '0.75rem' }}>{qaError}</p>
                )}

                {qaResult && (
                  <div className={styles.qaResultCard}>
                    {qaResult.documentAnswer && (
                      <div>
                        <div className={styles.qaSectionHeader}>What Your Document States:</div>
                        <p style={{ color: '#f1f5f9', margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>
                          {qaResult.documentAnswer.text}
                        </p>
                      </div>
                    )}

                    <div className={styles.qaSectionHeader}>General Legal Explanation:</div>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 1rem 0' }}>
                      {qaResult.generalLegalInfo.text}
                    </p>

                    <div className={styles.qaSectionHeader}>Questions to Discuss with Counsel:</div>
                    <ul style={{ margin: '0 0 0 1.25rem', padding: 0, color: 'var(--text-secondary)' }}>
                      {qaResult.questionsForCounsel.map((item, idx) => (
                        <li key={idx} style={{ marginBottom: '0.35rem' }}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              {/* 7. Legal Aid Navigator */}
              <section className={styles.card} aria-label="Legal Aid Resources">
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardHeading}>
                    <span>⚖️</span>
                    <span>Get Legal Help — Public Legal Aid</span>
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#d4af37' }}>Statutory Organizations</span>
                </div>

                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0 0 1rem 0' }}>
                  LexiGuide helps you prepare and organize your documents. For legal advice and representation, you can consult qualified private counsel or public legal aid authorities if eligible.
                </p>

                <div className={styles.legalAidGrid}>
                  <div className={styles.legalAidCard}>
                    <h4 className={styles.legalAidTitle}>National Legal Services Authority (NALSA)</h4>
                    <div className={styles.legalAidBasis}>Statutory Body · Legal Services Authorities Act, 1987</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 0.75rem 0' }}>
                      Free legal aid, Lok Adalats, and legal advice for eligible individuals across India.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: '#38bdf8' }}>Helpline: 15100</span>
                      <a href="https://nalsa.gov.in" target="_blank" rel="noopener noreferrer" style={{ color: '#facc15' }}>
                        Visit nalsa.gov.in ↗
                      </a>
                    </div>
                  </div>

                  <div className={styles.legalAidCard}>
                    <h4 className={styles.legalAidTitle}>Department of Justice — Tele-Law</h4>
                    <div className={styles.legalAidBasis}>Government Initiative · Ministry of Law &amp; Justice</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 0.75rem 0' }}>
                      Connects citizens with panel lawyers for pre-litigation consultation via video conference.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: '#38bdf8' }}>Helpline: 14488</span>
                      <a href="https://tele-law.in" target="_blank" rel="noopener noreferrer" style={{ color: '#facc15' }}>
                        Visit tele-law.in ↗
                      </a>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </section>
      </div>
    </div>
  );
};
