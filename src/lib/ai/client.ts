/**
 * Google GenAI Client Factory (Server-side ONLY)
 *
 * Wraps @google/genai to ensure credentials are never leaked to client bundles.
 */

import { GoogleGenAI } from '@google/genai';
import { getServerConfig } from '@/lib/config/env';

let clientInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (typeof window !== 'undefined') {
    throw new Error('FATAL: Attempted to initialize Gemini client on the browser side.');
  }

  if (clientInstance) {
    return clientInstance;
  }

  const { gemini } = getServerConfig();

  if (!gemini.apiKey || gemini.apiKey === 'mock_dev_key') {
    // In dev/test without real keys, we log a warning but still provide an instance
    // Mocking or validation occurs at the call site
  }

  clientInstance = new GoogleGenAI({
    apiKey: gemini.apiKey,
  });

  return clientInstance;
}
