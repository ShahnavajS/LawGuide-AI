'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Header.module.css';
import buttonStyles from '@/components/ui/Button/Button.module.css';

const NAV_ITEMS = [
  { label: 'Documents', href: '/dashboard' },
  { label: 'Matters', href: '/matters' },
  { label: 'Compare', href: '/compare' },
  { label: 'Prepare', href: '/prepare' },
  { label: 'Legal Navigator', href: '/legal-info' },
  { label: 'Demo', href: '/demo' },
];

export const Header: React.FC = () => {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname.startsWith('/analyze');
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <header className={styles.header}>
      <div className={`container ${styles.navContainer}`}>
        <Link href="/" className={styles.brandLink} onClick={() => setMobileOpen(false)}>
          <div className={styles.brandLogo} aria-hidden="true">
            L
          </div>
          <div className={styles.brandTextGroup}>
            <span className={styles.brandName}>LexiGuide<span> / </span>AI</span>
            <span className={styles.brandTagline}>Read with clarity</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav aria-label="Main Navigation" className={styles.desktopNav}>
          <ul className={styles.navLinks}>
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`${styles.navLink} ${isActive(item.href) ? styles.navLinkActive : ''}`}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.navActions}>
          {process.env.NODE_ENV === 'production' && pathname !== '/login' && (
            <form method="post" action="/api/auth/logout" className={styles.ctaDesktop}>
              <button type="submit" className={`${buttonStyles.button} ${buttonStyles.ghost} ${buttonStyles.sm}`}>Sign out</button>
            </form>
          )}
          <Link href="/dashboard" className={`${styles.ctaDesktop} ${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.sm}`}>
            Analyze a Document
          </Link>

          {/* Mobile Hamburger */}
          <button
            type="button"
            className={styles.mobileMenuBtn}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            {mobileOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Nav Panel */}
      {mobileOpen && (
        <nav className={styles.mobileNav} aria-label="Mobile Navigation">
          <ul className={styles.mobileNavLinks}>
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`${styles.mobileNavLink} ${isActive(item.href) ? styles.mobileNavLinkActive : ''}`}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/dashboard" className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.sm}`} onClick={() => setMobileOpen(false)}>
                Analyze a Document
              </Link>
            </li>
            {process.env.NODE_ENV === 'production' && pathname !== '/login' && <li><form method="post" action="/api/auth/logout"><button type="submit" className={styles.mobileNavLink}>Sign out</button></form></li>}
          </ul>
        </nav>
      )}
    </header>
  );
};
