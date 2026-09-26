'use client';

import styles from '../MatterWorkspace.module.css';
import { Button } from '@/components/ui/Button/Button';
import type { MatterWorkspaceModel } from '../useMatterWorkspace';

export function ConsistencyPanel({ workspace }: { workspace: MatterWorkspaceModel }) {
  const { consistency, setConceptModalTopic, openViewer } = workspace;
  return (
        <div className={styles.tabPane}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Multi-Document Consistency Check</h2>
                <div className={styles.sectionSubtitle}>
                  Identifies apparent discrepancies across dates, notice periods, and fees. Never
                  determines which contract controls.
                </div>
              </div>
            </div>

            {consistency.length === 0 ? (
              <div className={styles.emptyState}>
                No apparent discrepancies detected across analyzed member documents.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {consistency.map((item) => (
                  <div key={item.id} className={styles.inconsistencyCard}>
                    <div className={styles.inconsistencyHeader}>
                      <span className={styles.inconsistencyCategory}>{item.category}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        style={{ color: 'var(--color-gold, #c8a256)', fontSize: '0.78rem' }}
                        onClick={() => setConceptModalTopic(item.category)}
                      >
                        📖 Explore Concept
                      </Button>
                    </div>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                      {item.title}
                    </h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                      {item.description}
                    </p>

                    <div className={styles.comparisonSources}>
                      <div className={styles.sourceSide}>
                        <span className={styles.sourceTitle}>{item.sourceA.documentTitle}</span>
                        <span className={styles.sourceValue}>{item.sourceA.value}</span>
                        {item.sourceA.quotedText && (
                          <div
                            className={styles.evidenceBlock}
                            style={{ cursor: 'pointer' }}
                            onClick={() =>
                              openViewer(
                                item.sourceA.documentId,
                                item.sourceA.documentTitle,
                                item.sourceA.pageNumber || 1
                              )
                            }
                          >
                            Page {item.sourceA.pageNumber}: {`"${item.sourceA.quotedText}"`}
                          </div>
                        )}
                      </div>

                      <div className={styles.sourceSide}>
                        <span className={styles.sourceTitle}>{item.sourceB.documentTitle}</span>
                        <span className={styles.sourceValue}>{item.sourceB.value}</span>
                        {item.sourceB.quotedText && (
                          <div
                            className={styles.evidenceBlock}
                            style={{ cursor: 'pointer' }}
                            onClick={() =>
                              openViewer(
                                item.sourceB.documentId,
                                item.sourceB.documentTitle,
                                item.sourceB.pageNumber || 1
                              )
                            }
                          >
                            Page {item.sourceB.pageNumber}: {`"${item.sourceB.quotedText}"`}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.discussionPrompt}>
                      <strong>Counsel Discussion Point:</strong> {item.discussionPoint}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
}
