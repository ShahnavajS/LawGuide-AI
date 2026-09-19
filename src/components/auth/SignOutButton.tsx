'use client';

import { useState } from 'react';
import { Spinner } from '@/components/ui/Spinner/Spinner';

interface SignOutButtonProps {
  className?: string;
}

export function SignOutButton({ className }: SignOutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleSignOut(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
    } catch {
      // Proceed with redirect regardless
    } finally {
      window.location.href = '/login';
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className={className}
      style={{
        opacity: loading ? 0.7 : 1,
        cursor: loading ? 'wait' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
      }}
    >
      {loading ? (
        <>
          <Spinner size="sm" /> Signing out...
        </>
      ) : (
        'Sign out'
      )}
    </button>
  );
}
