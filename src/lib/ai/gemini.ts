/**
 * Gemini Service Abstraction Layer.
 *
 * Future modules (Analysis, Q&A, Comparison, Lawyer Prep) interact exclusively
 * through this service, decoupling domain logic from the specific @google/genai SDK version.
 */

import { getGeminiClient } from './client';
import { DEFAULT_AI_CONFIG, AIServiceConfig } from './config';
import { SYSTEM_LEGAL_ANALYST_PROMPT } from './prompts';
import { AIServiceError } from '@/lib/utils/errors';
import { getServerConfig } from '@/lib/config/env';
import { assertBoundedJsonValue } from './validate-output';

export interface GenerateOptions {
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeout?: number;
  responseMimeType?: string;
  responseJsonSchema?: unknown;
}

/**
 * Parses a complete JSON model response. Partial or decorated output is rejected
 * so truncated legal results can never be mistaken for valid evidence.
 */
export function parseStrictJson(rawText: string): unknown {
  const text = (rawText || '').trim();
  if (!text || Buffer.byteLength(text, 'utf8') > 1_000_000) {
    throw new Error('Model JSON response is empty or exceeds the size limit.');
  }
  return JSON.parse(text);
}

export class GeminiService {
  private config: AIServiceConfig;

  constructor(customConfig?: Partial<AIServiceConfig>) {
    this.config = {
      ...DEFAULT_AI_CONFIG,
      ...customConfig,
    };
  }

  /**
   * Checks whether the service is configured with a valid API key.
   */
  public isConfigured(): boolean {
    const { gemini } = getServerConfig();
    return Boolean(gemini.apiKey && !['mock_dev_key', 'mock_build_key', 'your_gemini_api_key_here'].includes(gemini.apiKey));
  }

  /**
   * Generates free-form text response using the configured Gemini model.
   * Uses a generous default timeout (120s) for large legal documents and retries transient issues.
   */
  public async generateText(prompt: string, options?: GenerateOptions): Promise<string> {
    const timeout = options?.timeout ?? 120_000;
    const client = getGeminiClient();

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await client.models.generateContent({
          model: this.config.model,
          contents: prompt,
          config: {
            systemInstruction: options?.systemInstruction || SYSTEM_LEGAL_ANALYST_PROMPT,
            temperature: options?.temperature ?? this.config.temperature,
            maxOutputTokens: options?.maxOutputTokens ?? this.config.maxOutputTokens,
            httpOptions: { timeout },
            responseMimeType: options?.responseMimeType,
            responseJsonSchema: options?.responseJsonSchema,
          },
        });

        return response.text || '';
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown Gemini error';
        const isTimeoutOrTransient =
          errorMessage.includes('504') ||
          errorMessage.includes('503') ||
          errorMessage.includes('DEADLINE_EXCEEDED') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('timed out') ||
          errorMessage.includes('overloaded');

        if (isTimeoutOrTransient && attempt < 2) {
          console.warn(`Gemini request transiently failed on attempt ${attempt}; retrying.`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }
        break;
      }
    }

    throw new AIServiceError();
  }

  /**
   * Generates structured JSON adhering to the specified schema/format.
   */
  public async generateStructured<T>(
    prompt: string,
    jsonSchemaOrDescription: string,
    options?: GenerateOptions
  ): Promise<T> {
    const structuredPrompt = `${prompt}\n\nYou MUST respond strictly in valid JSON format matching this schema:\n${jsonSchemaOrDescription}`;

    try {
      const text = await this.generateText(structuredPrompt, {
        ...options,
        responseMimeType: 'application/json',
      });

      const parsed = parseStrictJson(text);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Model response must be a JSON object or array.');
      }
      assertBoundedJsonValue(parsed);
      return parsed as T;
    } catch (error: unknown) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      throw new AIServiceError('The AI response could not be parsed. Please retry.');
    }
  }

}

// Global default service instance
export const geminiService = new GeminiService();
