'use client';

import { LinkButton } from '@/components/ui/Button/LinkButton';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './MatterWorkspace.module.css';
import { Button } from '@/components/ui/Button/Button';
import { Spinner } from '@/components/ui/Spinner/Spinner';
import { DocumentViewer } from '@/components/document/DocumentViewer';
import { LegalInfoModal } from '@/components/legal-info/LegalInfoModal';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import {
  MatterDetail,
  DocumentRelationshipItem,
  ConsistencyFinding,
  MatterTimelineEvent,
  MatterSearchResponse,
  MatterQueryResponse,
  MatterActionItem,
  MatterReadinessReport,
  MatterActivityItem,
  CounselQuestionItem,
  MatterBriefResponse,
  MatterSourceMapResponse,
  MatterEvidenceItem,
} from '@/lib/ai/schemas';
import {
  MatterDocumentRole,
  MATTER_DOCUMENT_ROLES,
  ActionItemStatus,
  ActionItemPriority,
  ActionItemType,
  ACTION_ITEM_TYPES,
  ACTION_ITEM_PRIORITIES,
} from '@/lib/ai/safety';

interface MatterWorkspaceProps {
  matterId: string;
}

type TabType =
  | 'overview'
  | 'actionPlan'
  | 'sourceMap'
  | 'documents'
  | 'timeline'
  | 'relationships'
  | 'consistency'
  | 'search'
  | 'ask'
  | 'attention'
  | 'questions'
  | 'prepare'
  | 'notes';

const TAB_TITLES: Record<TabType, string> = {
  overview: 'Overview',
  actionPlan: 'Action Plan',
  sourceMap: 'Source Map',
  documents: 'Documents',
  timeline: 'Timeline',
  relationships: 'Relationships',
  consistency: 'Consistency',
  search: 'Search',
  ask: 'Ask My Matter',
  attention: 'Attention Areas',
  questions: 'Questions for Counsel',
  prepare: 'Counsel Brief',
  notes: 'Notes',
};

interface AllDocumentItem {
  id: string;
  title: string;
  originalFilename: string;
  status: string;
  pageCount?: number | null;
}

interface MatterNote {
  id: string;
  title: string;
  content: string;
  classification: string;
  createdAt: string;
}

