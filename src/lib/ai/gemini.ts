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

export interface GenerateOptions {
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeout?: number;
  responseMimeType?: string;
}

/**
 * Safely parses JSON returned by the model, stripping markdown fences
 * and gracefully repairing common truncation anomalies (e.g. unclosed strings or missing brackets).
 */
export function parseOrRepairJson(rawText: string): unknown {
  let str = (rawText || '').trim();
  // Strip markdown code fences
  str = str.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  const firstBrace = str.indexOf('{');
  const firstBracket = str.indexOf('[');
  let startIdx = 0;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
  }
  str = str.slice(startIdx);

  try {
    return JSON.parse(str);
  } catch (initialErr) {
    // Attempt progressive repair for cut-off / unterminated tokens
    let inString = false;
    let escaped = false;
    const stack: string[] = [];
    let repaired = '';

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      repaired += char;
      if (inString) {
        if (char === '\\' && !escaped) {
          escaped = true;
        } else if (char === '"' && !escaped) {
          inString = false;
        } else {
          escaped = false;
        }
      } else {
        if (char === '"') {
          inString = true;
        } else if (char === '{' || char === '[') {
          stack.push(char === '{' ? '}' : ']');
        } else if (char === '}' || char === ']') {
          if (stack.length > 0 && stack[stack.length - 1] === char) {
            stack.pop();
          }
        }
      }
    }

    if (inString) {
      repaired += '"';
    }

    // Clean up trailing keys without values e.g. "key":
    repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*$/, '');
    repaired = repaired.replace(/{\s*"[^"]*"\s*:\s*$/, '{');
    // Clean up trailing commas before closing
    repaired = repaired.replace(/,\s*$/, '');

    // Close remaining open brackets
    while (stack.length > 0) {
      const closer = stack.pop()!;
      repaired = repaired.replace(/,\s*$/, '') + closer;
    }

    try {
      return JSON.parse(repaired);
    } catch {
      // Fallback: If still failing, try trimming to the last complete item
      const lastCleanObject = repaired.lastIndexOf('},');
      if (lastCleanObject !== -1) {
        const truncated = repaired.substring(0, lastCleanObject + 1) + ']}';
        try {
          return JSON.parse(truncated);
        } catch {
          // Ignore
        }
      }
      throw initialErr;
    }
  }
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

      const parsed = parseOrRepairJson(text);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Model response must be a JSON object or array.');
      }
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
