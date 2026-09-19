import { and, eq, lt } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { generateId } from '@/lib/utils/id';
import {
  DEFAULT_EVALUATOR_EMAIL,
  DEFAULT_EVALUATOR_NAME,
  DEFAULT_EVALUATOR_PASSWORD,
  EVALUATOR_USER_ID,
} from './constants';
import { hashPassword, normalizeEmail, validateAccountInput, verifyPassword } from './password';
import {
  createSessionToken,
  getSessionSecret,
  hashSessionId,
  readSessionToken,
} from '@/lib/security/workspace-auth';
import type { AuthUser } from './context';

export const DEMO_HASH_PLACEHOLDER = 'demo-hash-created-at-first-login';

export function evaluatorAccountConfig(env: Record<string, string | undefined> = process.env) {
  const enabled = env.EVALUATOR_DEMO_ENABLED !== 'false';
  return {
    enabled,
    email: normalizeEmail(env.EVALUATOR_DEMO_EMAIL || DEFAULT_EVALUATOR_EMAIL),
    password: env.EVALUATOR_DEMO_PASSWORD || DEFAULT_EVALUATOR_PASSWORD,
    name: (env.EVALUATOR_DEMO_NAME || DEFAULT_EVALUATOR_NAME).trim(),
  };
}

async function ensureEvaluatorAccount(): Promise<void> {
  const config = evaluatorAccountConfig();
  if (!config.enabled) return;
  const db = getDb();
  const existing = db.select().from(schema.users).where(eq(schema.users.id, EVALUATOR_USER_ID)).get();
  const passwordMatches = existing?.passwordHash && existing.passwordHash !== DEMO_HASH_PLACEHOLDER
    ? await verifyPassword(config.password, existing.passwordHash)
    : false;
  if (existing && existing.email === config.email && existing.name === config.name && passwordMatches) return;

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(config.password);
  if (existing) {
    db.delete(schema.userSessions).where(eq(schema.userSessions.userId, EVALUATOR_USER_ID)).run();
    db.update(schema.users)
      .set({ name: config.name, email: config.email, passwordHash, isDemo: true, isActive: true, updatedAt: now })
      .where(eq(schema.users.id, EVALUATOR_USER_ID))
      .run();
  } else {
    db.insert(schema.users).values({
      id: EVALUATOR_USER_ID,
      name: config.name,
      email: config.email,
      passwordHash,
      isDemo: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }).run();
  }
}

export async function createAccount(input: { name: string; email: string; password: string }): Promise<AuthUser> {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const validationError = validateAccountInput(name, email, input.password);
  if (validationError) throw new Error(validationError);

  const db = getDb();
  if (db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).get()) {
    throw new Error('An account with this email already exists.');
  }
  const now = new Date().toISOString();
  const user: AuthUser = { id: generateId('usr'), name, email, isDemo: false };
  db.insert(schema.users).values({
    ...user,
    passwordHash: await hashPassword(input.password),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }).run();
  return user;
}

export async function authenticateAccount(emailValue: string, password: string): Promise<AuthUser | null> {
  await ensureEvaluatorAccount();
  const email = normalizeEmail(emailValue);
  const record = getDb().select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (!record || !record.isActive || (record.isDemo && !evaluatorAccountConfig().enabled)) return null;
  if (!(await verifyPassword(password, record.passwordHash))) return null;
  return { id: record.id, name: record.name, email: record.email, isDemo: record.isDemo };
}

export function createUserSession(userId: string): { token: string; expiresAt: Date } {
  const db = getDb();
  const created = createSessionToken(userId, getSessionSecret());
  const now = new Date().toISOString();
  db.delete(schema.userSessions).where(lt(schema.userSessions.expiresAt, now)).run();
  db.insert(schema.userSessions).values({
    id: hashSessionId(created.sessionId),
    userId,
    createdAt: now,
    expiresAt: created.expiresAt.toISOString(),
  }).run();
  return { token: created.token, expiresAt: created.expiresAt };
}

export function authenticateSessionToken(token: string | undefined): AuthUser | null {
  let payload;
  try {
    payload = readSessionToken(token, getSessionSecret());
  } catch {
    return null;
  }
  if (!payload) return null;
  const row = getDb().select({
    expiresAt: schema.userSessions.expiresAt,
    id: schema.users.id,
    name: schema.users.name,
    email: schema.users.email,
    isDemo: schema.users.isDemo,
    isActive: schema.users.isActive,
  }).from(schema.userSessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.userSessions.userId))
    .where(and(
      eq(schema.userSessions.id, hashSessionId(payload.sessionId)),
      eq(schema.userSessions.userId, payload.userId)
    ))
    .get();
  if (!row || !row.isActive || row.expiresAt <= new Date().toISOString()) return null;
  if (row.isDemo && !evaluatorAccountConfig().enabled) return null;
  return { id: row.id, name: row.name, email: row.email, isDemo: row.isDemo };
}

export function revokeSessionToken(token: string | undefined): void {
  try {
    const payload = readSessionToken(token, getSessionSecret());
    if (payload) {
      getDb().delete(schema.userSessions)
        .where(eq(schema.userSessions.id, hashSessionId(payload.sessionId)))
        .run();
    }
  } catch {
    // An invalid or unconfigured session is already effectively revoked.
  }
}
