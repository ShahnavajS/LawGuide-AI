'use client';

import styles from '../MatterWorkspace.module.css';
import { Button } from '@/components/ui/Button/Button';
import type { MatterWorkspaceModel } from '../useMatterWorkspace';

export function RelationshipsPanel({ workspace }: { workspace: MatterWorkspaceModel }) {
  const { relationships, isRefreshingRels, openViewer, handleUpdateRelationshipStatus, handleRefreshRelationships } = workspace;
  return (
        <div className={styles.tabPane}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Cross-Document Relationships</h2>
                <div className={styles.sectionSubtitle}>
                  Explicit references, amendments, and attachments between member documents.
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={isRefreshingRels}
                onClick={handleRefreshRelationships}
              >
                {isRefreshingRels ? 'Refreshing...' : '🔄 Refresh Relationships'}
              </Button>
            </div>

            {relationships.length === 0 ? (
              <div className={styles.emptyState}>
                No cross-document references identified yet. Click &quot;Refresh Relationships&quot; to scan
                member documents.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {relationships.map((rel) => (
                  <div key={rel.id} className={styles.relCard}>
                    <div className={styles.relFlow}>
                      <span style={{ color: '#38bdf8' }}>{rel.sourceDocumentTitle}</span>
                      <span className={styles.relTypeBadge}>{rel.relationshipType}</span>
                      <span style={{ color: '#a78bfa' }}>{rel.targetDocumentTitle}</span>

                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: rel.status === 'CONFIRMED' ? '#10b981' : '#f59e0b',
                        }}
                      >
                        {rel.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{rel.description}</div>

                    {rel.sourceQuote && (
                      <div
                        className={styles.evidenceBlock}
                        style={{ cursor: 'pointer' }}
                        onClick={() =>
                          openViewer(
                            rel.sourceDocumentId,
                            rel.sourceDocumentTitle || 'Document',
                            rel.sourcePage || 1
                          )
                        }
                      >
                        <strong>Source Evidence (Page {rel.sourcePage}):</strong> {`"${rel.sourceQuote}"`}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      {rel.status !== 'CONFIRMED' && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleUpdateRelationshipStatus(rel.id, 'CONFIRMED')}
                        >
                          Confirm
                        </Button>
                      )}
                      {rel.status !== 'REJECTED' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          style={{ color: '#ef4444' }}
                          onClick={() => handleUpdateRelationshipStatus(rel.id, 'REJECTED')}
                        >
                          Reject
                        </Button>
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
