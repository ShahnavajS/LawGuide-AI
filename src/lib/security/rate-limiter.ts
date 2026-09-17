/**
 * In-Memory Rate Limiter for LexiGuide AI (Phase 12).
 *
 * Implements a sliding-window rate limiter designed for single-tenant / local deployments
 * without requiring external infrastructure such as Redis.
 * Protects expensive operations (Gemini AI analysis, contract comparison, counsel briefs, Ask My Matter)
 * from accidental denial-of-service, runaway loops, or abuse.
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTimestamp: number;
  retryAfterSeconds: number;
}

export type RateLimitTier = 'heavy_ai' | 'standard_api';

const TIER_CONFIGS: Record<RateLimitTier, RateLimitConfig> = {
  heavy_ai: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 20 requests per minute
  },
  standard_api: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 100 requests per minute
  },
};

interface ClientRecord {
  timestamps: number[];
  lastAccess: number;
}

class InMemoryRateLimiter {
  private stores: Map<string, ClientRecord> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Periodically clean up entries older than 5 minutes to prevent memory leaks
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => {
        this.pruneStaleRecords();
      }, 5 * 60 * 1000);

      // Unref timer so it does not block Node process exit or test teardown
      if (this.cleanupInterval && typeof this.cleanupInterval.unref === 'function') {
        this.cleanupInterval.unref();
      }
    }
  }

  /**
   * Checks whether the client identifier has exceeded rate limits for the given tier.
   */
  public check(identifier: string, tier: RateLimitTier = 'heavy_ai'): RateLimitResult {
    const config = TIER_CONFIGS[tier];
    const now = Date.now();
    const key = `${tier}:${identifier}`;

    let record = this.stores.get(key);
    if (!record) {
      record = { timestamps: [], lastAccess: now };
      this.stores.set(key, record);
    }

    record.lastAccess = now;

    // Filter out timestamps outside current sliding window
    const windowStart = now - config.windowMs;
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    const currentCount = record.timestamps.length;
    const allowed = currentCount < config.maxRequests;

    if (allowed) {
      record.timestamps.push(now);
      const remaining = config.maxRequests - record.timestamps.length;
      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: Math.max(0, remaining),
        resetTimestamp: now + config.windowMs,
        retryAfterSeconds: 0,
      };
    }

    // Rate limit exceeded: calculate earliest timestamp expiry
    const oldestTimestamp = record.timestamps[0] || now;
    const resetTimestamp = oldestTimestamp + config.windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetTimestamp - now) / 1000));

    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetTimestamp,
      retryAfterSeconds,
    };
  }

  /**
   * Cleans up stale client records to prevent memory growth.
   */
  private pruneStaleRecords() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000;
    for (const [key, record] of this.stores.entries()) {
      if (now - record.lastAccess > maxAge) {
        this.stores.delete(key);
      }
    }
  }

  /**
   * Clears all stores. Primarily used in testing environments.
   */
  public reset(): void {
    this.stores.clear();
  }

  /**
   * Stops cleanup timer (for clean test teardown).
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.stores.clear();
  }
}

export const rateLimiter = new InMemoryRateLimiter();

/**
 * Extracts a client identifier from incoming request headers.
 */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return 'local-user';
}
