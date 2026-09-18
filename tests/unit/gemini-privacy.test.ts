import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeminiService } from '@/lib/ai/gemini';
import { getGeminiClient } from '@/lib/ai/client';

vi.mock('@/lib/ai/client', () => ({ getGeminiClient: vi.fn() }));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Gemini failure privacy', () => {
  it('does not log or return provider errors containing document text', async () => {
    const secret = 'Confidential client clause 12345';
    const generateContent = vi.fn()
      .mockRejectedValueOnce(new Error(`503 overloaded: ${secret}`))
      .mockRejectedValueOnce(new Error(`Rejected prompt: ${secret}`));
    vi.mocked(getGeminiClient).mockReturnValue({ models: { generateContent } } as unknown as ReturnType<typeof getGeminiClient>);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();

    const result = new GeminiService().generateText('sample prompt');
    const rejection = expect(result).rejects.toThrow('An error occurred during AI analysis. Please retry.');
    await vi.advanceTimersByTimeAsync(2000);
    await rejection;
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls.flat().join(' ')).not.toContain(secret);
  });
});
