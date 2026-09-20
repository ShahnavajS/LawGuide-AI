'use client';

import { apiFetch } from '@/lib/api/client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Header.module.css';
import buttonStyles from '@/components/ui/Button/Button.module.css';
import { SignOutButton } from '@/components/auth/SignOutButton';

interface HeaderUser { name: string; email: string; isDemo: boolean }

const PUBLIC_NAV = [
  { label: 'Legal Navigator', href: '/legal-info' },
  { label: 'Demo', href: '/demo' },
];

const WORKSPACE_NAV = [
  { label: 'Documents', href: '/dashboard' },
  { label: 'Matters', href: '/matters' },
  { label: 'Compare', href: '/compare' },
  { label: 'Prepare', href: '/prepare' },
  ...PUBLIC_NAV,
];

export const Header: React.FC = () => {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<HeaderUser | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    apiFetch('/api/auth/me', { cache: 'no-store', signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => setUser(payload?.user || null))
      .catch(() => undefined);
    return () => controller.abort();
  }, [pathname]);

  const navItems = user ? WORKSPACE_NAV : PUBLIC_NAV;
  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname.startsWith('/analyze');
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header className={styles.header}>
      <div className={`container ${styles.navContainer}`}>
        <Link href="/" className={styles.brandLink} onClick={() => setMobileOpen(false)}>
          <div className={styles.brandLogo} aria-hidden="true">L</div>
          <div className={styles.brandTextGroup}>
            <span className={styles.brandName}>LawGuide<span> / </span>AI</span>
            <span className={styles.brandTagline}>Read with clarity</span>
          </div>
        </Link>

        <nav aria-label="Main navigation" className={styles.desktopNav}>
          <ul className={styles.navLinks}>
            {navItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={`${styles.navLink} ${isActive(item.href) ? styles.navLinkActive : ''}`} aria-current={isActive(item.href) ? 'page' : undefined}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.navActions}>
          {user ? (
            <>
              <Link href="/account" className={`${styles.accountLink} ${styles.ctaDesktop}`} aria-label={`Account for ${user.name}`}>
                <span aria-hidden="true">{user.name.trim().charAt(0).toUpperCase()}</span>
                {user.isDemo ? 'Demo account' : 'Account'}
              </Link>
              <Link href="/dashboard" className={`${styles.ctaDesktop} ${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.sm}`}>Analyze a document</Link>
            </>
          ) : (
            <>
              <Link href="/login" className={`${styles.ctaDesktop} ${buttonStyles.button} ${buttonStyles.ghost} ${buttonStyles.sm}`}>Sign in</Link>
              <Link href="/signup" className={`${styles.ctaDesktop} ${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.sm}`}>Create account</Link>
            </>
          )}
          <button type="button" className={styles.mobileMenuBtn} aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}>
            {mobileOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className={styles.mobileNav} aria-label="Mobile navigation">
          <ul className={styles.mobileNavLinks}>
            {navItems.map((item) => (
              <li key={item.href}><Link href={item.href} className={`${styles.mobileNavLink} ${isActive(item.href) ? styles.mobileNavLinkActive : ''}`} aria-current={isActive(item.href) ? 'page' : undefined} onClick={() => setMobileOpen(false)}>{item.label}</Link></li>
            ))}
            {user ? (
              <>
                <li><Link href="/account" className={styles.mobileNavLink} onClick={() => setMobileOpen(false)}>Account · {user.name}</Link></li>
                <li><SignOutButton className={styles.mobileNavLink} /></li>
              </>
            ) : (
              <>
                <li><Link href="/login" className={styles.mobileNavLink} onClick={() => setMobileOpen(false)}>Sign in</Link></li>
                <li><Link href="/signup" className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.sm}`} onClick={() => setMobileOpen(false)}>Create account</Link></li>
              </>
            )}
          </ul>
        </nav>
      )}
    </header>
  );
};
