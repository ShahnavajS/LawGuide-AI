import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';
import { Spinner } from '@/components/ui/Spinner/Spinner';

export default function DashboardLoading() {
  return (
    <div className="container" style={{ paddingBlock: '3rem', minHeight: '65vh' }} aria-busy="true" aria-label="Loading documents">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Skeleton variant="text" width="90px" height="13px" style={{ marginBottom: '0.6rem' }} />
          <Skeleton variant="rectangular" width="280px" height="36px" style={{ marginBottom: '0.6rem' }} />
          <Skeleton variant="text" width="420px" height="15px" />
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
          <Spinner size="sm" />
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Loading documents...</span>
        </div>
      </div>

      <div style={{ height: '140px', background: 'var(--bg-surface)', border: '2px dashed var(--border-subtle)', borderRadius: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '2.5rem' }}>
        <Skeleton variant="circular" width="40px" height="40px" />
        <Skeleton variant="text" width="220px" height="14px" />
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ padding: '1.2rem 1.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
              <Skeleton variant="rectangular" width="36px" height="44px" style={{ borderRadius: '3px' }} />
              <div style={{ flex: 1 }}>
                <Skeleton variant="text" width="220px" height="18px" style={{ marginBottom: '0.4rem' }} />
                <Skeleton variant="text" width="140px" height="12px" />
              </div>
            </div>
            <Skeleton variant="rectangular" width="100px" height="32px" style={{ borderRadius: '4px' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
