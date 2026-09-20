'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import styles from './NavigationProgress.module.css';
import { Spinner } from '@/components/ui/Spinner/Spinner';

export function NavigationProgress() {
  const pathname = usePathname();
  const [navigating, setNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigatingRef = useRef(false);

  const startProgress = useCallback(() => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    navigatingRef.current = true;
    setNavigating(true);
    setProgress(15);

    let current = 15;
    progressTimerRef.current = setInterval(() => {
      current += Math.max(1, (90 - current) * 0.15);
      if (current >= 90) {
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        setProgress(90);
      } else {
        setProgress(current);
      }
    }, 120);
  }, []);

  // When pathname changes, finish navigation progress smoothly
  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const completionTimer = setTimeout(() => {
      if (!navigatingRef.current) return;
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      setProgress(100);
      hideTimer = setTimeout(() => {
        navigatingRef.current = false;
        setNavigating(false);
        setProgress(0);
      }, 250);
    }, 0);
    return () => {
      clearTimeout(completionTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [pathname]);

  // Listen to clicks on links across the document to immediately trigger progress feedback
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = (event.target as HTMLElement)?.closest('a');
      if (!target) return;

      const href = target.getAttribute('href');
      const isTargetBlank = target.getAttribute('target') === '_blank';
      const isDownload = target.hasAttribute('download');
      const isModified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

      if (!href || isTargetBlank || isDownload || isModified) return;

      // Only trigger for internal links that differ from current location
      if (href.startsWith('/') && !href.startsWith('//')) {
        const url = new URL(href, window.location.origin);
        if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) {
          return; // Hash link on same page
        }
        if (url.pathname !== window.location.pathname || url.search !== window.location.search) {
          startProgress();
        }
      }
    }

    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, [startProgress]);

  useEffect(() => () => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
  }, []);

  if (!navigating) return null;

  return (
    <>
      <div
        className={styles.progressBar}
        style={{
          transform: `scaleX(${progress / 100})`,
          opacity: progress === 100 ? 0 : 1,
        }}
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Loading page"
      />
      <div className={styles.floatingBadge} aria-live="polite">
        <Spinner size="sm" />
        <span>Loading workspace...</span>
      </div>
    </>
  );
}
