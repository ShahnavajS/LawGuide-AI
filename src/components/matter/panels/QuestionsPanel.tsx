'use client';

import { LinkButton } from '@/components/ui/Button/LinkButton';
import styles from '../MatterWorkspace.module.css';
import { Button } from '@/components/ui/Button/Button';
import type { MatterWorkspaceModel } from '../useMatterWorkspace';

export function QuestionsPanel({ workspace }: { workspace: MatterWorkspaceModel }) {
  const {
    matter, copiedQuestionId, counselQuestions, isGeneratingCounselQuestions,
    handleGenerateCounselQuestions, handleConvertQuestionToAction,
    handleCopyQuestion, openViewer,
  } = workspace;
  if (!matter) return null;

  return (
        <div className={styles.tabPane}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Unified Questions for Legal Counsel</h2>
                <div className={styles.sectionSubtitle}>
                  Aggregated and deduplicated discussion points prepared from document analyses and
                  consistency checks.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleGenerateCounselQuestions}
                  disabled={isGeneratingCounselQuestions}
                >
                  {isGeneratingCounselQuestions ? 'Generating...' : '⚡ Refresh Questions'}
                </Button>
                <LinkButton href={`/prepare?matterId=${matter.id}`} size="sm" variant="primary">Export Consultation Brief →</LinkButton>
              </div>
            </div>

            {counselQuestions.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No questions generated yet.</p>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleGenerateCounselQuestions}
                  disabled={isGeneratingCounselQuestions}
                >
                  {isGeneratingCounselQuestions ? 'Generating...' : '⚡ Generate Counsel Questions'}
                </Button>
              </div>
            ) : (
              <div className={styles.counselQuestionsList}>
                {counselQuestions.map((q) => (
                  <div key={q.id} className={styles.counselQuestionCard}>
                    <div className={styles.counselQuestionHeader}>
                      <span className={styles.counselCategoryBadge}>{q.category}</span>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <Button
                          size="sm"
                          variant="ghost"
                          style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}
                          onClick={() => handleCopyQuestion(q)}
                        >
                          {copiedQuestionId === q.id ? '✓ Copied' : '📋 Copy Question'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          style={{ color: 'var(--color-gold, #c8a256)', fontSize: '0.75rem' }}
                          onClick={() => handleConvertQuestionToAction(q)}
                        >
                          + Add to Action Plan
                        </Button>
                      </div>
                    </div>

                    <h3 className={styles.counselQuestionText}>{q.question}</h3>

                    <div className={styles.counselRationaleBox}>
                      <strong>Rationale:</strong> {q.rationale}
                    </div>

                    <div className={styles.counselCitationRow}>
                      <span>
                        {q.sourceReference && <span>Source: {q.sourceReference}</span>}
                      </span>
                      {q.documentId && (
                        <button
                          type="button"
                          className={styles.jumpButton}
                          onClick={() => {
                            const d = matter.documents.find((doc) => doc.documentId === q.documentId);
                            openViewer(q.documentId!, d?.title || 'Document', q.pageNumber || 1);
                          }}
                        >
                          📄 View Document Page {q.pageNumber || 1} →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
}
