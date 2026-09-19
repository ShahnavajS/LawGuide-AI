import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';
import { Spinner } from '@/components/ui/Spinner/Spinner';

export default function RootLoading() {
  return (
    <div className="container" style={{ paddingBlock: '3.5rem', minHeight: '65vh' }} aria-busy="true" aria-label="Loading content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Skeleton variant="text" width="120px" height="14px" style={{ marginBottom: '0.8rem' }} />
          <Skeleton variant="rectangular" width="340px" height="38px" style={{ marginBottom: '0.8rem' }} />
          <Skeleton variant="text" width="480px" height="16px" />
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 1rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
          <Spinner size="sm" />
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Loading workspace...</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '2.5rem' }}>
        <div style={{ padding: '1.8rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
          <Skeleton variant="text" width="80px" height="12px" style={{ marginBottom: '1rem' }} />
          <Skeleton variant="rectangular" width="100%" height="22px" style={{ marginBottom: '1rem' }} />
          <Skeleton variant="text" width="100%" height="14px" />
          <Skeleton variant="text" width="85%" height="14px" />
          <Skeleton variant="text" width="70%" height="14px" style={{ marginBottom: '1.5rem' }} />
          <Skeleton variant="rectangular" width="100%" height="40px" />
        </div>
        <div style={{ padding: '1.8rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
          <Skeleton variant="text" width="80px" height="12px" style={{ marginBottom: '1rem' }} />
          <Skeleton variant="rectangular" width="100%" height="22px" style={{ marginBottom: '1rem' }} />
          <Skeleton variant="text" width="100%" height="14px" />
          <Skeleton variant="text" width="90%" height="14px" />
          <Skeleton variant="text" width="60%" height="14px" style={{ marginBottom: '1.5rem' }} />
          <Skeleton variant="rectangular" width="100%" height="40px" />
        </div>
        <div style={{ padding: '1.8rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
          <Skeleton variant="text" width="80px" height="12px" style={{ marginBottom: '1rem' }} />
          <Skeleton variant="rectangular" width="100%" height="22px" style={{ marginBottom: '1rem' }} />
          <Skeleton variant="text" width="100%" height="14px" />
          <Skeleton variant="text" width="75%" height="14px" />
          <Skeleton variant="text" width="65%" height="14px" style={{ marginBottom: '1.5rem' }} />
          <Skeleton variant="rectangular" width="100%" height="40px" />
        </div>
      </div>
    </div>
  );
}
