'use client';

import styles from '../MatterWorkspace.module.css';
import { Button } from '@/components/ui/Button/Button';
import type { MatterWorkspaceModel } from '../useMatterWorkspace';

export function ActionPlanPanel({ workspace }: { workspace: MatterWorkspaceModel }) {
  const {
    matter, actionItems,
    actionFilterStatus, setActionFilterStatus,
    actionFilterPriority, setActionFilterPriority,
    isGeneratingActions, setIsAddActionModalOpen,
    handleToggleActionItemStatus, handleDeleteActionItem,
    handleGenerateActionItems, openViewer,
  } = workspace;
  if (!matter) return null;

  return (
        <div className={styles.tabPane}>
          <div className={styles.card}>
            <div className={styles.actionPlanHeader}>
              <div>
                <h2 className={styles.cardTitle}>Action Plan & Matter Copilot</h2>
                <div className={styles.sectionSubtitle}>
                  Structured preparation checklist synthesized from cross-document consistency findings,
                  unverified relationships, and document review areas.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleGenerateActionItems}
                  disabled={isGeneratingActions}
                >
                  {isGeneratingActions ? 'Scanning Matter...' : '⚡ Generate Action Items'}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsAddActionModalOpen(true)}
                >
                  + Add Action Item
                </Button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className={styles.filterRow}>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                Status:
              </span>
              {['ALL', 'OPEN', 'COMPLETED'].map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`${styles.filterPill} ${
                    actionFilterStatus === st ? styles.filterPillActive : ''
                  }`}
                  onClick={() => setActionFilterStatus(st)}
                >
                  {st}
                </button>
              ))}

              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginLeft: '0.75rem',
                }}
              >
                Priority:
              </span>
              {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((pr) => (
                <button
                  key={pr}
                  type="button"
                  className={`${styles.filterPill} ${
                    actionFilterPriority === pr ? styles.filterPillActive : ''
                  }`}
                  onClick={() => setActionFilterPriority(pr)}
                >
                  {pr}
                </button>
              ))}
            </div>

            {/* Action Items List */}
            {actionItems.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No action items in this matter yet.</p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleGenerateActionItems}
                  disabled={isGeneratingActions}
                >
                  {isGeneratingActions ? 'Scanning Matter...' : '⚡ Scan & Generate Preparation Tasks'}
                </Button>
              </div>
            ) : (
              <div className={styles.actionItemsList}>
                {actionItems
                  .filter((item) => {
                    if (actionFilterStatus !== 'ALL' && item.status !== actionFilterStatus)
                      return false;
                    if (actionFilterPriority !== 'ALL' && item.priority !== actionFilterPriority)
                      return false;
                    return true;
                  })
                  .map((item) => {
                    const isCompleted = item.status === 'COMPLETED';
                    const relatedDoc = matter.documents.find(
                      (d) => d.documentId === item.relatedDocumentId
                    );

                    return (
                      <div
                        key={item.id}
                        className={`${styles.actionItemCard} ${
                          isCompleted ? styles.actionItemCompleted : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isCompleted}
                          onChange={() => handleToggleActionItemStatus(item)}
                          className={styles.actionItemCheck}
                          aria-label={`Mark "${item.title}" complete`}
                        />

                        <div className={styles.actionItemBody}>
                          <div className={styles.actionItemTitleRow}>
                            <h4
                              className={`${styles.actionItemTitle} ${
                                isCompleted ? styles.actionItemTitleCompleted : ''
                              }`}
                            >
                              {item.title}
                            </h4>

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

                            <span className={styles.provenancePill}>
                              {item.type.replace(/_/g, ' ')}
                            </span>

                            {item.sourceReference && (
                              <span className={styles.datePill}>{item.sourceReference}</span>
                            )}
                          </div>

                          <p className={styles.actionItemDesc}>{item.description}</p>

                          <div className={styles.metaRow}>
                            {item.whyThisExists && (
                              <span className={styles.whyExistsBadge}>
                                💡 {item.whyThisExists}
                              </span>
                            )}

                            {item.isUserCreated && (
                              <span
                                className={styles.provenancePill}
                                style={{ background: 'rgba(255, 255, 255, 0.06)' }}
                              >
                                👤 User Created
                              </span>
                            )}

                            {item.dueDate && (
                              <span className={styles.datePill}>
                                📅 Due: {item.dueDate} (
                                {item.dueDateProvenance || 'DOCUMENT_STATED'})
                              </span>
                            )}

                            {relatedDoc && (
                              <button
                                type="button"
                                className={styles.jumpButton}
                                onClick={() =>
                                  openViewer(relatedDoc.documentId, relatedDoc.title, 1)
                                }
                              >
                                📄 View Evidence in {relatedDoc.title} →
                              </button>
                            )}

                            <span style={{ marginLeft: 'auto' }}>
                              <button
                                type="button"
                                className={styles.deleteItemBtn}
                                onClick={() => handleDeleteActionItem(item.id)}
                                title="Delete action item"
                              >
                                🗑️ Delete
                              </button>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      );
}
