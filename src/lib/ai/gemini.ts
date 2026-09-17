/**
 * Gemini Service Abstraction Layer.
 *
 * Future modules (Analysis, Q&A, Comparison, Lawyer Prep) interact exclusively
 * through this service, decoupling domain logic from the specific @google/genai SDK version.
 */

import { getGeminiClient } from './client';
import { DEFAULT_AI_CONFIG, AIServiceConfig } from './config';
import { SYSTEM_LEGAL_ANALYST_PROMPT } from './prompts';
import { AIServiceError, sanitizeErrorString } from '@/lib/utils/errors';
import { getServerConfig } from '@/lib/config/env';

export interface GenerateOptions {
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GeminiUploadedFile {
  uri: string;
  name: string;
  mimeType: string;
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
    return Boolean(gemini.apiKey && gemini.apiKey !== 'mock_dev_key');
  }

  /**
   * Generates free-form text response using the configured Gemini model.
   */
  public async generateText(prompt: string, options?: GenerateOptions): Promise<string> {
    try {
      const client = getGeminiClient();
      const response = await client.models.generateContent({
        model: this.config.model,
        contents: prompt,
        config: {
          systemInstruction: options?.systemInstruction || SYSTEM_LEGAL_ANALYST_PROMPT,
          temperature: options?.temperature ?? this.config.temperature,
          maxOutputTokens: options?.maxOutputTokens ?? this.config.maxOutputTokens,
        },
      });

      return response.text || '';
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Gemini error';
      throw new AIServiceError(`Gemini generation failed: ${sanitizeErrorString(errorMessage)}`);
    }
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
        // Enforce JSON format in generation
      });

      // Strip markdown code fences if returned by model
      const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
      return JSON.parse(cleaned) as T;
    } catch (error: unknown) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse AI structured response';
      throw new AIServiceError(`Structured generation error: ${sanitizeErrorString(errorMessage)}`);
    }
  }

  /**
   * Uploads a document file to Gemini Files API for multimodal/PDF grounding.
   * Gracefully returns null if Gemini API key is unconfigured or in offline/test mode.
   */
  public async uploadFile(
    buffer: Buffer,
    mimeType: string,
    displayName?: string
  ): Promise<GeminiUploadedFile | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const client = getGeminiClient();
      const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
      const response = await client.files.upload({
        file: blob,
        config: {
          mimeType,
          displayName: displayName || 'document.pdf',
        },
      });

      return {
        uri: response.uri || '',
        name: response.name || '',
        mimeType: response.mimeType || mimeType,
      };
    } catch (error: unknown) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'File upload failed';
      throw new AIServiceError(`Gemini file upload failed: ${sanitizeErrorString(errorMessage)}`);
    }
  }
}

// Global default service instance
export const geminiService = new GeminiService();
