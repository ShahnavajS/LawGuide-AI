import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';
import { Spinner } from '@/components/ui/Spinner/Spinner';

export default function AccountLoading() {
  return (
    <div className="container" style={{ paddingBlock: '4rem', minHeight: '65vh', maxWidth: '700px' }} aria-busy="true" aria-label="Loading account profile">
      <div style={{ marginBottom: '2rem' }}>
        <Skeleton variant="text" width="80px" height="12px" style={{ marginBottom: '0.6rem' }} />
        <Skeleton variant="rectangular" width="280px" height="36px" style={{ marginBottom: '0.6rem' }} />
        <Skeleton variant="text" width="380px" height="15px" />
      </div>

      <div style={{ padding: '2rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <Skeleton variant="text" width="90px" height="12px" />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Spinner size="sm" />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Loading...</span>
          </div>
        </div>

        <Skeleton variant="rectangular" width="200px" height="28px" style={{ marginBottom: '1.5rem' }} />

        <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <Skeleton variant="text" width="50px" height="12px" style={{ marginBottom: '0.3rem' }} />
            <Skeleton variant="text" width="180px" height="16px" />
          </div>
          <div>
            <Skeleton variant="text" width="70px" height="12px" style={{ marginBottom: '0.3rem' }} />
            <Skeleton variant="text" width="160px" height="16px" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
          <Skeleton variant="rectangular" width="130px" height="40px" style={{ borderRadius: '4px' }} />
          <Skeleton variant="rectangular" width="100px" height="40px" style={{ borderRadius: '4px' }} />
        </div>
      </div>
    </div>
  );
}
