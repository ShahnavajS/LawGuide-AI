import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { count } from 'drizzle-orm';

/**
 * Health & Operational Readiness Endpoint.
 *
 * Verifies application service availability and local SQLite database connectivity.
 * Adheres strictly to security guidelines: never exposes filesystem paths, database
 * connection strings, environment variables, or provider credentials.
 */
export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const db = getDb();
    // Verify basic read connectivity with an efficient count query
    await db.select({ total: count() }).from(documents).limit(1);

    return NextResponse.json(
      {
        status: 'ok',
        timestamp,
        database: 'connected',
        service: 'LexiGuide AI',
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch {
    return NextResponse.json(
      {
        status: 'degraded',
        timestamp,
        database: 'disconnected',
        service: 'LexiGuide AI',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }
}
