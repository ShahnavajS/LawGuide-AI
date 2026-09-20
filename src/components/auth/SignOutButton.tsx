'use client';

import { apiFetch } from '@/lib/api/client';

import { useState } from 'react';
import { Spinner } from '@/components/ui/Spinner/Spinner';
import { useRouter } from 'next/navigation';

interface SignOutButtonProps {
  className?: string;
}

export function SignOutButton({ className }: SignOutButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignOut(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
    } catch {
      // Proceed with redirect regardless
    } finally {
      router.replace('/login');
      router.refresh();
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
