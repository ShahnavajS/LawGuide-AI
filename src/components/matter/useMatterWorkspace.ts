'use client';

import { apiFetch } from '@/lib/api/client';
import React, { useState, useEffect, useRef } from 'react';
import { MATTER_TAB_TITLES, type MatterTabId } from './MatterTabs';
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
import { MatterDocumentRole, ActionItemStatus, ActionItemPriority, ActionItemType } from '@/lib/ai/safety';

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

export function useMatterWorkspace(matterId: string) {
  const [matter, setMatter] = useState<MatterDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tabError, setTabError] = useState<string | null>(null);
  const [tabRetry, setTabRetry] = useState(0);
  const loadedTabs = useRef(new Set<string>());
  const [activeTab, setActiveTab] = useState<MatterTabId>('overview');
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
  const [isLoadingSourceMap, setIsLoadingSourceMap] = useState<boolean>(true);

  useEffect(() => {
    loadedTabs.current.clear();
  }, [refreshTrigger]);

  // 1. Fetch Matter Details & Core Phase 9/10 Data
  useEffect(() => {
    if (!matterId) return;
    let ignore = false;

    async function loadMatterDetails() {
      try {
        const res = await apiFetch(`/api/matters/${matterId}`);
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
        const [actRes, readRes, actTrailRes] = await Promise.all([
          apiFetch(`/api/matters/${matterId}/action-items`),
          apiFetch(`/api/matters/${matterId}/readiness`),
          apiFetch(`/api/matters/${matterId}/activity?limit=20`),
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
    const loaders: Partial<Record<MatterTabId, { url: string; apply: (data: Record<string, unknown>) => void }>> = {
      timeline: { url: `/api/matters/${matterId}/timeline`, apply: (data) => setTimeline((data.timeline as MatterTimelineEvent[]) || []) },
      relationships: { url: `/api/matters/${matterId}/relationships`, apply: (data) => setRelationships((data.relationships as DocumentRelationshipItem[]) || []) },
      consistency: { url: `/api/matters/${matterId}/consistency`, apply: (data) => setConsistency((data.findings as ConsistencyFinding[]) || []) },
      notes: { url: `/api/matters/${matterId}/notes`, apply: (data) => setNotes((data.notes as MatterNote[]) || []) },
      actionPlan: { url: `/api/matters/${matterId}/action-items`, apply: (data) => setActionItems((data.items as MatterActionItem[]) || []) },
      prepare: { url: `/api/matters/${matterId}/brief`, apply: (data) => setMatterBrief((data.brief as MatterBriefResponse) || null) },
    };
    const loader = loaders[activeTab];
    const cacheKey = `${matterId}:${activeTab}:${refreshTrigger}`;
    if (!loader || loadedTabs.current.has(cacheKey)) return;

    const controller = new AbortController();
    apiFetch(loader.url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not load ${MATTER_TAB_TITLES[activeTab].toLowerCase()}.`);
        return response.json() as Promise<Record<string, unknown>>;
      })
      .then((data) => {
        loader.apply(data);
        loadedTabs.current.add(cacheKey);
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
          setTabError(requestError instanceof Error ? requestError.message : 'Could not load this section.');
        }
      });
    return () => controller.abort();
  }, [matterId, activeTab, refreshTrigger, tabRetry]);

  useEffect(() => {
    if (!matterId || activeTab !== 'sourceMap') return;
    let ignore = false;
    const controller = new AbortController();
    apiFetch(`/api/matters/${matterId}/source-map`, { signal: controller.signal }).then(async (mapResponse) => {
      if (!mapResponse.ok) throw new Error('Could not load the source map.');
      if (mapResponse.ok) {
        const data = (await mapResponse.json()) as MatterSourceMapResponse;
        if (!ignore) {
          setSourceMapData(data);
          setEvidenceLedger(data.evidenceItems);
          if (data.documents.length > 0) {
            setSelectedSourceDocId((prev) => prev || data.documents[0].documentId);
            const firstWithEvidence = data.documents.find((doc) => doc.pagesWithEvidence.length > 0);
            setSelectedSourcePage((prev) => prev || firstWithEvidence?.pagesWithEvidence[0]?.pageNumber || 1);
          }
        }
      }
    }).catch((requestError: unknown) => {
      if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
        setTabError(requestError instanceof Error ? requestError.message : 'Could not load the source map.');
      }
    }).finally(() => {
      if (!ignore) setIsLoadingSourceMap(false);
    });
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [matterId, activeTab, refreshTrigger, tabRetry]);

  // Phase 9 Handlers: Action Items
  const handleToggleActionItemStatus = async (item: MatterActionItem) => {
    const nextStatus: ActionItemStatus = item.status === 'COMPLETED' ? 'OPEN' : 'COMPLETED';
    try {
      const res = await apiFetch(`/api/matters/${matterId}/action-items/${item.id}`, {
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
      const res = await apiFetch(`/api/matters/${matterId}/action-items/${itemId}`, {
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
      const res = await apiFetch(`/api/matters/${matterId}/action-items/generate`, {
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
      const res = await apiFetch(`/api/matters/${matterId}/action-items`, {
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
      const res = await apiFetch(`/api/matters/${matterId}/counsel-questions/generate`, {
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
      const res = await apiFetch(`/api/matters/${matterId}/action-items`, {
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
      const res = await apiFetch(`/api/matters/${matterId}/brief`, {
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
      const res = await apiFetch(
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
      const res = await apiFetch(`/api/matters/${matterId}/query`, {
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
      const res = await apiFetch('/api/documents');
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
      const res = await apiFetch(`/api/matters/${matterId}/documents`, {
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
      const res = await apiFetch(`/api/matters/${matterId}/documents/${docId}`, {
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
      const res = await apiFetch(`/api/matters/${matterId}/relationships/${relId}`, {
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
      const res = await apiFetch(`/api/matters/${matterId}/relationships/refresh`, {
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
      const res = await apiFetch(`/api/matters/${matterId}/notes`, {
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
      const res = await apiFetch(`/api/matters/${matterId}/notes/${noteId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete note.');
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error deleting note');
    }
  };

  return {
    matterId,
    matter,
    setMatter,
    loading,
    setLoading,
    error,
    setError,
    tabError,
    setTabError,
    tabRetry,
    setTabRetry,
    loadedTabs,
    activeTab,
    setActiveTab,
    copiedQuestionId,
    setCopiedQuestionId,
    timeline,
    setTimeline,
    relationships,
    setRelationships,
    consistency,
    setConsistency,
    notes,
    setNotes,
    actionItems,
    setActionItems,
    actionFilterStatus,
    setActionFilterStatus,
    actionFilterPriority,
    setActionFilterPriority,
    isGeneratingActions,
    setIsGeneratingActions,
    isAddActionModalOpen,
    setIsAddActionModalOpen,
    newActionTitle,
    setNewActionTitle,
    newActionDesc,
    setNewActionDesc,
    newActionType,
    setNewActionType,
    newActionPriority,
    setNewActionPriority,
    isAddingAction,
    setIsAddingAction,
    readiness,
    setReadiness,
    activities,
    setActivities,
    counselQuestions,
    setCounselQuestions,
    isGeneratingCounselQuestions,
    setIsGeneratingCounselQuestions,
    matterBrief,
    setMatterBrief,
    isGeneratingBrief,
    setIsGeneratingBrief,
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    isSearching,
    setIsSearching,
    qaQuestion,
    setQaQuestion,
    qaResponse,
    setQaResponse,
    isAsking,
    setIsAsking,
    newNoteTitle,
    setNewNoteTitle,
    newNoteContent,
    setNewNoteContent,
    isAddingNote,
    setIsAddingNote,
    isAddDocModalOpen,
    setIsAddDocModalOpen,
    allAvailableDocs,
    setAllAvailableDocs,
    selectedDocId,
    setSelectedDocId,
    selectedRole,
    setSelectedRole,
    isAddingDoc,
    setIsAddingDoc,
    viewerDocId,
    setViewerDocId,
    viewerDocTitle,
    setViewerDocTitle,
    viewerPage,
    setViewerPage,
    conceptModalTopic,
    setConceptModalTopic,
    isRefreshingRels,
    setIsRefreshingRels,
    refreshTrigger,
    setRefreshTrigger,
    sourceMapData,
    setSourceMapData,
    evidenceLedger,
    setEvidenceLedger,
    sourceMapViewMode,
    setSourceMapViewMode,
    selectedSourceDocId,
    setSelectedSourceDocId,
    selectedSourcePage,
    setSelectedSourcePage,
    evidenceFilterClassification,
    setEvidenceFilterClassification,
    evidenceFilterVerification,
    setEvidenceFilterVerification,
    evidenceFilterDocId,
    setEvidenceFilterDocId,
    evidenceSearchQuery,
    setEvidenceSearchQuery,
    isLoadingSourceMap,
    setIsLoadingSourceMap,
    handleToggleActionItemStatus,
    handleDeleteActionItem,
    handleGenerateActionItems,
    handleCreateActionItem,
    handleGenerateCounselQuestions,
    handleConvertQuestionToAction,
    handleCopyQuestion,
    handleGenerateMatterBrief,
    openViewer,
    closeViewer,
    handleSearch,
    handleAsk,
    handleOpenAddDocModal,
    handleAddDocument,
    handleRemoveDocument,
    handleUpdateRelationshipStatus,
    handleRefreshRelationships,
    handleAddNote,
    handleDeleteNote
  };
}

export type MatterWorkspaceModel = ReturnType<typeof useMatterWorkspace>;
