'use client';

import React, { useState } from 'react';
import styles from './LegalXRay.module.css';
import { LegalXRayAnalysis } from '@/lib/ai/schemas';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { LegalInfoModal } from '@/components/legal-info/LegalInfoModal';

export interface LegalXRayProps {
  analysis: LegalXRayAnalysis;
  documentId?: string;
  onCitationClick?: (pageNumber: number) => void;
  onReanalyze?: () => void;
  isReanalyzing?: boolean;
}

type TabKey = 'obligations' | 'dates' | 'clauses' | 'attention' | 'rights' | 'questions';

export const LegalXRay: React.FC<LegalXRayProps> = ({
  analysis,
  documentId,
  onCitationClick,
  onReanalyze,
  isReanalyzing = false,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('obligations');
  const [legalInfoTopic, setLegalInfoTopic] = useState<string | null>(null);

  const {
    overview,
    parties,
    keyDates,
    obligations,
    rights,
    financialTerms,
    materialClauses,
    attentionAreas,
    lawyerQuestions,
    validationSummary,
  } = analysis;

  const renderCitationButton = (pageNumber: number, quotedText: string, isValidated?: boolean, section?: string) => {
    return (
      <div className={styles.citationBar}>
        <button
          type="button"
          className={styles.citationButton}
          onClick={() => onCitationClick?.(pageNumber)}
          title={`Jump to Page ${pageNumber} in Document Viewer`}
          aria-label={`Jump to Page ${pageNumber}`}
        >
          <span>📄</span>
          <strong>Page {pageNumber}</strong>
          {section && <span>· {section}</span>}
        </button>

        {quotedText && (
          <p className={styles.quoteExcerpt}>
            &ldquo;{quotedText}&rdquo;
          </p>
        )}

        {isValidated === false && (
          <span className={styles.unverifiedBadge} role="alert">
            ⚠ Citation unconfirmed on cited page
          </span>
        )}
      </div>
    );
  };

  const getClassificationBadge = (type: string) => {
    switch (type) {
      case 'DOCUMENT_FACT':
        return <Badge variant="fact">Document Fact</Badge>;
      case 'AI_INTERPRETATION':
        return <Badge variant="interpretation">Interpretation</Badge>;
      case 'NEEDS_REVIEW':
        return <Badge variant="review">Needs Review</Badge>;
      default:
        return <Badge variant="general">General</Badge>;
    }
  };

  const getAttentionBadge = (level: string) => {
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

  return (
    <div className={styles.xrayContainer} aria-label="Legal X-Ray Analysis">
      {/* Overview & Summary Header Card */}
      <div className={styles.headerCard}>
        <div className={styles.titleRow}>
          <div>
            <span className={styles.brandOverline}>
              Legal X-Ray Intelligence
            </span>
            <h2 className={styles.docTitle}>{overview.title}</h2>
          </div>

          {onReanalyze && (
            <Button
              size="sm"
              variant="outline"
              onClick={onReanalyze}
              disabled={isReanalyzing}
              isLoading={isReanalyzing}
            >
              Re-Analyze
            </Button>
          )}
        </div>

        <div className={styles.badgeRow}>
          <Badge variant="general">{overview.documentType}</Badge>
          <Badge
            variant={overview.governingLaw.includes('not identified') ? 'review' : 'fact'}
          >
            {overview.governingLaw}
          </Badge>
        </div>

        <div className={styles.summaryBox}>
          <strong>Executive Summary: </strong>
          {overview.summary}
        </div>

        {/* Parties Metadata */}
        {parties.length > 0 && (
          <div className={styles.metaGrid}>
            {parties.map((p) => (
              <div key={p.id} className={styles.metaItem}>
                <span className={styles.metaLabel}>{p.role}</span>
                <span className={styles.metaValue}>{p.name}</span>
                {renderCitationButton(p.pageNumber, p.quotedText, p.isValidated)}
              </div>
            ))}
          </div>
        )}

        {/* Evidence Verification Health Bar */}
        {validationSummary && (
          <div className={styles.validationBar}>
            <span className={styles.verifiedStats}>
              ✓ {validationSummary.validatedCount} of {validationSummary.totalCitations} Citations Verified
            </span>
            {validationSummary.unverifiedCount > 0 && (
              <span style={{ color: '#f87171' }}>
                {validationSummary.unverifiedCount} flagged for attorney review
              </span>
            )}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <nav className={styles.tabBar} aria-label="Analysis Sections">
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'obligations' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('obligations')}
        >
          <span>Obligations</span>
          <span className={styles.tabCountBadge}>{obligations.length}</span>
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'clauses' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('clauses')}
        >
          <span>Clauses</span>
          <span className={styles.tabCountBadge}>{materialClauses.length}</span>
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'attention' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('attention')}
        >
          <span>Attention Areas</span>
          <span className={styles.tabCountBadge}>{attentionAreas.length}</span>
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'dates' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('dates')}
        >
          <span>Key Dates</span>
          <span className={styles.tabCountBadge}>{keyDates.length}</span>
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'rights' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('rights')}
        >
          <span>Rights &amp; Finance</span>
          <span className={styles.tabCountBadge}>{rights.length + financialTerms.length}</span>
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'questions' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('questions')}
        >
          <span>Lawyer Prep</span>
          <span className={styles.tabCountBadge}>{lawyerQuestions.length}</span>
        </button>
      </nav>

      {/* Tab Panels */}
      <div className={styles.sectionContent}>
        {/* 1. Obligations Tab */}
        {activeTab === 'obligations' && (
          <>
            {obligations.length === 0 ? (
              <p className={styles.emptyStateText}>No specific obligations identified.</p>
            ) : (
              obligations.map((ob) => (
                <div key={ob.id} className={styles.findingCard}>
                  <div className={styles.findingHeader}>
                    <div>
                      <span className={styles.findingParty}>{ob.party}</span>
                      <h4 className={styles.findingTitle}>{ob.obligation}</h4>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', alignItems: 'center' }}>
                      {getClassificationBadge(ob.classification)}
                      {getAttentionBadge(ob.attentionLevel)}
                      <button
                        type="button"
                        className={styles.understandConceptBtn}
                        onClick={() => setLegalInfoTopic(ob.obligation)}
                        title="Learn what this concept generally means"
                      >
                        📖 Concept
                      </button>
                    </div>
                  </div>

                  {ob.explanation && (
                    <div className={styles.plainLangBox}>
                      <strong>Plain English: </strong>
                      {ob.explanation}
                    </div>
                  )}

                  {ob.conditionOrDeadline && (
                    <p className={styles.findingBody}>
                      <strong>Condition / Timing: </strong>
                      {ob.conditionOrDeadline}
                    </p>
                  )}

                  {renderCitationButton(ob.pageNumber, ob.quotedText, ob.isValidated, ob.sectionReference)}
                </div>
              ))
            )}
          </>
        )}

        {/* 2. Material Clauses Tab */}
        {activeTab === 'clauses' && (
          <>
            {materialClauses.length === 0 ? (
              <p className={styles.emptyStateText}>No material clauses extracted.</p>
            ) : (
              materialClauses.map((cl) => (
                <div key={cl.id} className={styles.findingCard}>
                  <div className={styles.findingHeader}>
                    <div>
                      <span className={styles.findingParty}>{cl.category}</span>
                      <h4 className={styles.findingTitle}>{cl.title}</h4>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', alignItems: 'center' }}>
                      {getClassificationBadge(cl.classification)}
                      <button
                        type="button"
                        className={styles.understandConceptBtn}
                        onClick={() => setLegalInfoTopic(cl.category || cl.title)}
                        title="Learn what this concept generally means"
                      >
                        📖 Concept
                      </button>
                    </div>
                  </div>

                  {cl.plainLanguage && (
                    <div className={styles.plainLangBox}>
                      <strong>Plain English: </strong>
                      {cl.plainLanguage}
                    </div>
                  )}

                  {cl.summary && (
                    <p className={styles.findingBody}>{cl.summary}</p>
                  )}

                  {renderCitationButton(cl.pageNumber, cl.quotedText, cl.isValidated, cl.sectionReference)}
                </div>
              ))
            )}
          </>
        )}

        {/* 3. Attention Areas Tab */}
        {activeTab === 'attention' && (
          <>
            {attentionAreas.length === 0 ? (
              <p className={styles.emptyStateText}>No specific high-attention provisions identified.</p>
            ) : (
              attentionAreas.map((att) => (
                <div key={att.id} className={styles.findingCard}>
                  <div className={styles.findingHeader}>
                    <div>
                      <span className={styles.findingParty}>{att.category}</span>
                      <h4 className={styles.findingTitle}>{att.title}</h4>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', alignItems: 'center' }}>
                      {getAttentionBadge(att.attentionLevel)}
                      <button
                        type="button"
                        className={styles.understandConceptBtn}
                        onClick={() => setLegalInfoTopic(att.category || att.title)}
                        title="Learn what this concept generally means"
                      >
                        📖 Concept
                      </button>
                    </div>
                  </div>

                  <p className={styles.findingBody}>{att.description}</p>

                  {att.whyItMatters && (
                    <div className={styles.whyItMattersBox}>
                      <strong>Why this may matter: </strong>
                      {att.whyItMatters}
                    </div>
                  )}

                  {renderCitationButton(att.pageNumber, att.quotedText, att.isValidated)}
                </div>
              ))
            )}
          </>
        )}

        {/* 4. Key Dates Tab */}
        {activeTab === 'dates' && (
          <>
            {keyDates.length === 0 ? (
              <p className={styles.emptyStateText}>No specific dates identified in the document.</p>
            ) : (
              keyDates.map((dt) => (
                <div key={dt.id} className={styles.findingCard}>
                  <div className={styles.findingHeader}>
                    <div>
                      <span className={styles.findingParty}>{dt.label}</span>
                      <h4 className={styles.findingTitle}>{dt.dateValue}</h4>
                    </div>
                    {getClassificationBadge(dt.classification)}
                  </div>

                  {dt.description && (
                    <p className={styles.findingBody}>{dt.description}</p>
                  )}

                  {renderCitationButton(dt.pageNumber, dt.quotedText, dt.isValidated)}
                </div>
              ))
            )}
          </>
        )}

        {/* 5. Rights & Financial Terms Tab */}
        {activeTab === 'rights' && (
          <>
            <h4 style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              Stated Rights
            </h4>
            {rights.length === 0 ? (
              <p className={styles.emptyStateText}>No explicit party rights recorded.</p>
            ) : (
              rights.map((rt) => (
                <div key={rt.id} className={styles.findingCard}>
                  <div className={styles.findingHeader}>
                    <span className={styles.findingParty}>{rt.party}</span>
                    {getClassificationBadge(rt.classification)}
                  </div>
                  <p className={styles.findingTitle}>{rt.right}</p>
                  {rt.explanation && (
                    <div className={styles.plainLangBox}>
                      <strong>Plain English: </strong>
                      {rt.explanation}
                    </div>
                  )}
                  {renderCitationButton(rt.pageNumber, rt.quotedText, rt.isValidated)}
                </div>
              ))
            )}

            <h4 style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginTop: 'var(--space-4)' }}>
              Financial Terms
            </h4>
            {financialTerms.length === 0 ? (
              <p className={styles.emptyStateText}>No financial terms identified.</p>
            ) : (
              financialTerms.map((ft) => (
                <div key={ft.id} className={styles.findingCard}>
                  <div className={styles.findingHeader}>
                    <span className={styles.findingParty}>{ft.term}</span>
                    <strong style={{ color: 'var(--color-gold-400)', fontSize: 'var(--font-size-sm)' }}>
                      {ft.amountOrValue}
                    </strong>
                  </div>
                  {ft.explanation && (
                    <p className={styles.findingBody}>{ft.explanation}</p>
                  )}
                  {renderCitationButton(ft.pageNumber, ft.quotedText, ft.isValidated)}
                </div>
              ))
            )}
          </>
        )}

        {/* 6. Questions for a Lawyer Tab */}
        {activeTab === 'questions' && (
          <>
            {lawyerQuestions.length === 0 ? (
              <p className={styles.emptyStateText}>No questions generated.</p>
            ) : (
              lawyerQuestions.map((q) => (
                <div key={q.id} className={styles.findingCard}>
                  <span className={styles.findingParty}>{q.category}</span>
                  <p style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', margin: '4px 0' }}>
                    ❓ &ldquo;{q.question}&rdquo;
                  </p>
                  {q.groundedContext && (
                    <p className={styles.quoteExcerpt}>
                      Focus Area: {q.groundedContext}
                    </p>
                  )}
                </div>
              ))
            )}
          </>
        )}
      </div>

      <LegalInfoModal
        isOpen={!!legalInfoTopic}
        onClose={() => setLegalInfoTopic(null)}
        topic={legalInfoTopic || undefined}
        documentId={documentId}
        onNavigateToDocument={onCitationClick ? (_docId, page) => onCitationClick(page) : undefined}
      />
    </div>
  );
};

