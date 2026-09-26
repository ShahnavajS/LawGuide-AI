'use client';

import { LinkButton } from '@/components/ui/Button/LinkButton';
import styles from '../MatterWorkspace.module.css';
import type { MatterWorkspaceModel } from '../useMatterWorkspace';

export function AttentionPanel({ workspace }: { workspace: MatterWorkspaceModel }) {
  const { matter } = workspace;
  if (!matter) return null;

  return (
        <div className={styles.tabPane}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Aggregated Attention Areas</h2>
                <div className={styles.sectionSubtitle}>
                  High and medium priority clauses across member documents, grouped to reduce
                  duplicate noise.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {matter.documents.map((doc) => (
                <div key={doc.id} className={styles.docItem}>
                  <div className={styles.docItemHeader}>
                    <h3 className={styles.docItemTitle}>{doc.title}</h3>
                    <span className={styles.roleBadge}>{doc.role}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    View complete breakdown and risk clauses directly in Legal X-Ray.
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <LinkButton href={`/analyze/${doc.documentId}`} size="sm" variant="secondary">Open Legal X-Ray →</LinkButton>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
}
