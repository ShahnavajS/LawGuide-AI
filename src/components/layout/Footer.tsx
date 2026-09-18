import React from 'react';
import Link from 'next/link';
import styles from './Footer.module.css';
import { LEGAL_DISCLAIMERS } from '@/lib/ai/safety';

export const Footer: React.FC = () => {
  return (
    <footer className={styles.footer}>
      <div className="container">
        {/* Mandatory Legal Safety Banner */}
        <div className={styles.safetyBanner}>
          <div className={styles.safetyIcon} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <p className={styles.safetyText}>
            <strong>Legal Notice:</strong> {LEGAL_DISCLAIMERS.GLOBAL_FOOTER}
          </p>
        </div>

        <div className={styles.grid}>
          <div className={styles.brandCol}>
            <span className={styles.brandName}>LexiGuide AI</span>
            <p className={styles.brandDesc}>
              Read complex documents with more clarity. Keep the source close, and bring better questions to a legal professional.
            </p>
          </div>

          <div>
            <h3 className={styles.heading}>Navigate</h3>
            <ul className={styles.list}>
              <li>
                <Link href="/dashboard" className={styles.link}>
                  Document Workspace
                </Link>
              </li>
              <li>
                <Link href="/matters" className={styles.link}>
                  Legal Matters
                </Link>
              </li>
              <li>
                <Link href="/compare" className={styles.link}>
                  Version Compare
                </Link>
              </li>
              <li>
                <Link href="/prepare" className={styles.link}>
                  Prepare for Counsel
                </Link>
              </li>
              <li>
                <Link href="/legal-info" className={styles.link}>
                  Legal Navigator
                </Link>
              </li>
              <li>
                <Link href="/demo" className={styles.link}>
                  Demo
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className={styles.heading}>How to use this</h3>
            <ul className={styles.list}>
              <li>
                <span className={styles.link}>Review the original document</span>
              </li>
              <li>
                <span className={styles.link}>Inspect supporting quotes</span>
              </li>
              <li>
                <span className={styles.link}>Question uncertain findings</span>
              </li>
              <li>
                <span className={styles.link}>Ask qualified counsel</span>
              </li>
            </ul>
          </div>
        </div>

        <div className={styles.bottom}>
          <span>&copy; {new Date().getFullYear()} LexiGuide AI. Built for legal accessibility.</span>
          <span>Legal language, made human.</span>
        </div>
      </div>
    </footer>
  );
};
