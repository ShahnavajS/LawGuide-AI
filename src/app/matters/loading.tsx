import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';
import { Spinner } from '@/components/ui/Spinner/Spinner';

export default function MattersLoading() {
  return (
    <div className="container" style={{ paddingBlock: '3rem', minHeight: '65vh' }} aria-busy="true" aria-label="Loading matters">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Skeleton variant="text" width="90px" height="13px" style={{ marginBottom: '0.6rem' }} />
          <Skeleton variant="rectangular" width="260px" height="36px" style={{ marginBottom: '0.6rem' }} />
          <Skeleton variant="text" width="380px" height="15px" />
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
          <Spinner size="sm" />
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Loading matters...</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ padding: '1.6rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <Skeleton variant="text" width="70px" height="12px" />
              <Skeleton variant="rectangular" width="60px" height="20px" style={{ borderRadius: '12px' }} />
            </div>
            <Skeleton variant="rectangular" width="85%" height="22px" style={{ marginBottom: '0.8rem' }} />
            <Skeleton variant="text" width="100%" height="14px" />
            <Skeleton variant="text" width="60%" height="14px" style={{ marginBottom: '1.5rem' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton variant="text" width="90px" height="12px" />
              <Skeleton variant="rectangular" width="80px" height="28px" style={{ borderRadius: '4px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
