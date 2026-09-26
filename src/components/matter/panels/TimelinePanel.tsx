'use client';

import styles from '../MatterWorkspace.module.css';
import type { MatterWorkspaceModel } from '../useMatterWorkspace';

export function TimelinePanel({ workspace }: { workspace: MatterWorkspaceModel }) {
  const { timeline, openViewer } = workspace;
  return (
        <div className={styles.tabPane}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Document-Derived Timeline</h2>
                <div className={styles.sectionSubtitle}>
                  Chronological dates extracted strictly from document text. Never inferred from upload
                  timestamps.
                </div>
              </div>
            </div>

            {timeline.length === 0 ? (
              <div className={styles.emptyState}>
                <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>⏱️</div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.35rem' }}>
                  No dated events found
                </h3>
                <p style={{ maxWidth: '520px', margin: '0 auto', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  This occurs when member documents do not contain explicit, verifiable calendar dates or when documents have not yet completed Legal X-Ray analysis. LawGuide strictly derives timeline milestones from document text and never infers or estimates dates.
                </p>
              </div>
            ) : (
              <div className={styles.timelineList}>
                {timeline.map((event) => (
                  <div key={event.id} className={styles.timelineEvent}>
                    <div className={styles.timelineDot} />
                    <div className={styles.timelineDate}>
                      {event.isEstablished ? event.dateValue : '⚠️ DATE NOT ESTABLISHED'}
                    </div>
                    <div className={styles.timelineLabel}>{event.label}</div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{event.description}</div>

                    <div
                      className={styles.timelineDocTag}
                      onClick={() =>
                        openViewer(event.documentId, event.documentTitle, event.pageNumber || 1)
                      }
                    >
                      📄 {event.documentTitle} {event.pageNumber ? `· Page ${event.pageNumber}` : ''}
                    </div>

                    {event.quotedText && (
                      <div className={styles.evidenceBlock}>&quot;{event.quotedText}&quot;</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
}
