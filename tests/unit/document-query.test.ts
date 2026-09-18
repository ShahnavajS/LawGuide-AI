import { describe, expect, it } from 'vitest';
import { answerDocumentQuestion } from '@/lib/document/query';
import type { DocumentService } from '@/lib/document/service';
import type { GeminiService } from '@/lib/ai/gemini';

const documentService = {
  getDocumentById: async () => ({ status: 'READY', title: 'Agreement' }),
  getDocumentPages: async () => [
    { pageNumber: 1, text: 'Either party may terminate with thirty days written notice.' },
    { pageNumber: 2, text: 'Payment is due on the first day of each month.' },
  ],
} as unknown as DocumentService;

describe('single-document question answering', () => {
  it('returns source passages when AI is unavailable', async () => {
    const offline = { isConfigured: () => false } as unknown as GeminiService;
    const answer = await answerDocumentQuestion('doc_1', 'What is the termination notice?', documentService, offline);
    expect(answer.status).toBe('SOURCE_ONLY');
    expect(answer.citations[0].pageNumber).toBe(1);
  });

  it('abstains when a model invents a quote or points at the wrong page', async () => {
    const model = {
      isConfigured: () => true,
      generateStructured: async () => ({
        answer: 'Notice is one day.',
        citations: [{ pageNumber: 2, quotedText: 'one day notice' }],
      }),
    } as unknown as GeminiService;
    const answer = await answerDocumentQuestion('doc_1', 'What is the termination notice?', documentService, model);
    expect(answer.status).toBe('INSUFFICIENT_EVIDENCE');
    expect(answer.citations).toHaveLength(0);
  });

  it('returns only validated quotes with a review note', async () => {
    const model = {
      isConfigured: () => true,
      generateStructured: async () => ({
        answer: 'The document states thirty days written notice.',
        citations: [{ pageNumber: 1, quotedText: 'thirty days written notice' }],
      }),
    } as unknown as GeminiService;
    const answer = await answerDocumentQuestion('doc_1', 'What is the termination notice?', documentService, model);
    expect(answer.status).toBe('ANSWERED');
    expect(answer.citations).toHaveLength(1);
    expect(answer.verificationNote).toContain('does not prove');
  });
});
