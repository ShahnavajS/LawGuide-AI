'use client';

import { LinkButton } from '@/components/ui/Button/LinkButton';
import styles from '../MatterWorkspace.module.css';
import { Button } from '@/components/ui/Button/Button';
import type { MatterWorkspaceModel } from '../useMatterWorkspace';

export function DocumentsPanel({ workspace }: { workspace: MatterWorkspaceModel }) {
  const { matter, openViewer, handleOpenAddDocModal, handleRemoveDocument } = workspace;
  if (!matter) return null;

  return (
        <div className={styles.tabPane}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Matter Member Documents</h2>
                <div className={styles.sectionSubtitle}>
                  Legal documents referenced by ID without duplication. Removing a document here does
                  NOT delete the underlying PDF.
                </div>
              </div>
              <Button variant="primary" size="sm" onClick={handleOpenAddDocModal}>
                + Add Document
              </Button>
            </div>

            {matter.documents.length === 0 ? (
              <div className={styles.emptyState}>No documents in this matter yet.</div>
            ) : (
              <div className={styles.docGrid}>
                {matter.documents.map((doc) => (
                  <div key={doc.id} className={styles.docItem}>
                    <div>
                      <div className={styles.docItemHeader}>
                        <h3 className={styles.docItemTitle}>{doc.title}</h3>
                        <span className={styles.roleBadge}>{doc.role.replace(/_/g, ' ')}</span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.4rem 0 0.75rem 0' }}>
                        Filename: {doc.originalFilename} · {doc.pageCount || 1} pages
                      </p>

                      {doc.roleSuggestion && !doc.roleConfirmed && (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <span className={styles.suggestionPill}>
                            AI suggestion: {doc.roleSuggestion}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className={styles.docActions}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openViewer(doc.documentId, doc.title, 1)}
                      >
                        Open Viewer
                      </Button>

                      {doc.status === 'READY' && (
                        <LinkButton href={`/analyze/${doc.documentId}`} size="sm" variant="secondary">X-Ray</LinkButton>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        style={{ color: '#ef4444' }}
                        onClick={() => handleRemoveDocument(doc.documentId, doc.title)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
}
