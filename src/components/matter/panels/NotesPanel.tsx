'use client';

import styles from '../MatterWorkspace.module.css';
import { Button } from '@/components/ui/Button/Button';
import type { MatterWorkspaceModel } from '../useMatterWorkspace';

export function NotesPanel({ workspace }: { workspace: MatterWorkspaceModel }) {
  const { matter, notes, newNoteTitle, setNewNoteTitle, newNoteContent, setNewNoteContent, isAddingNote, handleAddNote, handleDeleteNote } = workspace;
  if (!matter) return null;

  return (
        <div className={styles.tabPane}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Matter Context & Client Notes</h2>
                <div className={styles.sectionSubtitle}>
                  User-provided context for this matter. Labeled strictly as USER_PROVIDED (never
                  elevated to verified document facts).
                </div>
              </div>
            </div>

            <form onSubmit={handleAddNote} style={{ marginBottom: '2rem' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Note title (e.g. Conversation with recruiter, signing deadline)..."
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  className={styles.searchInput}
                  style={{ width: '100%' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <textarea
                  rows={3}
                  placeholder="Enter details, objectives, or context..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  className={styles.searchInput}
                  style={{ width: '100%', resize: 'vertical' }}
                  required
                />
              </div>
              <Button type="submit" variant="primary" size="sm" disabled={isAddingNote}>
                {isAddingNote ? 'Saving...' : 'Add Note'}
              </Button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {notes.length === 0 ? (
                <div className={styles.emptyState}>No notes added to this matter yet.</div>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className={styles.docItem}>
                    <div className={styles.docItemHeader}>
                      <h4 style={{ margin: 0, color: '#ffffff', fontSize: '0.95rem' }}>
                        {note.title}
                      </h4>
                      <span className={styles.suggestionPill}>USER_PROVIDED</span>
                    </div>
                    <p style={{ margin: '0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      {note.content}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        style={{ color: '#ef4444' }}
                        onClick={() => handleDeleteNote(note.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      );
}
