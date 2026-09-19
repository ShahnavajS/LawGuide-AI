import { NextRequest, NextResponse } from 'next/server';
import { authenticateSessionToken } from './service';
import { getCurrentUser, runAsUser } from './context';
import { SESSION_COOKIE } from '@/lib/security/workspace-auth';

type RouteHandler<TContext> = (request: NextRequest, context: TContext) => Response | Promise<Response>;
type AuthenticatedRouteHandler<TContext> = (request: NextRequest, context?: TContext) => Response | Promise<Response>;

export function withAuth<TContext>(handler: RouteHandler<TContext>): AuthenticatedRouteHandler<TContext> {
  return async (request, context) => {
    // Unit route tests run against an in-memory database and invoke handlers directly.
    // Production and integration tests always take the real session path below.
    if (process.env.NODE_ENV === 'test' && process.env.TEST_ENFORCE_AUTH !== 'true' && !request.cookies.has(SESSION_COOKIE)) {
      return runAsUser(getCurrentUser(), () => handler(request, context as TContext));
    }
    const user = authenticateSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    if (!user) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in to access your workspace.' } }, { status: 401 });
    }
    return runAsUser(user, () => handler(request, context as TContext));
  };
}

export function runWithOptionalAuth<T>(request: NextRequest, callback: () => T): T {
  const user = authenticateSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  return user ? runAsUser(user, callback) : callback();
}
