'use client';

import { LinkButton } from '@/components/ui/Button/LinkButton';

import React from 'react';
import Link from 'next/link';
import styles from './MatterWorkspace.module.css';
import { Button } from '@/components/ui/Button/Button';
import { Spinner } from '@/components/ui/Spinner/Spinner';
import { DocumentViewer } from '@/components/document/DocumentViewer';
import { LegalInfoModal } from '@/components/legal-info/LegalInfoModal';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import { Modal } from '@/components/ui/Modal/Modal';
import { MatterTabs, MATTER_TAB_TITLES } from './MatterTabs';
import { useMatterWorkspace } from './useMatterWorkspace';
import { OverviewPanel } from './panels/OverviewPanel';
import { ActionPlanPanel } from './panels/ActionPlanPanel';
import { SourceMapPanel } from './panels/SourceMapPanel';
import { DocumentsPanel } from './panels/DocumentsPanel';
import { TimelinePanel } from './panels/TimelinePanel';
import { RelationshipsPanel } from './panels/RelationshipsPanel';
import { ConsistencyPanel } from './panels/ConsistencyPanel';
import { SearchPanel } from './panels/SearchPanel';
import { AskPanel } from './panels/AskPanel';
import { AttentionPanel } from './panels/AttentionPanel';
import { QuestionsPanel } from './panels/QuestionsPanel';
import { PreparePanel } from './panels/PreparePanel';
import { NotesPanel } from './panels/NotesPanel';
import {
  MatterDocumentRole,
  MATTER_DOCUMENT_ROLES,
  ActionItemPriority,
  ActionItemType,
  ACTION_ITEM_TYPES,
  ACTION_ITEM_PRIORITIES,
} from '@/lib/ai/safety';

interface MatterWorkspaceProps {
  matterId: string;
}