export const MatterWorkspace: React.FC<MatterWorkspaceProps> = ({ matterId }) => {
  const [matter, setMatter] = useState<MatterDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [copiedQuestionId, setCopiedQuestionId] = useState<string | null>(null);

  // Tab Data States
  const [timeline, setTimeline] = useState<MatterTimelineEvent[]>([]);
  const [relationships, setRelationships] = useState<DocumentRelationshipItem[]>([]);
  const [consistency, setConsistency] = useState<ConsistencyFinding[]>([]);
  const [notes, setNotes] = useState<MatterNote[]>([]);

  // Phase 9: Action Plan & Copilot States
  const [actionItems, setActionItems] = useState<MatterActionItem[]>([]);
  const [actionFilterStatus, setActionFilterStatus] = useState<string>('ALL');
  const [actionFilterPriority, setActionFilterPriority] = useState<string>('ALL');
  const [isGeneratingActions, setIsGeneratingActions] = useState<boolean>(false);
  const [isAddActionModalOpen, setIsAddActionModalOpen] = useState<boolean>(false);
  const [newActionTitle, setNewActionTitle] = useState<string>('');
  const [newActionDesc, setNewActionDesc] = useState<string>('');
  const [newActionType, setNewActionType] = useState<ActionItemType>('FOLLOW_UP');
  const [newActionPriority, setNewActionPriority] = useState<ActionItemPriority>('MEDIUM');
  const [isAddingAction, setIsAddingAction] = useState<boolean>(false);

  // Phase 9: Readiness & Activity States
  const [readiness, setReadiness] = useState<MatterReadinessReport | null>(null);
  const [activities, setActivities] = useState<MatterActivityItem[]>([]);

  // Phase 9: Counsel Questions & Brief States
  const [counselQuestions, setCounselQuestions] = useState<CounselQuestionItem[]>([]);
  const [isGeneratingCounselQuestions, setIsGeneratingCounselQuestions] = useState<boolean>(false);
  const [matterBrief, setMatterBrief] = useState<MatterBriefResponse | null>(null);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState<boolean>(false);

  // Search tab states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<MatterSearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Ask tab states
  const [qaQuestion, setQaQuestion] = useState<string>('');
  const [qaResponse, setQaResponse] = useState<MatterQueryResponse | null>(null);
  const [isAsking, setIsAsking] = useState<boolean>(false);

  // Notes state
  const [newNoteTitle, setNewNoteTitle] = useState<string>('');
  const [newNoteContent, setNewNoteContent] = useState<string>('');
  const [isAddingNote, setIsAddingNote] = useState<boolean>(false);

  // Add Document Modal
  const [isAddDocModalOpen, setIsAddDocModalOpen] = useState<boolean>(false);
  const [allAvailableDocs, setAllAvailableDocs] = useState<AllDocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<MatterDocumentRole>('SUPPORTING_DOCUMENT');
  const [isAddingDoc, setIsAddingDoc] = useState<boolean>(false);

  // Document Viewer overlay state
  const [viewerDocId, setViewerDocId] = useState<string | null>(null);
  const [viewerDocTitle, setViewerDocTitle] = useState<string>('');
  const [viewerPage, setViewerPage] = useState<number>(1);

  // Legal Information modal
  const [conceptModalTopic, setConceptModalTopic] = useState<string | null>(null);

  // Refreshing relationships state
  const [isRefreshingRels, setIsRefreshingRels] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Phase 10: Evidence Intelligence & Source Map States
  const [sourceMapData, setSourceMapData] = useState<MatterSourceMapResponse | null>(null);
  const [evidenceLedger, setEvidenceLedger] = useState<MatterEvidenceItem[]>([]);
  const [sourceMapViewMode, setSourceMapViewMode] = useState<'hierarchy' | 'ledger'>('hierarchy');
  const [selectedSourceDocId, setSelectedSourceDocId] = useState<string | null>(null);
  const [selectedSourcePage, setSelectedSourcePage] = useState<number | null>(null);
  const [evidenceFilterClassification, setEvidenceFilterClassification] = useState<string>('ALL');
  const [evidenceFilterVerification, setEvidenceFilterVerification] = useState<string>('ALL');
  const [evidenceFilterDocId, setEvidenceFilterDocId] = useState<string>('ALL');
  const [evidenceSearchQuery, setEvidenceSearchQuery] = useState<string>('');
  const [isLoadingSourceMap, setIsLoadingSourceMap] = useState<boolean>(false);

  // 1. Fetch Matter Details & Core Phase 9/10 Data
  useEffect(() => {
    if (!matterId) return;
    let ignore = false;

    async function loadMatterDetails() {
      try {
        const res = await fetch(`/api/matters/${matterId}`);
        if (ignore) return;
        if (!res.ok) {
          throw new Error('Failed to load matter details.');
        }
        const data = await res.json();
        if (ignore) return;
        setMatter(data.matter);
        setError(null);
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Error loading matter');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    async function loadPhaseData() {
      try {
        const [actRes, readRes, actTrailRes, briefRes, smRes, ledRes] = await Promise.all([
          fetch(`/api/matters/${matterId}/action-items`),
          fetch(`/api/matters/${matterId}/readiness`),
          fetch(`/api/matters/${matterId}/activity?limit=20`),
          fetch(`/api/matters/${matterId}/brief`),
          fetch(`/api/matters/${matterId}/source-map`),
          fetch(`/api/matters/${matterId}/evidence`),
        ]);

        if (ignore) return;
        if (actRes.ok) {
          const d = await actRes.json();
          setActionItems(d.items || []);
        }
        if (readRes.ok) {
          const d = await readRes.json();
          setReadiness(d.readiness || null);
        }
        if (actTrailRes.ok) {
          const d = await actTrailRes.json();
          setActivities(d.activity || []);
        }
        if (briefRes.ok) {
          const d = await briefRes.json();
          setMatterBrief(d.brief || null);
        }
        if (smRes.ok) {
          const d = (await smRes.json()) as MatterSourceMapResponse;
          setSourceMapData(d);
          if (d.documents && d.documents.length > 0) {
            setSelectedSourceDocId((prev) => prev || d.documents[0].documentId);
            const firstWithEvidence = d.documents.find((doc) => doc.pagesWithEvidence.length > 0);
            if (firstWithEvidence && firstWithEvidence.pagesWithEvidence.length > 0) {
              setSelectedSourcePage((prev) => prev || firstWithEvidence.pagesWithEvidence[0].pageNumber);
            } else {
              setSelectedSourcePage((prev) => prev || 1);
            }
          }
        }
        if (ledRes.ok) {
          const d = await ledRes.json();
          setEvidenceLedger(d.items || []);
        }
      } catch {
        // non-blocking
      }
    }

    loadMatterDetails();
    loadPhaseData();

    return () => {
      ignore = true;
    };
  }, [matterId, refreshTrigger]);

  // 2. Fetch Tab Data on Tab Change
  useEffect(() => {
    if (!matterId) return;

    if (activeTab === 'timeline') {
      fetch(`/api/matters/${matterId}/timeline`)
        .then((r) => r.json())
        .then((d) => setTimeline(d.timeline || []))
        .catch(() => {});
    } else if (activeTab === 'relationships') {
      fetch(`/api/matters/${matterId}/relationships`)
        .then((r) => r.json())
        .then((d) => setRelationships(d.relationships || []))
        .catch(() => {});
    } else if (activeTab === 'consistency') {
      fetch(`/api/matters/${matterId}/consistency`)
        .then((r) => r.json())
        .then((d) => setConsistency(d.findings || []))
        .catch(() => {});
    } else if (activeTab === 'notes') {
      fetch(`/api/matters/${matterId}/notes`)
        .then((r) => r.json())
        .then((d) => setNotes(d.notes || []))
        .catch(() => {});
    } else if (activeTab === 'actionPlan') {
      fetch(`/api/matters/${matterId}/action-items`)
        .then((r) => r.json())
        .then((d) => setActionItems(d.items || []))
        .catch(() => {});
    } else if (activeTab === 'prepare') {
      fetch(`/api/matters/${matterId}/brief`)
        .then((r) => r.json())
        .then((d) => setMatterBrief(d.brief || null))
        .catch(() => {});
    } else if (activeTab === 'questions' && counselQuestions.length === 0) {
      fetch(`/api/matters/${matterId}/counsel-questions/generate`, { method: 'POST' })
        .then((r) => r.json())
        .then((d) => setCounselQuestions(d.questions || []))
        .catch(() => {});
    }
  }, [matterId, activeTab, counselQuestions.length]);

  // Phase 9 Handlers: Action Items
  const handleToggleActionItemStatus = async (item: MatterActionItem) => {
    const nextStatus: ActionItemStatus = item.status === 'COMPLETED' ? 'OPEN' : 'COMPLETED';
    try {
      const res = await fetch(`/api/matters/${matterId}/action-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('Failed to update action item.');
      const data = await res.json();
      setActionItems((prev) => prev.map((i) => (i.id === item.id ? data.item : i)));
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error updating action item');
    }
  };

  const handleDeleteActionItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this action item?')) return;
    try {
      const res = await fetch(`/api/matters/${matterId}/action-items/${itemId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete action item.');
      setActionItems((prev) => prev.filter((i) => i.id !== itemId));
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error deleting action item');
    }
  };

  const handleGenerateActionItems = async () => {
    try {
      setIsGeneratingActions(true);
      const res = await fetch(`/api/matters/${matterId}/action-items/generate`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to generate action items.');
      const data = await res.json();
      setActionItems(data.items || []);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error generating action items');
    } finally {
      setIsGeneratingActions(false);
    }
  };

  const handleCreateActionItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionTitle.trim()) return;

    try {
      setIsAddingAction(true);
      const res = await fetch(`/api/matters/${matterId}/action-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newActionTitle.trim(),
          description: newActionDesc.trim() || 'Custom preparation task.',
          type: newActionType,
          priority: newActionPriority,
          sourceType: 'USER_CREATED',
          userProvided: true,
        }),
      });
      if (!res.ok) throw new Error('Failed to create action item.');
      const data = await res.json();
      setActionItems((prev) => [data.item, ...prev]);
      setIsAddActionModalOpen(false);
      setNewActionTitle('');
      setNewActionDesc('');
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error creating action item');
    } finally {
      setIsAddingAction(false);
    }
  };

  // Phase 9 Handlers: Counsel Questions
  const handleGenerateCounselQuestions = async () => {
    try {
      setIsGeneratingCounselQuestions(true);
      const res = await fetch(`/api/matters/${matterId}/counsel-questions/generate`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to generate counsel questions.');
      const data = await res.json();
      setCounselQuestions(data.questions || []);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error generating counsel questions');
    } finally {
      setIsGeneratingCounselQuestions(false);
    }
  };

  const handleConvertQuestionToAction = async (q: CounselQuestionItem) => {
    try {
      const res = await fetch(`/api/matters/${matterId}/action-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Counsel Discussion: ${q.category} - ${q.question.slice(0, 50)}...`,
          description: `${q.question}\n\nRationale: ${q.rationale}`,
          type: 'ASK_COUNSEL',
          priority: 'HIGH',
          sourceType: 'USER_CREATED',
          sourceReference: q.sourceReference || undefined,
          relatedDocumentId: q.documentId || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to add to action plan.');
      const data = await res.json();
      setActionItems((prev) => [data.item, ...prev]);
      alert('Question added as an action item!');
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error creating action item');
    }
  };

  const handleCopyQuestion = (q: CounselQuestionItem) => {
    const textToCopy = `Question: ${q.question}\nCategory: ${q.category}\nRationale: ${q.rationale}${
      q.sourceReference ? `\nSource: ${q.sourceReference}` : ''
    }`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedQuestionId(q.id);
      setTimeout(() => setCopiedQuestionId(null), 2000);
    }
  };

  // Phase 9 Handlers: Matter Brief Dossier
  const handleGenerateMatterBrief = async (force = false) => {
    try {
      setIsGeneratingBrief(true);
      const res = await fetch(`/api/matters/${matterId}/brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      if (!res.ok) throw new Error('Failed to generate matter consultation brief.');
      const data = await res.json();
      setMatterBrief(data.brief || null);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error generating brief');
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  // Open Document in Drawer
  const openViewer = (docId: string, title: string, page = 1) => {
    setViewerDocId(docId);
    setViewerDocTitle(title);
    setViewerPage(page);
  };

  // Close Drawer
  const closeViewer = () => {
    setViewerDocId(null);
  };

  // Search Matter
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setIsSearching(true);
      const res = await fetch(
        `/api/matters/${matterId}/search?q=${encodeURIComponent(searchQuery.trim())}`
      );
      if (!res.ok) throw new Error('Search request failed.');
      const data = await res.json();
      setSearchResults(data);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Search error');
    } finally {
      setIsSearching(false);
    }
  };

  // Ask My Matter
  const handleAsk = async (questionToAsk?: string) => {
    const q = questionToAsk || qaQuestion;
    if (!q.trim()) return;

    try {
      setIsAsking(true);
      const res = await fetch(`/api/matters/${matterId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q.trim() }),
      });
      if (!res.ok) throw new Error('Q&A request failed.');
      const data = await res.json();
      setQaResponse(data);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error processing question');
    } finally {
      setIsAsking(false);
    }
  };

  // Add Document to Matter
  const handleOpenAddDocModal = async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        const existingDocIds = new Set((matter?.documents || []).map((d) => d.documentId));
        const available = (data.documents || []).filter(
          (d: AllDocumentItem) => !existingDocIds.has(d.id)
        );
        setAllAvailableDocs(available);
        if (available.length > 0) {
          setSelectedDocId(available[0].id);
        }
      }
      setIsAddDocModalOpen(true);
    } catch {
      setIsAddDocModalOpen(true);
    }
  };

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId) return;

    try {
      setIsAddingDoc(true);
      const res = await fetch(`/api/matters/${matterId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: selectedDocId, role: selectedRole }),
      });
      if (!res.ok) throw new Error('Failed to add document.');
      setIsAddDocModalOpen(false);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error adding document');
    } finally {
      setIsAddingDoc(false);
    }
  };

  // Remove Document from Matter
  const handleRemoveDocument = async (docId: string, title: string) => {
    if (
      !confirm(
        `Remove "${title}" from this matter?\n\nNote: The underlying document and its analysis will NOT be deleted.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/matters/${matterId}/documents/${docId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove document.');
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error removing document');
    }
  };

  // Confirm / Reject Relationship
  const handleUpdateRelationshipStatus = async (
    relId: string,
    status: 'CONFIRMED' | 'REJECTED'
  ) => {
    try {
      const res = await fetch(`/api/matters/${matterId}/relationships/${relId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update relationship.');
      const data = await res.json();
      setRelationships((prev) =>
        prev.map((r) => (r.id === relId ? data.relationship : r))
      );
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error updating relationship');
    }
  };

  // Refresh Relationships
  const handleRefreshRelationships = async () => {
    try {
      setIsRefreshingRels(true);
      const res = await fetch(`/api/matters/${matterId}/relationships/refresh`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to refresh relationships.');
      const data = await res.json();
      setRelationships(data.relationships || []);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error refreshing relationships');
    } finally {
      setIsRefreshingRels(false);
    }
  };

  // Add User Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;

    try {
      setIsAddingNote(true);
      const res = await fetch(`/api/matters/${matterId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newNoteTitle.trim(),
          content: newNoteContent.trim(),
        }),
      });
      if (!res.ok) throw new Error('Failed to add note.');
      const data = await res.json();
      setNotes((prev) => [data.note, ...prev]);
      setNewNoteTitle('');
      setNewNoteContent('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error adding note');
    } finally {
      setIsAddingNote(false);
    }
  };

  // Delete User Note
  const handleDeleteNote = async (noteId: string) => {
    try {
      const res = await fetch(`/api/matters/${matterId}/notes/${noteId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete note.');
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error deleting note');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem 0' }}>
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
              ...(activeTab !== 'overview' ? [{ label: TAB_TITLES[activeTab] || activeTab }] : []),
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
              <div className={styles.readinessBar}>
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

      {/* 12 Navigation Tabs */}
      <nav className={styles.tabsNav} role="tablist" aria-label="Matter Workspace Sections">
        {[
          { id: 'overview', label: 'Overview' },
          {
            id: 'actionPlan',
            label: 'Action Plan',
            count: actionItems.filter((i) => i.status !== 'COMPLETED').length,
          },
          {
            id: 'sourceMap',
            label: 'Source Map',
            count: sourceMapData?.coverage?.totalEvidenceItems,
          },
          { id: 'documents', label: 'Documents', count: matter.documents.length },
          { id: 'timeline', label: 'Timeline' },
          {
            id: 'relationships',
            label: 'Relationships',
            count: matter.metrics.totalRelationships,
          },
          {
            id: 'consistency',
            label: 'Consistency',
            count: matter.metrics.totalInconsistencies,
          },
          { id: 'search', label: 'Search Matter' },
          { id: 'ask', label: 'Ask My Matter' },
          {
            id: 'attention',
            label: 'Attention Areas',
            count: matter.metrics.openAttentionAreas,
          },
          {
            id: 'questions',
            label: 'Lawyer Questions',
            count: counselQuestions.length > 0 ? counselQuestions.length : matter.metrics.totalLawyerQuestions,
          },
          { id: 'prepare', label: 'Prepare Dossier' },
          { id: 'notes', label: 'Notes' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${styles.tabButton} ${activeTab === tab.id ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab(tab.id as TabType)}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className={styles.badgeCount}>{tab.count}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
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
      )}

      {/* Tab 2: Action Plan & Matter Copilot */}
      {activeTab === 'actionPlan' && (
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
      )}

      {/* Tab: Source Map & Evidence Intelligence */}
      {activeTab === 'sourceMap' && (
        <div className={styles.tabPane}>
          <div className={styles.sourceMapContainer}>
            {/* Header with View Mode Toggle */}
            <div className={styles.sourceMapHeader}>
              <div className={styles.sourceMapTitleArea}>
                <h2>Evidence Intelligence & Source Map</h2>
                <p>
                  Trace every fact, finding, question, and action item to its exact supporting document, page, and verbatim quote.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div className={styles.sourceMapViewToggle}>
                  <button
                    type="button"
                    className={`${styles.sourceMapToggleBtn} ${
                      sourceMapViewMode === 'hierarchy' ? styles.sourceMapToggleBtnActive : ''
                    }`}
                    onClick={() => setSourceMapViewMode('hierarchy')}
                  >
                    <span>🌳</span>
                    <span>Visual Hierarchy</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.sourceMapToggleBtn} ${
                      sourceMapViewMode === 'ledger' ? styles.sourceMapToggleBtnActive : ''
                    }`}
                    onClick={() => setSourceMapViewMode('ledger')}
                  >
                    <span>📜</span>
                    <span>Evidence Ledger</span>
                  </button>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isLoadingSourceMap}
                  onClick={async () => {
                    setIsLoadingSourceMap(true);
                    try {
                      const res = await fetch(`/api/matters/${matterId}/source-map`);
                      if (res.ok) {
                        const sm = await res.json();
                        setSourceMapData(sm);
                      }
                      const ledRes = await fetch(`/api/matters/${matterId}/evidence`);
                      if (ledRes.ok) {
                        const led = await ledRes.json();
                        setEvidenceLedger(led.items || []);
                      }
                    } finally {
                      setIsLoadingSourceMap(false);
                    }
                  }}
                >
                  {isLoadingSourceMap ? 'Syncing...' : '🔄 Re-Sync Evidence'}
                </Button>
              </div>
            </div>

            {/* Evidence Coverage Metrics Bar */}
            {sourceMapData?.coverage && (
              <div className={styles.coverageGrid}>
                <div className={styles.coverageCard}>
                  <span className={styles.coverageLabel}>Total Verified Evidence</span>
                  <span className={styles.coverageValue}>
                    {sourceMapData.coverage.verifiedEvidenceCount} / {sourceMapData.coverage.totalEvidenceItems}
                  </span>
                  <span className={styles.coverageSub}>Ground truth excerpts in matter</span>
                </div>

                <div className={styles.coverageCard}>
                  <span className={styles.coverageLabel}>Documents with Evidence</span>
                  <span className={styles.coverageValue}>
                    {sourceMapData.coverage.documentsWithVerifiedEvidence} / {sourceMapData.coverage.totalDocuments}
                  </span>
                  <span className={styles.coverageSub}>Verified document pages</span>
                </div>

                <div className={styles.coverageCard}>
                  <span className={styles.coverageLabel}>Findings with Citations</span>
                  <span className={styles.coverageValue}>
                    {sourceMapData.coverage.findingsWithCitations.withCitations} /{' '}
                    {sourceMapData.coverage.findingsWithCitations.total}
                  </span>
                  <span className={styles.coverageSub}>Consistency & relationship evidence</span>
                </div>

                <div className={styles.coverageCard}>
                  <span className={styles.coverageLabel}>Questions with Evidence</span>
                  <span className={styles.coverageValue}>
                    {sourceMapData.coverage.counselQuestionsWithEvidence.withEvidence} /{' '}
                    {sourceMapData.coverage.counselQuestionsWithEvidence.total}
                  </span>
                  <span className={styles.coverageSub}>Counsel questions anchored to text</span>
                </div>

                <div className={styles.coverageCard}>
                  <span className={styles.coverageLabel}>Items Needing Review</span>
                  <span className={styles.coverageValue} style={{ color: '#fbbf24' }}>
                    {sourceMapData.coverage.needsReviewEvidenceCount}
                  </span>
                  <span className={styles.coverageSub}>Unverified or partial citations</span>
                </div>
              </div>
            )}

            {/* VIEW MODE 1: VISUAL SOURCE HIERARCHY */}
            {sourceMapViewMode === 'hierarchy' && (
              <div className={styles.sourceHierarchyLayout}>
                {/* Left Pane: Member Document & Page Tree */}
                <div className={styles.sourceDocTree}>
                  <div
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Member Documents & Pages
                  </div>

                  {!sourceMapData || sourceMapData.documents.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                      No documents in this matter yet.
                    </div>
                  ) : (
                    sourceMapData.documents.map((docNode) => {
                      const isDocSelected = selectedSourceDocId === docNode.documentId;
                      return (
                        <div
                          key={docNode.documentId}
                          className={`${styles.sourceDocCard} ${
                            isDocSelected ? styles.sourceDocCardActive : ''
                          }`}
                          onClick={() => {
                            setSelectedSourceDocId(docNode.documentId);
                            if (docNode.pagesWithEvidence.length > 0) {
                              setSelectedSourcePage(docNode.pagesWithEvidence[0].pageNumber);
                            } else {
                              setSelectedSourcePage(1);
                            }
                          }}
                        >
                          <div className={styles.sourceDocCardHeader}>
                            <span className={styles.sourceDocTitle}>{docNode.title}</span>
                            <span className={styles.roleBadge}>{docNode.role.replace(/_/g, ' ')}</span>
                          </div>

                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {docNode.totalEvidenceCount} evidence item
                            {docNode.totalEvidenceCount === 1 ? '' : 's'} ·{' '}
                            {docNode.verifiedEvidenceCount} verified
                          </div>

                          {/* Page Pills Grid */}
                          {docNode.pagesWithEvidence.length > 0 ? (
                            <div className={styles.pagesGrid}>
                              {docNode.pagesWithEvidence.map((pageNode) => {
                                const isPageActive =
                                  isDocSelected && selectedSourcePage === pageNode.pageNumber;
                                return (
                                  <button
                                    key={pageNode.pageNumber}
                                    type="button"
                                    className={`${styles.pagePill} ${
                                      isPageActive ? styles.pagePillActive : ''
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedSourceDocId(docNode.documentId);
                                      setSelectedSourcePage(pageNode.pageNumber);
                                    }}
                                  >
                                    p. {pageNode.pageNumber} ({pageNode.evidenceItems.length})
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                              No extracted evidence for this document.
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Right Pane: Page Evidence Detail */}
                <div className={styles.pageEvidencePane}>
                  {(() => {
                    const activeDoc = sourceMapData?.documents.find(
                      (d) => d.documentId === selectedSourceDocId
                    );
                    const activePageNode = activeDoc?.pagesWithEvidence.find(
                      (p) => p.pageNumber === selectedSourcePage
                    );

                    if (!activeDoc) {
                      return (
                        <div className={styles.emptyState}>
                          <p>Select a document and page from the tree to inspect evidence provenance.</p>
                        </div>
                      );
                    }

                    return (
                      <>
                        <div className={styles.pageEvidencePaneHeader}>
                          <div>
                            <h3 style={{ fontSize: '1.15rem', color: '#ffffff', margin: '0 0 0.25rem 0' }}>
                              📄 {activeDoc.title} — Page {selectedSourcePage || 1}
                            </h3>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              Role: {activeDoc.role.replace(/_/g, ' ')} ·{' '}
                              {activePageNode
                                ? `${activePageNode.evidenceItems.length} Evidence Excerpts`
                                : 'No evidence on this page'}
                            </span>
                          </div>

                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              openViewer(activeDoc.documentId, activeDoc.title, selectedSourcePage || 1)
                            }
                          >
                            🔍 Open in PDF Viewer (p.{selectedSourcePage || 1}) →
                          </Button>
                        </div>

                        {!activePageNode || activePageNode.evidenceItems.length === 0 ? (
                          <div className={styles.emptyState} style={{ padding: '3rem 1rem' }}>
                            <p>No verified evidence excerpts on Page {selectedSourcePage || 1}.</p>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() =>
                                openViewer(activeDoc.documentId, activeDoc.title, selectedSourcePage || 1)
                              }
                            >
                              Inspect Full Page in Viewer
                            </Button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {activePageNode.evidenceItems.map((evItem) => {
                              const isVerified = evItem.verificationStatus === 'VERIFIED';
                              const isReview = evItem.verificationStatus === 'NEEDS_REVIEW';

                              return (
                                <div
                                  key={evItem.id}
                                  style={{
                                    background: 'rgba(11, 15, 25, 0.5)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderRadius: '10px',
                                    padding: '1.1rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.65rem',
                                  }}
                                >
                                  {evItem.quotedText && (
                                    <blockquote className={styles.evidenceQuoteBlock}>
                                      &ldquo;{evItem.quotedText}&rdquo;
                                    </blockquote>
                                  )}

                                  <div className={styles.evidenceProvenanceRow}>
                                    <span className={styles.provenancePill}>
                                      {evItem.classification.replace(/_/g, ' ')}
                                    </span>

                                    <span
                                      className={
                                        isVerified
                                          ? styles.verificationBadgeVerified
                                          : isReview
                                          ? styles.verificationBadgeReview
                                          : styles.verificationBadgeUnverified
                                      }
                                    >
                                      {isVerified ? '✓ VERIFIED' : isReview ? '⚠️ NEEDS REVIEW' : '✕ UNVERIFIED'}
                                    </span>

                                    <span className={styles.datePill}>
                                      Confidence: {evItem.confidenceCategory}
                                    </span>

                                    {evItem.sourceReference && (
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {evItem.sourceReference}
                                      </span>
                                    )}
                                  </div>

                                  {/* Used By Lineage Chips */}
                                  {evItem.usedBy && evItem.usedBy.length > 0 && (
                                    <div className={styles.usedBySection}>
                                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                        Referenced In Matter Findings:
                                      </span>
                                      <div className={styles.usedByChips}>
                                        {evItem.usedBy.map((ub, idx) => (
                                          <button
                                            key={idx}
                                            type="button"
                                            className={styles.usedByChip}
                                            onClick={() => {
                                              if (ub.type === 'CONSISTENCY') setActiveTab('consistency');
                                              else if (ub.type === 'QUESTION') setActiveTab('questions');
                                              else if (ub.type === 'ACTION_ITEM') setActiveTab('actionPlan');
                                              else if (ub.type === 'RELATIONSHIP') setActiveTab('relationships');
                                              else if (ub.type === 'BRIEF') setActiveTab('prepare');
                                            }}
                                          >
                                            {ub.type === 'CONSISTENCY' && '⚖️ '}
                                            {ub.type === 'QUESTION' && '❓ '}
                                            {ub.type === 'ACTION_ITEM' && '✅ '}
                                            {ub.type === 'RELATIONSHIP' && '🔗 '}
                                            {ub.type === 'BRIEF' && '💼 '}
                                            {ub.title} →
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* VIEW MODE 2: SEARCHABLE EVIDENCE LEDGER */}
            {sourceMapViewMode === 'ledger' && (
              <div className={styles.ledgerContainer}>
                {/* Search & Filter Bar */}
                <div className={styles.ledgerFilterBar}>
                  <input
                    type="text"
                    placeholder="Search verified quotes, terms, or document titles..."
                    value={evidenceSearchQuery}
                    onChange={(e) => setEvidenceSearchQuery(e.target.value)}
                    className={styles.searchInput}
                    style={{ flex: 1, minWidth: '220px' }}
                  />

                  {/* Classification Filter */}
                  <select
                    value={evidenceFilterClassification}
                    onChange={(e) => setEvidenceFilterClassification(e.target.value)}
                    className={styles.searchInput}
                    style={{ minWidth: '150px' }}
                  >
                    <option value="ALL">All Classifications</option>
                    <option value="DOCUMENT_FACT">DOCUMENT_FACT</option>
                    <option value="AI_INTERPRETATION">AI_INTERPRETATION</option>
                    <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
                    <option value="USER_PROVIDED">USER_PROVIDED</option>
                  </select>

                  {/* Verification Status Filter */}
                  <select
                    value={evidenceFilterVerification}
                    onChange={(e) => setEvidenceFilterVerification(e.target.value)}
                    className={styles.searchInput}
                    style={{ minWidth: '140px' }}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="VERIFIED">VERIFIED</option>
                    <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
                    <option value="UNVERIFIED">UNVERIFIED</option>
                  </select>

                  {/* Document Filter */}
                  <select
                    value={evidenceFilterDocId}
                    onChange={(e) => setEvidenceFilterDocId(e.target.value)}
                    className={styles.searchInput}
                    style={{ minWidth: '160px' }}
                  >
                    <option value="ALL">All Documents</option>
                    {matter.documents.map((d) => (
                      <option key={d.documentId} value={d.documentId}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Ledger Cards & Filter Bar Info */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>
                    Showing <strong>{evidenceLedger.filter((ev) => {
                      if (evidenceFilterClassification !== 'ALL' && ev.classification !== evidenceFilterClassification) return false;
                      if (evidenceFilterVerification !== 'ALL' && ev.verificationStatus !== evidenceFilterVerification) return false;
                      if (evidenceFilterDocId !== 'ALL' && ev.documentId !== evidenceFilterDocId) return false;
                      if (evidenceSearchQuery.trim()) {
                        const q = evidenceSearchQuery.toLowerCase();
                        const matchesQuote = ev.quotedText && ev.quotedText.toLowerCase().includes(q);
                        const matchesDoc = ev.documentTitle && ev.documentTitle.toLowerCase().includes(q);
                        const matchesRef = ev.sourceReference && ev.sourceReference.toLowerCase().includes(q);
                        if (!matchesQuote && !matchesDoc && !matchesRef) return false;
                      }
                      return true;
                    }).length}</strong> evidence item(s)
                  </span>
                  {(evidenceFilterClassification !== 'ALL' || evidenceFilterVerification !== 'ALL' || evidenceFilterDocId !== 'ALL' || evidenceSearchQuery.trim()) && (
                    <button
                      type="button"
                      onClick={() => {
                        setEvidenceSearchQuery('');
                        setEvidenceFilterClassification('ALL');
                        setEvidenceFilterVerification('ALL');
                        setEvidenceFilterDocId('ALL');
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-gold, #c8a256)',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                {evidenceLedger.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>No evidence has been mapped yet.</p>
                  </div>
                ) : (
                  <div className={styles.ledgerCardList}>
                    {evidenceLedger
                      .filter((ev) => {
                        if (
                          evidenceFilterClassification !== 'ALL' &&
                          ev.classification !== evidenceFilterClassification
                        )
                          return false;
                        if (
                          evidenceFilterVerification !== 'ALL' &&
                          ev.verificationStatus !== evidenceFilterVerification
                        )
                          return false;
                        if (
                          evidenceFilterDocId !== 'ALL' &&
                          ev.documentId !== evidenceFilterDocId
                        )
                          return false;
                        if (evidenceSearchQuery.trim()) {
                          const q = evidenceSearchQuery.toLowerCase();
                          const matchesQuote =
                            ev.quotedText && ev.quotedText.toLowerCase().includes(q);
                          const matchesDoc =
                            ev.documentTitle && ev.documentTitle.toLowerCase().includes(q);
                          const matchesRef =
                            ev.sourceReference && ev.sourceReference.toLowerCase().includes(q);
                          if (!matchesQuote && !matchesDoc && !matchesRef) return false;
                        }
                        return true;
                      })
                      .map((ev) => {
                        const isVerified = ev.verificationStatus === 'VERIFIED';
                        const isReview = ev.verificationStatus === 'NEEDS_REVIEW';

                        return (
                          <div key={ev.id} className={styles.ledgerCard}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '0.5rem',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span className={styles.provenancePill}>
                                  {ev.classification.replace(/_/g, ' ')}
                                </span>
                                <span
                                  className={
                                    isVerified
                                      ? styles.verificationBadgeVerified
                                      : isReview
                                      ? styles.verificationBadgeReview
                                      : styles.verificationBadgeUnverified
                                  }
                                >
                                  {isVerified
                                    ? '✓ VERIFIED'
                                    : isReview
                                    ? '⚠️ NEEDS REVIEW'
                                    : '✕ UNVERIFIED'}
                                </span>
                                <span className={styles.datePill}>
                                  Confidence: {ev.confidenceCategory}
                                </span>
                              </div>

                              {ev.documentId && (
                                <button
                                  type="button"
                                  className={styles.jumpButton}
                                  onClick={() =>
                                    openViewer(
                                      ev.documentId!,
                                      ev.documentTitle || 'Document',
                                      ev.pageNumber || 1
                                    )
                                  }
                                >
                                  📄 {ev.documentTitle || 'Document'} (p.{ev.pageNumber || 1}) →
                                </button>
                              )}
                            </div>

                            {ev.quotedText && (
                              <blockquote className={styles.evidenceQuoteBlock}>
                                &ldquo;{ev.quotedText}&rdquo;
                              </blockquote>
                            )}

                            {ev.sourceReference && (
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                Source Reference: {ev.sourceReference}
                              </span>
                            )}

                            {/* Used By Lineage Chips */}
                            {ev.usedBy && ev.usedBy.length > 0 && (
                              <div className={styles.usedBySection}>
                                <span
                                  style={{
                                    fontSize: '0.74rem',
                                    color: 'var(--text-muted)',
                                    fontWeight: 600,
                                  }}
                                >
                                  Used by Matter Findings:
                                </span>
                                <div className={styles.usedByChips}>
                                  {ev.usedBy.map((ub, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      className={styles.usedByChip}
                                      onClick={() => {
                                        if (ub.type === 'CONSISTENCY') setActiveTab('consistency');
                                        else if (ub.type === 'QUESTION') setActiveTab('questions');
                                        else if (ub.type === 'ACTION_ITEM') setActiveTab('actionPlan');
                                        else if (ub.type === 'RELATIONSHIP') setActiveTab('relationships');
                                        else if (ub.type === 'BRIEF') setActiveTab('prepare');
                                      }}
                                    >
                                      {ub.title} →
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Documents */}
      {activeTab === 'documents' && (
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
      )}

      {/* Tab 3: Timeline */}
      {activeTab === 'timeline' && (
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
                  This occurs when member documents do not contain explicit, verifiable calendar dates or when documents have not yet completed Legal X-Ray analysis. LexiGuide strictly derives timeline milestones from document text and never infers or estimates dates.
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
      )}

      {/* Tab 4: Relationships */}
      {activeTab === 'relationships' && (
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
      )}

      {/* Tab 5: Consistency Check */}
      {activeTab === 'consistency' && (
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
      )}

      {/* Tab 6: Search */}
      {activeTab === 'search' && (
        <div className={styles.tabPane}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Search This Matter</h2>
                <div className={styles.sectionSubtitle}>
                  Server-side search across all page text in member documents. Clicking a result jumps
                  directly to that page.
                </div>
              </div>
            </div>

            <form onSubmit={handleSearch} className={styles.searchBar}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search across all member documents (e.g. notice, indemnity, termination)..."
                className={styles.searchInput}
              />
              <Button type="submit" variant="primary" disabled={isSearching || !searchQuery.trim()}>
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </form>

            {searchResults && (
              <div style={{ marginTop: '1.5rem' }}>
                {searchResults.totalMatches === 0 ? (
                  <div className={styles.emptyState}>
                    <p>No matches found for &ldquo;{searchQuery}&rdquo;.</p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Try adjusting your keywords or searching for broader terms (e.g. &ldquo;notice&rdquo;, &ldquo;payment&rdquo;, &ldquo;liability&rdquo;, &ldquo;termination&rdquo;).
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      style={{ marginTop: '0.5rem' }}
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults(null);
                      }}
                    >
                      Clear Search
                    </Button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      Found {searchResults.totalMatches} match
                      {searchResults.totalMatches === 1 ? '' : 'es'} across{' '}
                      {searchResults.results.length} document
                      {searchResults.results.length === 1 ? '' : 's'}.
                    </div>

                    {searchResults.results.map((docRes) => (
                      <div key={docRes.documentId} style={{ marginBottom: '1.5rem' }}>
                        <h3
                          style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: '#ffffff',
                            marginBottom: '0.5rem',
                          }}
                        >
                          📄 {docRes.documentTitle} ({docRes.matches.length})
                        </h3>

                        {docRes.matches.map((match, idx) => (
                          <div
                            key={idx}
                            className={styles.searchMatchCard}
                            onClick={() =>
                              openViewer(docRes.documentId, docRes.documentTitle, match.pageNumber)
                            }
                          >
                            <div
                              style={{
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                color: 'var(--color-gold, #c8a256)',
                                marginBottom: '0.25rem',
                              }}
                            >
                              Page {match.pageNumber}
                            </div>
                            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                              {match.snippet}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 7: Ask My Matter */}
      {activeTab === 'ask' && (
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
      )}

      {/* Tab 8: Attention Areas */}
      {activeTab === 'attention' && (
        <div className={styles.tabPane}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Aggregated Attention Areas</h2>
                <div className={styles.sectionSubtitle}>
                  High and medium priority clauses across member documents, grouped to reduce
                  duplicate noise.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {matter.documents.map((doc) => (
                <div key={doc.id} className={styles.docItem}>
                  <div className={styles.docItemHeader}>
                    <h3 className={styles.docItemTitle}>{doc.title}</h3>
                    <span className={styles.roleBadge}>{doc.role}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    View complete breakdown and risk clauses directly in Legal X-Ray.
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <LinkButton href={`/analyze/${doc.documentId}`} size="sm" variant="secondary">Open Legal X-Ray →</LinkButton>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 9: Questions for Counsel */}
      {activeTab === 'questions' && (
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
      )}

      {/* Tab 10: Prepare Dossier */}
      {activeTab === 'prepare' && (
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
                              {pt.classification === 'USER_PROVIDED' ? (
                                <span className={styles.verificationBadgeUnverified}>
                                  USER PROVIDED
                                </span>
                              ) : (
                                <span className={styles.verificationBadgeVerified}>
                                  VERIFIED FACT
                                </span>
                              )}
                            </div>
                          </div>
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
      )}

      {/* Tab 11: Notes */}
      {activeTab === 'notes' && (
        <div className={styles.tabPane}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Matter Context & Client Notes</h2>
                <div className={styles.sectionSubtitle}>
                  User-provided context for this matter. Labeled strictly as USER_PROVIDED (never
                  elevated to verified document facts).
                </div>
              </div>
            </div>

            <form onSubmit={handleAddNote} style={{ marginBottom: '2rem' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Note title (e.g. Conversation with recruiter, signing deadline)..."
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  className={styles.searchInput}
                  style={{ width: '100%' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <textarea
                  rows={3}
                  placeholder="Enter details, objectives, or context..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  className={styles.searchInput}
                  style={{ width: '100%', resize: 'vertical' }}
                  required
                />
              </div>
              <Button type="submit" variant="primary" size="sm" disabled={isAddingNote}>
                {isAddingNote ? 'Saving...' : 'Add Note'}
              </Button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {notes.length === 0 ? (
                <div className={styles.emptyState}>No notes added to this matter yet.</div>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className={styles.docItem}>
                    <div className={styles.docItemHeader}>
                      <h4 style={{ margin: 0, color: '#ffffff', fontSize: '0.95rem' }}>
                        {note.title}
                      </h4>
                      <span className={styles.suggestionPill}>USER_PROVIDED</span>
                    </div>
                    <p style={{ margin: '0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      {note.content}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        style={{ color: '#ef4444' }}
                        onClick={() => handleDeleteNote(note.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Side Slide-Over Document Viewer Drawer */}
      {viewerDocId && (
        <aside className={styles.viewerDrawer} aria-label="Document Viewer Drawer">
          <div className={styles.drawerHeader}>
            <h3 className={styles.drawerTitle}>📄 {viewerDocTitle}</h3>
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
              aria-label="Close Viewer"
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
        <div
          className={styles.viewerDrawer}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100%',
            maxWidth: '100%',
            background: 'rgba(5, 8, 15, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddDocModalOpen(false);
          }}
        >
          <div
            style={{
              background: '#111622',
              border: '1px solid rgba(200, 162, 86, 0.35)',
              borderRadius: '14px',
              padding: '1.75rem',
              width: '100%',
              maxWidth: '520px',
            }}
          >
            <h2 style={{ fontSize: '1.3rem', color: '#ffffff', margin: '0 0 1rem 0' }}>
              Add Document to Matter
            </h2>

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
          </div>
        </div>
      )}

      {/* Add Action Item Modal */}
      {isAddActionModalOpen && (
        <div
          className={styles.viewerDrawer}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100%',
            maxWidth: '100%',
            background: 'rgba(5, 8, 15, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddActionModalOpen(false);
          }}
        >
          <div
            style={{
              background: '#111622',
              border: '1px solid rgba(200, 162, 86, 0.35)',
              borderRadius: '14px',
              padding: '1.75rem',
              width: '100%',
              maxWidth: '520px',
            }}
          >
            <h2 style={{ fontSize: '1.3rem', color: '#ffffff', margin: '0 0 1rem 0' }}>
              Create Action Item
            </h2>

            <form onSubmit={handleCreateActionItem}>
              <div style={{ marginBottom: '1rem' }}>
                <label
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
          </div>
        </div>
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
