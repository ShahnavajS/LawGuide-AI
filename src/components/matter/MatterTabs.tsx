'use client';

import type { KeyboardEvent } from 'react';
import styles from './MatterWorkspace.module.css';

export type MatterTabId =
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

export const MATTER_TAB_TITLES: Record<MatterTabId, string> = {
  overview: 'Overview',
  actionPlan: 'Action Plan',
  sourceMap: 'Source Map',
  documents: 'Documents',
  timeline: 'Timeline',
  relationships: 'Relationships',
  consistency: 'Consistency',
  search: 'Search Matter',
  ask: 'Ask My Matter',
  attention: 'Attention Areas',
  questions: 'Lawyer Questions',
  prepare: 'Prepare Dossier',
  notes: 'Notes',
};

const TAB_IDS = Object.keys(MATTER_TAB_TITLES) as MatterTabId[];

interface MatterTabsProps {
  activeTab: MatterTabId;
  counts: Partial<Record<MatterTabId, number | undefined>>;
  onSelect: (tab: MatterTabId) => void;
}

export function MatterTabs({ activeTab, counts, onSelect }: MatterTabsProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = TAB_IDS.indexOf(activeTab);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? TAB_IDS.length - 1
        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + TAB_IDS.length) % TAB_IDS.length;
    const nextTab = TAB_IDS[nextIndex];
    onSelect(nextTab);
    document.getElementById(`matter-tab-${nextTab}`)?.focus();
  }

  return (
    <nav className={styles.tabsNav} role="tablist" aria-label="Matter workspace sections">
      {TAB_IDS.map((tabId) => {
        const count = counts[tabId];
        return (
          <button
            key={tabId}
            type="button"
            role="tab"
            id={`matter-tab-${tabId}`}
            aria-controls={`matter-panel-${tabId}`}
            aria-selected={activeTab === tabId}
            tabIndex={activeTab === tabId ? 0 : -1}
            className={`${styles.tabButton} ${activeTab === tabId ? styles.tabButtonActive : ''}`}
            onClick={() => onSelect(tabId)}
            onKeyDown={handleKeyDown}
          >
            <span>{MATTER_TAB_TITLES[tabId]}</span>
            {count !== undefined && count > 0 && <span className={styles.badgeCount}>{count}</span>}
          </button>
        );
      })}
    </nav>
  );
}
