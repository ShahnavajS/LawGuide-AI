import { NextRequest, NextResponse } from 'next/server';
import { authenticateSessionToken } from './service';
import { runAsUser } from './context';
import { SESSION_COOKIE } from '@/lib/security/workspace-auth';
import { isTrustedMutationRequest } from '@/lib/security/request-security';

type RouteHandler<TContext> = (request: NextRequest, context: TContext) => Response | Promise<Response>;
type AuthenticatedRouteHandler<TContext> = (request: NextRequest, context?: TContext) => Response | Promise<Response>;

export function withAuth<TContext>(handler: RouteHandler<TContext>): AuthenticatedRouteHandler<TContext> {
  return async (request, context) => {
    const user = authenticateSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    if (!user) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in to access your workspace.' } }, { status: 401 });
    }
    if (!isTrustedMutationRequest(request, { requireApiHeader: true })) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'The request source could not be verified.' } },
        { status: 403 }
      );
    }
    return runAsUser(user, () => handler(request, context as TContext));
  };
}

export function runWithOptionalAuth<T>(request: NextRequest, callback: () => T): T {
  const user = authenticateSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  return user ? runAsUser(user, callback) : callback();
}