export const MatterWorkspace: React.FC<MatterWorkspaceProps> = ({ matterId }) => {
  const workspace = useMatterWorkspace(matterId);
  const {
    matter, loading, error, tabError, setTabError, setTabRetry,
    activeTab, setActiveTab, actionItems, counselQuestions, sourceMapData,
    isAddActionModalOpen, setIsAddActionModalOpen,
    newActionTitle, setNewActionTitle, newActionDesc, setNewActionDesc,
    newActionType, setNewActionType, newActionPriority, setNewActionPriority,
    isAddingAction, handleCreateActionItem,
    isAddDocModalOpen, setIsAddDocModalOpen, allAvailableDocs,
    selectedDocId, setSelectedDocId, selectedRole, setSelectedRole,
    isAddingDoc, handleOpenAddDocModal, handleAddDocument,
    viewerDocId, viewerDocTitle, viewerPage, closeViewer,
    conceptModalTopic, setConceptModalTopic,
  } = workspace;

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Loading matter workspace"
        style={{ display: 'flex', justifyContent: 'center', padding: '6rem 0' }}
      >
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !matter) {
    return (
      <div className={styles.workspaceContainer}>
        <div className={styles.emptyState}>
          <h2>Matter Not Found</h2>
          <p>{error || 'The requested legal matter does not exist.'}</p>
          <LinkButton href="/matters" variant="primary">Return to Matters</LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.workspaceContainer}>
      {/* Top Header Bar */}
      <header className={styles.headerBar}>
        <div style={{ marginBottom: '0.85rem' }}>
          <Breadcrumb
            items={[
              { label: 'Home', href: '/' },
              { label: 'Matters', href: '/matters' },
              { label: matter.title },
              ...(activeTab !== 'overview' ? [{ label: MATTER_TAB_TITLES[activeTab] }] : []),
            ]}
          />
        </div>
        <div className={styles.topRow}>
          <div className={styles.titleArea}>
            <Link href="/matters" className={styles.backLink}>
              ← All Matters
            </Link>
            <h1 className={styles.matterTitle}>{matter.title}</h1>
            <p className={styles.matterDescription}>
              {matter.description || 'No description provided for this legal matter.'}
            </p>
          </div>

          <div className={styles.headerActions}>
            <span
              className={`${styles.jurisdictionBadge} ${
                matter.jurisdictionProvenance === 'NOT_ESTABLISHED'
                  ? styles.jurisdictionNotEstablished
                  : ''
              }`}
            >
              🏛️ {matter.jurisdiction || 'Jurisdiction: Not Established'}
            </span>

            <Button size="sm" variant="secondary" onClick={handleOpenAddDocModal}>
              + Add Document
            </Button>

            <LinkButton href={`/prepare?matterId=${matter.id}`} size="sm" variant="primary">💼 Prepare for Counsel</LinkButton>
          </div>
        </div>

        {/* Real Metrics Row */}
        <div className={styles.metricsRow}>
          <div className={styles.metricBox}>
            <span className={styles.metricLabel}>Documents</span>
            <span className={styles.metricValue}>
              {matter.metrics.analyzedDocuments} / {matter.metrics.totalDocuments}
            </span>
          </div>
          <div className={styles.metricBox}>
            <span className={styles.metricLabel}>Comparisons</span>
            <span className={styles.metricValue}>{matter.metrics.totalComparisons}</span>
          </div>
          <div className={styles.metricBox}>
            <span className={styles.metricLabel}>Relationships</span>
            <span className={styles.metricValue}>
              {matter.metrics.verifiedRelationships} / {matter.metrics.totalRelationships}
            </span>
          </div>
          <div className={styles.metricBox}>
            <span className={styles.metricLabel}>Attention Areas</span>
            <span className={`${styles.metricValue} ${styles.metricValueHighlight}`}>
              {matter.metrics.openAttentionAreas}
            </span>
          </div>
          <div className={styles.metricBox}>
            <span className={styles.metricLabel}>Inconsistencies</span>
            <span className={styles.metricValue}>{matter.metrics.totalInconsistencies}</span>
          </div>
          <div className={styles.metricBox}>
            <span className={styles.metricLabel}>Readiness</span>
            <div className={styles.readinessBarContainer}>
              <div
                className={styles.readinessBar}
                role="progressbar"
                aria-label="Matter preparation readiness"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={matter.metrics.preparationReadyScore}
              >
                <div
                  className={styles.readinessFill}
                  style={{ width: `${matter.metrics.preparationReadyScore}%` }}
                />
              </div>
              <span className={styles.metricValue} style={{ fontSize: '0.95rem' }}>
                {matter.metrics.preparationReadyScore}%
              </span>
            </div>
          </div>
        </div>
      </header>

      <MatterTabs
        activeTab={activeTab}
        onSelect={(tab) => {
          setTabError(null);
          setActiveTab(tab);
        }}
        counts={{
          actionPlan: actionItems.filter((item) => item.status !== 'COMPLETED').length,
          sourceMap: sourceMapData?.coverage.totalEvidenceItems,
          documents: matter.documents.length,
          relationships: matter.metrics.totalRelationships,
          consistency: matter.metrics.totalInconsistencies,
          attention: matter.metrics.openAttentionAreas,
          questions: counselQuestions.length || matter.metrics.totalLawyerQuestions,
        }}
      />
      {tabError && (
        <div className={styles.tabError} role="alert">
          <span>{tabError}</span>
          <button type="button" onClick={() => {
            setTabError(null);
            setTabRetry((value) => value + 1);
          }}>Retry</button>
        </div>
      )}

      <section
        id={`matter-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`matter-tab-${activeTab}`}
        tabIndex={0}
      >

      {/* Tab 1: Overview */}
      {<OverviewPanel workspace={workspace} />}

      {/* Tab 2: Action Plan & Matter Copilot */}
      {<ActionPlanPanel workspace={workspace} />}

      {/* Tab: Source Map & Evidence Intelligence */}
      {<SourceMapPanel workspace={workspace} />}

      {/* Tab 3: Documents */}
      {<DocumentsPanel workspace={workspace} />}

      {/* Tab 3: Timeline */}
      {<TimelinePanel workspace={workspace} />}

      {/* Tab 4: Relationships */}
      {<RelationshipsPanel workspace={workspace} />}

      {/* Tab 5: Consistency Check */}
      {<ConsistencyPanel workspace={workspace} />}

      {/* Tab 6: Search */}
      {<SearchPanel workspace={workspace} />}

      {/* Tab 7: Ask My Matter */}
      {<AskPanel workspace={workspace} />}

      {/* Tab 8: Attention Areas */}
      {<AttentionPanel workspace={workspace} />}

      {/* Tab 9: Questions for Counsel */}
      {<QuestionsPanel workspace={workspace} />}

      {/* Tab 10: Prepare Dossier */}
      {<PreparePanel workspace={workspace} />}

      {/* Tab 11: Notes */}
      {<NotesPanel workspace={workspace} />}
      </section>

      {/* Side Slide-Over Document Viewer Drawer */}
      {viewerDocId && (
        <aside
          className={styles.viewerDrawer}
          role="dialog"
          aria-modal="false"
          aria-labelledby="matter-document-viewer-title"
          onKeyDown={(event) => {
            if (event.key === 'Escape') closeViewer();
          }}
        >
          <div className={styles.drawerHeader}>
            <h3 id="matter-document-viewer-title" className={styles.drawerTitle}>📄 {viewerDocTitle}</h3>
            <button
              type="button"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '1.25rem',
                cursor: 'pointer',
              }}
              onClick={closeViewer}
              aria-label="Close document viewer"
              autoFocus
            >
              ✕
            </button>
          </div>
          <div className={styles.drawerContent}>
            <DocumentViewer
              fileUrl={`/api/documents/${viewerDocId}/file`}
              initialPage={viewerPage}
              activePage={viewerPage}
            />
          </div>
        </aside>
      )}

      {/* Add Document to Matter Modal */}
      {isAddDocModalOpen && (
        <Modal
          isOpen={isAddDocModalOpen}
          onClose={() => setIsAddDocModalOpen(false)}
          title="Add Document to Matter"
        >
            {allAvailableDocs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                All uploaded documents are already in this matter, or no documents have been
                uploaded yet.
                <div style={{ marginTop: '1rem' }}>
                  <LinkButton href="/dashboard" variant="primary" size="sm">Upload New Document →</LinkButton>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddDocument}>
                <div style={{ marginBottom: '1rem' }}>
                  <label
                    htmlFor="matter-document-select"
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '0.4rem',
                    }}
                  >
                    Select Document *
                  </label>
                  <select
                    id="matter-document-select"
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className={styles.searchInput}
                    style={{ width: '100%' }}
                  >
                    {allAvailableDocs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title} ({d.pageCount || 1} pages)
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label
                    htmlFor="matter-document-role"
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '0.4rem',
                    }}
                  >
                    Document Role in Matter
                  </label>
                  <select
                    id="matter-document-role"
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as MatterDocumentRole)}
                    className={styles.searchInput}
                    style={{ width: '100%' }}
                  >
                    {Object.values(MATTER_DOCUMENT_ROLES).map((role) => (
                      <option key={role} value={role}>
                        {role.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsAddDocModalOpen(false)}
                    disabled={isAddingDoc}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={isAddingDoc}>
                    {isAddingDoc ? 'Adding...' : 'Add to Matter'}
                  </Button>
                </div>
              </form>
            )}
        </Modal>
      )}

      {/* Add Action Item Modal */}
      {isAddActionModalOpen && (
        <Modal
          isOpen={isAddActionModalOpen}
          onClose={() => setIsAddActionModalOpen(false)}
          title="Create Action Item"
        >
            <form onSubmit={handleCreateActionItem}>
              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="matter-action-title"
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    marginBottom: '0.4rem',
                  }}
                >
                  Task Title *
                </label>
                <input
                  aria-label="Note title"
                  id="matter-action-title"
                  type="text"
                  required
                  placeholder="e.g. Clarify notice period with counsel..."
                  value={newActionTitle}
                  onChange={(e) => setNewActionTitle(e.target.value)}
                  className={styles.searchInput}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="matter-action-description"
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    marginBottom: '0.4rem',
                  }}
                >
                  Description & Context
                </label>
                <textarea
                  aria-label="Note details and context"
                  id="matter-action-description"
                  rows={3}
                  placeholder="Enter details, reference notes, or questions..."
                  value={newActionDesc}
                  onChange={(e) => setNewActionDesc(e.target.value)}
                  className={styles.searchInput}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label
                    htmlFor="matter-action-type"
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '0.4rem',
                    }}
                  >
                    Type
                  </label>
                  <select
                    id="matter-action-type"
                    value={newActionType}
                    onChange={(e) => setNewActionType(e.target.value as ActionItemType)}
                    className={styles.searchInput}
                    style={{ width: '100%' }}
                  >
                    {Object.values(ACTION_ITEM_TYPES).map((t) => (
                      <option key={t} value={t}>
                        {t.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="matter-action-priority"
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '0.4rem',
                    }}
                  >
                    Priority
                  </label>
                  <select
                    id="matter-action-priority"
                    value={newActionPriority}
                    onChange={(e) => setNewActionPriority(e.target.value as ActionItemPriority)}
                    className={styles.searchInput}
                    style={{ width: '100%' }}
                  >
                    {Object.values(ACTION_ITEM_PRIORITIES).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsAddActionModalOpen(false)}
                  disabled={isAddingAction}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isAddingAction || !newActionTitle.trim()}>
                  {isAddingAction ? 'Creating...' : 'Create Task'}
                </Button>
              </div>
            </form>
        </Modal>
      )}

      {/* Phase 7 LegalInfoModal Integration */}
      {conceptModalTopic && (
        <LegalInfoModal
          topic={conceptModalTopic}
          documentId={matter.documents[0]?.documentId}
          isOpen={true}
          onClose={() => setConceptModalTopic(null)}
        />
      )}
    </div>
  );
};
