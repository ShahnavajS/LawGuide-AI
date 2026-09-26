'use client';

import styles from '../MatterWorkspace.module.css';
import { Button } from '@/components/ui/Button/Button';
import type { MatterWorkspaceModel } from '../useMatterWorkspace';

export function AskPanel({ workspace }: { workspace: MatterWorkspaceModel }) {
  const { matter, setActiveTab, qaQuestion, setQaQuestion, qaResponse, isAsking, openViewer, handleAsk } = workspace;
  if (!matter) return null;

  return (
        <div className={styles.tabPane}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Ask My Matter</h2>
                <div className={styles.sectionSubtitle}>
                  Ask natural-language questions synthesized across all member documents with verified
                  citations.
                </div>
              </div>
            </div>

            <div className={styles.qaContainer}>
              <div className={styles.quickPrompts}>
                {[
                  'What notice periods appear in my documents?',
                  'What termination provisions are mentioned?',
                  'Which documents mention confidentiality?',
                  'What dates are explicitly stated?',
                  'Which documents refer to another agreement?',
                ].map((promptText, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={styles.promptChip}
                    onClick={() => {
                      setQaQuestion(promptText);
                      handleAsk(promptText);
                    }}
                  >
                    {promptText}
                  </button>
                ))}
              </div>

              <div className={styles.searchBar}>
                <input
                  type="text"
                  value={qaQuestion}
                  onChange={(e) => setQaQuestion(e.target.value)}
                  placeholder="Ask a question across all documents in this matter..."
                  className={styles.searchInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAsk();
                    }
                  }}
                />
                <Button variant="primary" disabled={isAsking || !qaQuestion.trim()} onClick={() => handleAsk()}>
                  {isAsking ? 'Analyzing...' : 'Ask Matter'}
                </Button>
              </div>

              {qaResponse && (
                <div className={styles.qaResponseCard}>
                  <div className={styles.answerText}>{qaResponse.answer}</div>

                  {qaResponse.citations.length > 0 && (
                    <div>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: 'var(--text-muted)',
                          marginBottom: '0.4rem',
                        }}
                      >
                        Document Sources
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {qaResponse.citations.map((c, i) => (
                          <div
                            key={i}
                            className={styles.evidenceBlock}
                            style={{ cursor: 'pointer' }}
                            onClick={() => openViewer(c.documentId, c.documentTitle, c.pageNumber)}
                          >
                            <strong>
                              {c.documentTitle} (Page {c.pageNumber}):
                            </strong>{' '}
                            {`"${c.quotedText}"`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {qaResponse.relatedPreparationItems && qaResponse.relatedPreparationItems.length > 0 && (
                    <div className={styles.relatedPrepContainer}>
                      <div className={styles.relatedPrepLabel}>Related Action Items</div>
                      <div className={styles.relatedPrepChips}>
                        {qaResponse.relatedPreparationItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={styles.relatedPrepChip}
                            onClick={() => setActiveTab('actionPlan')}
                            title="Click to view Action Plan"
                          >
                            <span>📋 {item.title}</span>
                            <span
                              className={
                                item.priority === 'HIGH'
                                  ? styles.priorityPillHigh
                                  : item.priority === 'MEDIUM'
                                  ? styles.priorityPillMedium
                                  : styles.priorityPillLow
                              }
                            >
                              {item.priority}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {qaResponse.suggestedQuestionsForCounsel.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: 'var(--color-gold, #c8a256)',
                          marginBottom: '0.4rem',
                        }}
                      >
                        Suggested Questions For Counsel
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
                        {qaResponse.suggestedQuestionsForCounsel.map((sq, i) => (
                          <li key={i} style={{ fontSize: '0.88rem', marginBottom: '0.25rem' }}>
                            {sq}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
}
