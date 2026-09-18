/**
 * Environment configuration and validation.
 * Ensures critical server secrets are never leaked to client bundles.
 */
import { authConfiguration } from '@/lib/security/workspace-auth';

export interface AppConfig {
  gemini: {
    apiKey: string;
    model: string;
  };
  db: {
    url: string;
  };
  storage: {
    dir: string;
  };
  isProduction: boolean;
  isTest: boolean;
}

export function getServerConfig(): AppConfig {
  // Enforce server-side only execution
  if (typeof window !== 'undefined') {
    throw new Error('FATAL: Attempted to access server environment variables from client-side bundle.');
  }

  const apiKey = process.env.GEMINI_API_KEY || '';
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const dbUrl = process.env.DATABASE_URL || './data/lexiguide.db';
  const storageDir = process.env.STORAGE_DIR || './uploads';

  return {
    gemini: {
      apiKey,
      model,
    },
    db: {
      url: dbUrl,
    },
    storage: {
      dir: storageDir,
    },
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',
  };
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates server configuration for production readiness.
 * Safe for execution on startup: never logs or leaks secret values.
 */
export function validateProductionConfig(env: Record<string, string | undefined> = process.env): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const rawDbUrl = env.DATABASE_URL !== undefined ? env.DATABASE_URL : './data/lexiguide.db';
  if (!rawDbUrl || !rawDbUrl.trim()) {
    errors.push('DATABASE_URL is required and cannot be empty.');
  }

  const rawStorageDir = env.STORAGE_DIR !== undefined ? env.STORAGE_DIR : './uploads';
  if (!rawStorageDir || !rawStorageDir.trim()) {
    errors.push('STORAGE_DIR is required and cannot be empty.');
  }
  if (env.NODE_ENV === 'production' && !authConfiguration(env).configured) {
    errors.push('APP_ACCESS_PASSWORD and APP_SESSION_SECRET must be set to strong, non-placeholder values.');
  }

  const apiKey = env.GEMINI_API_KEY?.trim() || '';
  if (!apiKey) {
    warnings.push('GEMINI_API_KEY is not set. Live AI capabilities will fallback to deterministic offline responses.');
  } else if (apiKey === 'your_gemini_api_key_here' || apiKey === 'mock_dev_key') {
    warnings.push('GEMINI_API_KEY is using a placeholder or mock value.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
