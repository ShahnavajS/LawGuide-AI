/**
 * AI Service Configuration.
 * Configures model settings, temperature, and generation parameters.
 */

export interface AIServiceConfig {
  model: string;
  temperature: number;
  topP: number;
  maxOutputTokens: number;
}

export const DEFAULT_AI_CONFIG: AIServiceConfig = {
  // Configurable via GEMINI_MODEL env var, defaulting to current recommended model
  model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  // Low temperature for factual precision and reduced hallucination
  temperature: 0.1,
  topP: 0.95,
  maxOutputTokens: 16384,
};
