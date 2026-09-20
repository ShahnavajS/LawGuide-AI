'use client';

import { apiFetch } from '@/lib/api/client';

import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button/Button';
import type { DocumentQuestionResponse } from '@/lib/document/query';
import styles from './DocumentQuestionPanel.module.css';

export function DocumentQuestionPanel({ documentId, onCitationClick }: { documentId: string; onCitationClick: (page: number) => void }) {
  const questionId = useId();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<DocumentQuestionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setAnswer(null);
    setLoading(true);
    try {
      const response = await apiFetch(`/api/documents/${encodeURIComponent(documentId)}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || 'Could not answer this question.');
      setAnswer(data as DocumentQuestionResponse);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not answer this question.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby={`${questionId}-title`}>
      <h2 id={`${questionId}-title`}>Ask about this document</h2>
      <p>Answers use extracted text from this PDF. Matching passages are sent to the configured AI provider when available. Review citations before relying on an interpretation.</p>
      <form onSubmit={ask}>
        <label htmlFor={questionId}>Your question</label>
        <textarea id={questionId} value={question} onChange={(event) => setQuestion(event.target.value)} minLength={4} maxLength={500} required rows={3} placeholder="What notice is required to end this agreement?" />
        <Button type="submit" size="sm" isLoading={loading} disabled={loading || question.trim().length < 4}>Find answer</Button>
      </form>
      <div aria-live="polite" aria-atomic="true">
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {answer && (
          <div className={styles.result}>
            <p>{answer.answer}</p>
            {answer.citations.length > 0 && (
              <ul className={styles.citations} aria-label="Source passages">
                {answer.citations.map((citation, index) => (
                  <li key={`${citation.pageNumber}-${index}`}>
                    <button type="button" onClick={() => onCitationClick(citation.pageNumber)}>View Page {citation.pageNumber}</button>
                    <blockquote>{citation.quotedText}</blockquote>
                  </li>
                ))}
              </ul>
            )}
            <p className={styles.note}>{answer.verificationNote}</p>
          </div>
        )}
      </div>
    </section>
  );
}
