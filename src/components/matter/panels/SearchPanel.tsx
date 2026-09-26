'use client';

import styles from '../MatterWorkspace.module.css';
import { Button } from '@/components/ui/Button/Button';
import type { MatterWorkspaceModel } from '../useMatterWorkspace';

export function SearchPanel({ workspace }: { workspace: MatterWorkspaceModel }) {
  const { searchQuery, setSearchQuery, searchResults, setSearchResults, isSearching, openViewer, handleSearch } = workspace;
  return (
        <div className={styles.tabPane}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Search This Matter</h2>
                <div className={styles.sectionSubtitle}>
                  Server-side search across all page text in member documents. Clicking a result jumps
                  directly to that page.
                </div>
              </div>
            </div>

            <form onSubmit={handleSearch} className={styles.searchBar}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search across all member documents (e.g. notice, indemnity, termination)..."
                className={styles.searchInput}
              />
              <Button type="submit" variant="primary" disabled={isSearching || !searchQuery.trim()}>
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </form>

            {searchResults && (
              <div style={{ marginTop: '1.5rem' }}>
                {searchResults.totalMatches === 0 ? (
                  <div className={styles.emptyState}>
                    <p>No matches found for &ldquo;{searchQuery}&rdquo;.</p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Try adjusting your keywords or searching for broader terms (e.g. &ldquo;notice&rdquo;, &ldquo;payment&rdquo;, &ldquo;liability&rdquo;, &ldquo;termination&rdquo;).
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      style={{ marginTop: '0.5rem' }}
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults(null);
                      }}
                    >
                      Clear Search
                    </Button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      Found {searchResults.totalMatches} match
                      {searchResults.totalMatches === 1 ? '' : 'es'} across{' '}
                      {searchResults.results.length} document
                      {searchResults.results.length === 1 ? '' : 's'}.
                    </div>

                    {searchResults.results.map((docRes) => (
                      <div key={docRes.documentId} style={{ marginBottom: '1.5rem' }}>
                        <h3
                          style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: '#ffffff',
                            marginBottom: '0.5rem',
                          }}
                        >
                          📄 {docRes.documentTitle} ({docRes.matches.length})
                        </h3>

                        {docRes.matches.map((match, idx) => (
                          <div
                            key={idx}
                            className={styles.searchMatchCard}
                            onClick={() =>
                              openViewer(docRes.documentId, docRes.documentTitle, match.pageNumber)
                            }
                          >
                            <div
                              style={{
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                color: 'var(--color-gold, #c8a256)',
                                marginBottom: '0.25rem',
                              }}
                            >
                              Page {match.pageNumber}
                            </div>
                            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                              {match.snippet}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      );
}
