import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';
import { Spinner } from '@/components/ui/Spinner/Spinner';

export default function CompareLoading() {
  return (
    <div className="container" style={{ paddingBlock: '3rem', minHeight: '65vh' }} aria-busy="true" aria-label="Loading comparison workspace">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Skeleton variant="text" width="100px" height="13px" style={{ marginBottom: '0.6rem' }} />
          <Skeleton variant="rectangular" width="300px" height="36px" style={{ marginBottom: '0.6rem' }} />
          <Skeleton variant="text" width="420px" height="15px" />
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
          <Spinner size="sm" />
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Loading comparison...</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
        <div style={{ padding: '1.8rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
          <Skeleton variant="text" width="120px" height="14px" style={{ marginBottom: '1.2rem' }} />
          <Skeleton variant="rectangular" width="100%" height="44px" style={{ marginBottom: '1.5rem', borderRadius: '4px' }} />
          <div style={{ display: 'grid', gap: '0.8rem' }}>
            <Skeleton variant="text" width="100%" height="16px" />
            <Skeleton variant="text" width="90%" height="16px" />
            <Skeleton variant="text" width="95%" height="16px" />
            <Skeleton variant="text" width="80%" height="16px" />
          </div>
        </div>
        <div style={{ padding: '1.8rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
          <Skeleton variant="text" width="120px" height="14px" style={{ marginBottom: '1.2rem' }} />
          <Skeleton variant="rectangular" width="100%" height="44px" style={{ marginBottom: '1.5rem', borderRadius: '4px' }} />
          <div style={{ display: 'grid', gap: '0.8rem' }}>
            <Skeleton variant="text" width="100%" height="16px" />
            <Skeleton variant="text" width="92%" height="16px" />
            <Skeleton variant="text" width="88%" height="16px" />
            <Skeleton variant="text" width="85%" height="16px" />
          </div>
        </div>
      </div>
    </div>
  );
}
