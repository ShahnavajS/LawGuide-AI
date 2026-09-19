import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';
import { Spinner } from '@/components/ui/Spinner/Spinner';

export default function PrepareLoading() {
  return (
    <div className="container" style={{ paddingBlock: '3rem', minHeight: '65vh' }} aria-busy="true" aria-label="Loading preparation workspace">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Skeleton variant="text" width="110px" height="13px" style={{ marginBottom: '0.6rem' }} />
          <Skeleton variant="rectangular" width="320px" height="36px" style={{ marginBottom: '0.6rem' }} />
          <Skeleton variant="text" width="460px" height="15px" />
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
          <Spinner size="sm" />
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Loading preparation...</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: '2rem', marginTop: '2rem' }}>
        <div style={{ padding: '1.6rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
          <Skeleton variant="text" width="90px" height="12px" style={{ marginBottom: '1rem' }} />
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <Skeleton variant="rectangular" width="18px" height="18px" style={{ borderRadius: '3px' }} />
                <Skeleton variant="text" width="85%" height="14px" />
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '1.8rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
          <Skeleton variant="text" width="140px" height="14px" style={{ marginBottom: '1rem' }} />
          <Skeleton variant="rectangular" width="100%" height="28px" style={{ marginBottom: '1rem' }} />
          <div style={{ display: 'grid', gap: '0.8rem' }}>
            <Skeleton variant="text" width="100%" height="15px" />
            <Skeleton variant="text" width="95%" height="15px" />
            <Skeleton variant="text" width="88%" height="15px" />
            <Skeleton variant="text" width="92%" height="15px" />
          </div>
        </div>
      </div>
    </div>
  );
}
