import { AsyncLocalStorage } from 'node:async_hooks';
import { EVALUATOR_USER_ID } from './constants';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  isDemo: boolean;
}

const authStorage = new AsyncLocalStorage<AuthUser>();

export function runAsUser<T>(user: AuthUser, callback: () => T): T {
  return authStorage.run(user, callback);
}

export function getCurrentUser(): AuthUser {
  const user = authStorage.getStore();
  if (user) return user;
  if (process.env.NODE_ENV === 'test') {
    return { id: EVALUATOR_USER_ID, name: 'Test User', email: 'test@lexiguide.local', isDemo: true };
  }
  throw new Error('Authenticated user context is required.');
}

export function getCurrentUserId(): string {
  return getCurrentUser().id;
}

export function getOptionalCurrentUser(): AuthUser | null {
  return authStorage.getStore() || null;
}

