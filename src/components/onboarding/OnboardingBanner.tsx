'use client';

import React, { useSyncExternalStore } from 'react';
import Link from 'next/link';
import styles from './OnboardingBanner.module.css';

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  icon: React.ReactNode;
}

const STEPS: OnboardingStep[] = [
  {
    id: 1,
    title: 'Upload a Document',
    description: 'Drag-and-drop or select a PDF contract, lease, NDA, or agreement.',
    actionLabel: 'Go to Documents',
    actionHref: '/dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    id: 2,
    title: 'Run Legal X-Ray',
    description: 'Open the document workspace and click "Run Analysis" to extract clauses and obligations.',
    actionLabel: 'Open Workspace',
    actionHref: '/dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    id: 3,
    title: 'Ask Your Document',
    description: 'Use the Q&A tab to ask natural-language questions. Supported answers show the exact page and quote used.',
    actionLabel: 'See How',
    actionHref: '/dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: 4,
    title: 'Create a Matter',
    description: 'Group related documents under a Matter for cross-document intelligence and counsel prep.',
    actionLabel: 'View Matters',
    actionHref: '/matters',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

const STORAGE_KEY = 'lexiguide_onboarding_dismissed';

/**
 * Custom localStorage subscription for useSyncExternalStore.
 * Subscribes to storage events so the banner reacts to changes from other tabs.
 */
function subscribeToStorage(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getIsDismissed(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

function getIsDismissedServer(): boolean {
  return true; // On the server, treat as dismissed to avoid flash
}

interface OnboardingBannerProps {
  documentCount: number;
}

export const OnboardingBanner: React.FC<OnboardingBannerProps> = ({ documentCount }) => {
  // useSyncExternalStore is the ESLint-compliant way to read external storage
  const isDismissed = useSyncExternalStore(
    subscribeToStorage,
    getIsDismissed,
    getIsDismissedServer,
  );

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    // Dispatch storage event to trigger useSyncExternalStore re-render
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
  };

  // Compute completed steps
  const completedSteps = documentCount > 0 ? 1 : 0;
  const progressPct = Math.round((completedSteps / STEPS.length) * 100);

  if (isDismissed) return null;

  return (
    <div className={styles.banner} role="region" aria-label="Getting started guide">
      <div className={styles.bannerHeader}>
        <div className={styles.bannerTitleGroup}>
          <span className={styles.bannerEyebrow}>Getting Started</span>
          <h2 className={styles.bannerTitle}>Welcome to LexiGuide AI</h2>
          <p className={styles.bannerSubtitle}>
            Follow these steps to get the most out of your legal workspace.
          </p>
        </div>
        <div className={styles.bannerHeaderRight}>
          <div className={styles.progressGroup}>
            <span className={styles.progressLabel}>
              {completedSteps} of {STEPS.length} steps complete
            </span>
            <div className={styles.progressTrack} role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
              <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <button
            type="button"
            className={styles.dismissBtn}
            onClick={handleDismiss}
            aria-label="Dismiss getting started guide"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className={styles.steps}>
        {STEPS.map((step, index) => {
          const isComplete = index < completedSteps;
          const isCurrent = index === completedSteps;
          return (
            <div
              key={step.id}
              className={`${styles.step} ${isComplete ? styles.stepComplete : ''} ${isCurrent ? styles.stepCurrent : ''}`}
            >
              <div className={styles.stepIcon} aria-hidden="true">
                {isComplete ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  step.icon
                )}
              </div>
              <div className={styles.stepContent}>
                <div className={styles.stepNum}>Step {step.id}</div>
                <div className={styles.stepTitle}>{step.title}</div>
                <p className={styles.stepDesc}>{step.description}</p>
                {!isComplete && (
                  <Link href={step.actionHref} className={styles.stepLink}>
                    {step.actionLabel} →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
