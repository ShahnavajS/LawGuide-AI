'use client';

import styles from '../MatterWorkspace.module.css';
import { Button } from '@/components/ui/Button/Button';
import type { MatterWorkspaceModel } from '../useMatterWorkspace';

export function PreparePanel({ workspace }: { workspace: MatterWorkspaceModel }) {
  const { matter, matterBrief, isGeneratingBrief, handleGenerateMatterBrief } = workspace;
  if (!matter) return null;

  return (
        <div className={styles.tabPane}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Lawyer Consultation Dossier</h2>
                <div className={styles.sectionSubtitle}>
                  Synthesized multi-document matter brief, member documents, consistency findings,
                  neutral counsel questions, and actionable preparation checklist.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleGenerateMatterBrief(true)}
                  disabled={isGeneratingBrief}
                >
                  {isGeneratingBrief ? 'Synthesizing...' : '🔄 Regenerate Brief'}
                </Button>
                {matterBrief && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => window.print()}
                  >
                    🖨️ Print / Save PDF
                  </Button>
                )}
              </div>
            </div>

            {!matterBrief ? (
              <div className={styles.emptyState}>
                <p>
                  Generate a structured consultation brief synthesizing all {matter.documents.length} member
                  documents, key consistency findings, counsel questions, and action items.
                </p>
                <Button
                  size="lg"
                  variant="primary"
                  onClick={() => handleGenerateMatterBrief(false)}
                  disabled={isGeneratingBrief}
                >
                  {isGeneratingBrief ? 'Synthesizing Dossier...' : '⚡ Generate Consultation Dossier'}
                </Button>
              </div>
            ) : (
              <div className={styles.briefDossier}>
                <div className={styles.briefHeader}>
                  <div>
                    <h2 className={styles.briefTitle}>{matterBrief.title}</h2>
                    <p className={styles.briefSummaryText}>{matterBrief.summary}</p>
                    {matterBrief.parties.length > 0 && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Identified Parties: {matterBrief.parties.join(', ')}
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.briefSection}>
                  <h3 className={styles.briefSectionTitle}>Member Documents Summary</h3>
                  <div className={styles.docGrid}>
                    {matterBrief.documents.map((d) => (
                      <div key={d.id} className={styles.docItem}>
                        <div>
                          <div className={styles.docItemHeader}>
                            <h4 className={styles.docItemTitle}>{d.title}</h4>
                            <span className={styles.roleBadge}>{d.role.replace(/_/g, ' ')}</span>
                          </div>
                          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.4rem 0 0 0' }}>
                            Status: {d.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {matterBrief.keyFactualPoints && matterBrief.keyFactualPoints.length > 0 && (
                  <div className={styles.briefSection}>
                    <h3 className={styles.briefSectionTitle}>Key Document Facts & Source Provenance</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {matterBrief.keyFactualPoints.map((pt, idx) => (
                        <div key={idx} className={styles.evidenceBlock}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '0.4rem',
                            }}
                          >
                            <span>• {pt.fact}</span>
                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                              <span className={styles.provenanceTag}>
                                {pt.docTitle || 'Document'}
                                {pt.page ? ` (p.${pt.page})` : ''} · {pt.classification}
                              </span>
                              {pt.classification !== 'DOCUMENT_FACT' || pt.verificationStatus !== 'VERIFIED' ? (
                                <span className={styles.verificationBadgeUnverified}>
                                  NEEDS REVIEW
                                </span>
                              ) : (
                                <span className={styles.verificationBadgeVerified}>
                                  SOURCE VERIFIED
                                </span>
                              )}
                            </div>
                          </div>
                          {pt.quotedText && <blockquote>{pt.quotedText}</blockquote>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {matterBrief.consistencySummary.length > 0 && (
                  <div className={styles.briefSection}>
                    <h3 className={styles.briefSectionTitle}>Key Discrepancies to Reconcile</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {matterBrief.consistencySummary.map((item, idx) => (
                        <div key={idx} className={styles.evidenceBlock}>
                          <strong>[{item.category}]</strong> {item.finding} — {item.discussionPoint}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {matterBrief.counselQuestions.length > 0 && (
                  <div className={styles.briefSection}>
                    <h3 className={styles.briefSectionTitle}>Recommended Questions for Counsel</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {matterBrief.counselQuestions.map((cq) => (
                        <div key={cq.id} className={styles.counselQuestionCard} style={{ padding: '1rem' }}>
                          <span className={styles.counselCategoryBadge}>{cq.category}</span>
                          <div style={{ fontWeight: 700, color: '#ffffff', marginTop: '0.35rem' }}>
                            {cq.question}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            Rationale: {cq.rationale}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {matterBrief.actionItems.length > 0 && (
                  <div className={styles.briefSection}>
                    <h3 className={styles.briefSectionTitle}>Preparation Action Checklist</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {matterBrief.actionItems.map((ac) => (
                        <div key={ac.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                          <span style={{ color: 'var(--color-gold, #c8a256)' }}>
                            {ac.status === 'COMPLETED' ? '☑' : '☐'}
                          </span>
                          <span>{ac.title} ({ac.priority})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
}
