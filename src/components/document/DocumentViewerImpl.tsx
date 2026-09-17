'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import styles from './DocumentViewer.module.css';
import { Button } from '@/components/ui/Button/Button';

// Configure pdfjs worker to unpkg CDN matching the current pdfjs version only on the client
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

export interface DocumentViewerProps {
  fileUrl: string;
  initialPage?: number;
  activePage?: number;
  onPageChange?: (page: number, totalPages: number) => void;
  onLoadSuccess?: (totalPages: number) => void;
  className?: string;
}

export const DocumentViewerImpl: React.FC<DocumentViewerProps> = ({
  fileUrl,
  initialPage = 1,
  activePage,
  onPageChange,
  onLoadSuccess,
  className,
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(initialPage);
  const [scale, setScale] = useState<number>(1.0);
  const [pageInputValue, setPageInputValue] = useState<string>(String(initialPage));
  const [prevActivePage, setPrevActivePage] = useState<number | undefined>(activePage);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Adjust state directly during rendering when activePage prop changes (React recommended pattern)
  if (activePage !== prevActivePage) {
    setPrevActivePage(activePage);
    if (activePage != null && numPages != null && activePage > 0) {
      const valid = Math.max(1, Math.min(activePage, numPages));
      setPageNumber(valid);
      setPageInputValue(String(valid));
    }
  }

  const handleDocumentLoadSuccess = useCallback(
    ({ numPages: total }: { numPages: number }) => {
      setNumPages(total);
      setIsLoading(false);
      setErrorMessage(null);
      if (onLoadSuccess) {
        onLoadSuccess(total);
      }
    },
    [onLoadSuccess]
  );

  const handleDocumentLoadError = useCallback((err: Error) => {
    setIsLoading(false);
    setErrorMessage(err.message || 'Failed to load PDF document.');
  }, []);

  const changePage = useCallback(
    (offset: number) => {
      setPageNumber((prev) => {
        const next = Math.max(1, Math.min(prev + offset, numPages || 1));
        setPageInputValue(String(next));
        if (onPageChange && numPages) {
          onPageChange(next, numPages);
        }
        return next;
      });
    },
    [numPages, onPageChange]
  );

  const goToPage = useCallback(
    (targetPage: number) => {
      if (!numPages) return;
      const valid = Math.max(1, Math.min(targetPage, numPages));
      setPageNumber(valid);
      setPageInputValue(String(valid));
      if (onPageChange) {
        onPageChange(valid, numPages);
      }
    },
    [numPages, onPageChange]
  );

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(pageInputValue, 10);
    if (!isNaN(parsed)) {
      goToPage(parsed);
    } else {
      setPageInputValue(String(pageNumber));
    }
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 2.5));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.6));
  };

  const handleZoomReset = () => {
    setScale(1.0);
  };

  // Keyboard navigation when viewer container or canvas has focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return;

      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        changePage(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        changePage(1);
      } else if (e.key === '+' || (e.ctrlKey && e.key === '=')) {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || (e.ctrlKey && e.key === '-')) {
        e.preventDefault();
        handleZoomOut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changePage]);

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${className || ''}`}
      tabIndex={0}
      aria-label="Interactive PDF Document Viewer"
    >
      {/* Viewer Navigation & Zoom Toolbar */}
      <div className={styles.toolbar} role="toolbar" aria-label="PDF navigation controls">
        <div className={styles.toolbarGroup}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => changePage(-1)}
            disabled={pageNumber <= 1 || isLoading}
            aria-label="Previous page"
            title="Previous page (Left Arrow)"
          >
            Previous
          </Button>

          <div className={styles.pageIndicator}>
            <span>Page</span>
            <form onSubmit={handlePageInputSubmit} className={styles.pageInputForm}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label="Current page number"
                className={styles.pageInput}
                value={pageInputValue}
                onChange={(e) => setPageInputValue(e.target.value)}
                onBlur={() => setPageInputValue(String(pageNumber))}
                disabled={isLoading || !numPages}
              />
            </form>
            <span>of {numPages || '–'}</span>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => changePage(1)}
            disabled={!numPages || pageNumber >= numPages || isLoading}
            aria-label="Next page"
            title="Next page (Right Arrow)"
          >
            Next
          </Button>
        </div>

        <div className={styles.toolbarGroup}>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleZoomOut}
            disabled={scale <= 0.6 || isLoading}
            aria-label="Zoom out"
            title="Zoom out"
          >
            –
          </Button>
          <span className={styles.zoomLabel} aria-label={`Current zoom level ${Math.round(scale * 100)} percent`}>
            {Math.round(scale * 100)}%
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleZoomIn}
            disabled={scale >= 2.5 || isLoading}
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleZoomReset}
            disabled={isLoading || scale === 1.0}
            aria-label="Reset zoom to 100 percent"
            title="Reset Zoom"
          >
            Reset
          </Button>
        </div>
      </div>

      {/* PDF Canvas Viewport */}
      <div className={styles.canvasWrapper} tabIndex={0} aria-label="PDF Document Canvas">
        {errorMessage ? (
          <div className={styles.errorContainer} role="alert">
            <h4 className={styles.errorTitle}>Unable to display PDF</h4>
            <p className={styles.errorMessage}>{errorMessage}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setErrorMessage(null);
                setIsLoading(true);
              }}
            >
              Retry
            </Button>
          </div>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={handleDocumentLoadError}
            loading={
              <div className={styles.loadingContainer} aria-live="polite">
                <div className={styles.spinner} />
                <span className={styles.loadingText}>Loading PDF document...</span>
              </div>
            }
            error={
              <div className={styles.errorContainer} role="alert">
                <h4 className={styles.errorTitle}>Error loading PDF</h4>
                <p className={styles.errorMessage}>Failed to load document content.</p>
              </div>
            }
          >
            {numPages && (
              <div className={styles.pageWrapper}>
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  renderAnnotationLayer={true}
                  renderTextLayer={true}
                  loading={
                    <div className={styles.loadingContainer}>
                      <div className={styles.spinner} />
                    </div>
                  }
                />
              </div>
            )}
          </Document>
        )}
      </div>
    </div>
  );
};
