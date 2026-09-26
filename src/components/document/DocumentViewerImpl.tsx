'use client';

import { apiFetch } from '@/lib/api/client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import styles from './DocumentViewer.module.css';
import { Button } from '@/components/ui/Button/Button';

// Bundle the worker from the installed pdfjs-dist version in this same module,
// as required by React-PDF. Next emits a version-matched, hashed local asset.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const pdfBytesCache = new Map<string, Promise<Uint8Array>>();
const MAX_CACHED_PDFS = 3;

function getPdfBytes(fileUrl: string): Promise<Uint8Array> {
  const cached = pdfBytesCache.get(fileUrl);
  if (cached) {
    pdfBytesCache.delete(fileUrl);
    pdfBytesCache.set(fileUrl, cached);
    return cached;
  }

  const request = (async () => {
    const response = await apiFetch(fileUrl);
    if (!response.ok) {
      throw new Error(response.status === 404
        ? 'The stored PDF is missing. Remove this record and upload a new copy.'
        : 'The PDF could not be loaded. Please try again.');
    }

    const data = new Uint8Array(await response.arrayBuffer());
    if (new TextDecoder().decode(data.subarray(0, 5)) !== '%PDF-') {
      throw new Error('The stored file is not a valid PDF. Upload a new copy.');
    }
    return data;
  })();

  pdfBytesCache.set(fileUrl, request);
  if (pdfBytesCache.size > MAX_CACHED_PDFS) {
    pdfBytesCache.delete(pdfBytesCache.keys().next().value!);
  }
  void request.catch(() => {
    if (pdfBytesCache.get(fileUrl) === request) pdfBytesCache.delete(fileUrl);
  });
  return request;
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
  const [localPageNumber, setLocalPageNumber] = useState<number>(initialPage);
  const [scale, setScale] = useState<number>(1.0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageInputRef = useRef<HTMLInputElement>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pdfFile = useMemo(() => pdfData ? { data: pdfData } : null, [pdfData]);
  const pageNumber = Math.max(1, Math.min(activePage ?? localPageNumber, numPages ?? Number.MAX_SAFE_INTEGER));

  useEffect(() => {
    let active = true;

    async function loadPdf() {
      setPdfData(null);
      setNumPages(null);
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await getPdfBytes(fileUrl);
        if (active) setPdfData(data);
      } catch (error) {
        if (active) {
          setIsLoading(false);
          setErrorMessage(error instanceof Error ? error.message : 'The PDF could not be loaded.');
        }
      }
    }

    void loadPdf();
    return () => {
      active = false;
    };
  }, [fileUrl, retryKey]);

  // Keep the uncontrolled page field in sync with citation navigation without
  // updating React state during render.
  useEffect(() => {
    if (activePage == null || !pageInputRef.current) return;
    pageInputRef.current.value = String(pageNumber);
  }, [activePage, pageNumber]);

  useEffect(() => {
    if (!pdfFile) return;
    loadTimeoutRef.current = setTimeout(() => {
      setIsLoading((loading) => {
        if (loading) setErrorMessage('The PDF renderer is taking too long to respond. Try loading it again.');
        return false;
      });
    }, 45000);

    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    };
  }, [pdfFile]);

  const handleDocumentLoadSuccess = useCallback(
    ({ numPages: total }: { numPages: number }) => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
      setNumPages(total);
      setIsLoading(false);
      setErrorMessage(null);
      if (onLoadSuccess) {
        onLoadSuccess(total);
      }
    },
    [onLoadSuccess]
  );

  const handleDocumentLoadError = useCallback(() => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    setIsLoading(false);
    setErrorMessage('The PDF could not be displayed. Upload a new copy if the problem persists.');
  }, []);

  const goToPage = useCallback(
    (targetPage: number) => {
      if (!numPages) return;
      const valid = Math.max(1, Math.min(targetPage, numPages));
      setLocalPageNumber(valid);
      if (pageInputRef.current) pageInputRef.current.value = String(valid);
      if (onPageChange) {
        onPageChange(valid, numPages);
      }
    },
    [numPages, onPageChange]
  );

  const changePage = useCallback(
    (offset: number) => goToPage(pageNumber + offset),
    [goToPage, pageNumber]
  );

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(pageInputRef.current?.value || '', 10);
    if (!isNaN(parsed)) {
      goToPage(parsed);
    } else {
      if (pageInputRef.current) pageInputRef.current.value = String(pageNumber);
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
                defaultValue={String(initialPage)}
                ref={pageInputRef}
                onBlur={() => {
                  if (pageInputRef.current) pageInputRef.current.value = String(pageNumber);
                }}
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
                pdfBytesCache.delete(fileUrl);
                setPdfData(null);
                setNumPages(null);
                setIsLoading(true);
                setErrorMessage(null);
                setRetryKey((key) => key + 1);
              }}
            >
              Retry
            </Button>
          </div>
        ) : pdfFile ? (
          <div className={styles.documentStage}>
            <Document
              file={pdfFile}
              onLoadSuccess={handleDocumentLoadSuccess}
              onLoadError={handleDocumentLoadError}
              loading={null}
              error={null}
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
            {isLoading && (
              <div className={styles.loadingOverlay} role="status" aria-live="polite">
                <div className={styles.spinner} />
                <span className={styles.loadingText}>Rendering PDF document...</span>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.loadingContainer} aria-live="polite">
            <div className={styles.spinner} />
            <span className={styles.loadingText}>Loading PDF document...</span>
          </div>
        )}
      </div>
    </div>
  );
};
