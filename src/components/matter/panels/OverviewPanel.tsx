'use client';

import { LinkButton } from '@/components/ui/Button/LinkButton';
import styles from '../MatterWorkspace.module.css';
import { Button } from '@/components/ui/Button/Button';
import type { MatterWorkspaceModel } from '../useMatterWorkspace';

export function OverviewPanel({ workspace }: { workspace: MatterWorkspaceModel }) {
  const { matter, setActiveTab, actionItems, readiness, activities, openViewer } = workspace;
  if (!matter) return null;

  return (
        <div className={styles.tabPane}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Matter at a glance</h2>
              <span className={styles.dateText}>
                Last updated {new Date(matter.updatedAt).toLocaleDateString()}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              This matter encompasses {matter.documents.length} member document
              {matter.documents.length === 1 ? '' : 's'}. {matter.metrics.analyzedDocuments} of{' '}
              {matter.metrics.totalDocuments} documents have been analyzed with Legal X-Ray. The
              system has identified {matter.metrics.totalRelationships} cross-document references and{' '}
              {matter.metrics.totalInconsistencies} potential inconsistencies across dates, notice
              periods, and contract terms.
            </p>
          </div>

          {/* Objective Matter Readiness States */}
          {readiness && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Ready for review</h2>
                  <div className={styles.sectionSubtitle}>
                    Workflow status classifications based on current evidence without subjective win-rate predictions.
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setActiveTab('actionPlan')}>
                  View Action Plan ({actionItems.filter((i) => i.status !== 'COMPLETED').length} open) →
                </Button>
              </div>

              <div className={styles.readinessBadgeGrid}>
                {readiness.states.map((state) => {
                  let cls = styles.stateBadgeFollowUp;
                  if (state === 'READY_FOR_REVIEW') cls = styles.stateBadgeReady;
                  else if (state === 'ITEMS_TO_VERIFY') cls = styles.stateBadgeVerify;
                  else if (state === 'INFORMATION_GAPS') cls = styles.stateBadgeGaps;
                  else if (state === 'QUESTIONS_FOR_COUNSEL') cls = styles.stateBadgeCounsel;
                  else if (state === 'DOCUMENTS_TO_COLLECT') cls = styles.stateBadgeCollect;

                  return (
                    <span key={state} className={`${styles.stateBadge} ${cls}`}>
                      ● {state.replace(/_/g, ' ')}
                    </span>
                  );
                })}
              </div>

              {readiness.snapshot && (
                <div className={styles.snapshotGrid}>
                  <div className={styles.snapshotCard}>
                    <span className={styles.snapshotNumber}>
                      {readiness.snapshot.analyzedDocuments} / {readiness.snapshot.totalDocuments}
                    </span>
                    <span className={styles.snapshotLabel}>Documents Analyzed</span>
                  </div>
                  <div className={styles.snapshotCard}>
                    <span className={styles.snapshotNumber}>
                      {readiness.snapshot.verifiedRelationships} /{' '}
                      {readiness.snapshot.verifiedRelationships +
                        readiness.snapshot.relationshipsNeedingReview}
                    </span>
                    <span className={styles.snapshotLabel}>Relationships Verified</span>
                  </div>
                  <div className={styles.snapshotCard}>
                    <span
                      className={styles.snapshotNumber}
                      style={{
                        color:
                          readiness.snapshot.consistencyFindings > 0 ? '#fbbf24' : '#34d399',
                      }}
                    >
                      {readiness.snapshot.consistencyFindings}
                    </span>
                    <span className={styles.snapshotLabel}>Consistency Discrepancies</span>
                  </div>
                  <div className={styles.snapshotCard}>
                    <span
                      className={styles.snapshotNumber}
                      style={{
                        color: readiness.snapshot.openActionItems > 0 ? '#60a5fa' : '#34d399',
                      }}
                    >
                      {readiness.snapshot.openActionItems}
                    </span>
                    <span className={styles.snapshotLabel}>Open Action Items</span>
                  </div>
                  <div className={styles.snapshotCard}>
                    <span className={styles.snapshotNumber}>
                      {readiness.snapshot.counselQuestions}
                    </span>
                    <span className={styles.snapshotLabel}>Counsel Questions</span>
                  </div>
                  <div className={styles.snapshotCard}>
                    <span className={styles.snapshotNumber}>
                      {readiness.snapshot.timelineEvents}
                    </span>
                    <span className={styles.snapshotLabel}>Timeline Milestones</span>
                  </div>
                </div>
              )}

              {readiness.recommendations && readiness.recommendations.length > 0 && (
                <div className={styles.recommendationsBox}>
                  <div className={styles.recommendationsTitle}>
                    ⚡ Recommended Next Preparation Steps
                  </div>
                  <ul className={styles.recommendationsList}>
                    {readiness.recommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Recent Activity Audit Trail */}
          {activities.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Recent activity</h2>
                  <div className={styles.sectionSubtitle}>
                    Append-only audit history of document and matter operations.
                  </div>
                </div>
              </div>

              <div className={styles.activityFeed}>
                {activities.slice(0, 6).map((act) => (
                  <div key={act.id} className={styles.activityCard}>
                    <div className={styles.activityDot} />
                    <div className={styles.activityBody}>
                      <p className={styles.activityText}>{act.description}</p>
                      <span className={styles.activityDate}>
                        {new Date(act.createdAt).toLocaleString()} · {act.actionType.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Member Documents Summary</h2>
              <Button size="sm" variant="secondary" onClick={() => setActiveTab('documents')}>
                Manage Documents →
              </Button>
            </div>
            <div className={styles.docGrid}>
              {matter.documents.map((doc) => (
                <div key={doc.id} className={styles.docItem}>
                  <div>
                    <div className={styles.docItemHeader}>
                      <h3 className={styles.docItemTitle}>{doc.title}</h3>
                      <span className={styles.roleBadge}>{doc.role.replace(/_/g, ' ')}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.4rem 0 0 0' }}>
                      {doc.pageCount || 1} page{doc.pageCount === 1 ? '' : 's'} · Status: {doc.status}
                    </p>
                  </div>
                  <div className={styles.docActions}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openViewer(doc.documentId, doc.title, 1)}
                    >
                      View
                    </Button>
                    {doc.status === 'READY' ? (
                      <LinkButton href={`/analyze/${doc.documentId}`} size="sm" variant="primary">Legal X-Ray</LinkButton>
                    ) : (
                      <LinkButton href={`/analyze/${doc.documentId}`} size="sm" variant="secondary">Analyze</LinkButton>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
}
