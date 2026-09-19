import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { authConfiguration } from '@/lib/security/workspace-auth';

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
    db.run(sql`SELECT 1`);
    const auth = authConfiguration();
    const ready = !auth.required || auth.configured;

    return NextResponse.json(
      {
        status: ready ? 'ok' : 'degraded',
        timestamp,
        database: 'connected',
        service: 'LawGuide AI',
      },
      {
        status: ready ? 200 : 503,
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
        service: 'LawGuide AI',
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
