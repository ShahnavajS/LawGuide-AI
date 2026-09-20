import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { createAccount, createUserSession } from '@/lib/auth/service';
import { runAsUser } from '@/lib/auth/context';
import { getDb, schema } from '@/lib/db';
import { DocumentService } from '@/lib/document/service';
import { MatterService } from '@/lib/matter/service';
import { ComparisonService } from '@/lib/comparison/service';
import { PreparationService } from '@/lib/preparation/service';
import { GET as listDocuments } from '@/app/api/documents/route';
import { POST as createMatterRoute } from '@/app/api/matters/route';
import { SESSION_COOKIE } from '@/lib/security/workspace-auth';
import { generateId } from '@/lib/utils/id';

afterEach(() => {
});

describe('per-account workspace isolation', () => {
  it('keeps documents, matters, comparisons, and preparations with their owner', async () => {
    const suffix = generateId('isolation');
    const [alice, bob] = await Promise.all([
      createAccount({ name: 'Alice Reviewer', email: `alice.${suffix}@example.test`, password: 'Strong-Alice-2026!' }),
      createAccount({ name: 'Bob Reviewer', email: `bob.${suffix}@example.test`, password: 'Strong-Bob-2026!' }),
    ]);
    const now = new Date().toISOString();
    const aliceDocId = generateId('doc');
    const bobDocId = generateId('doc');
    getDb().insert(schema.documents).values([
      { id: aliceDocId, userId: alice.id, title: 'Alice agreement', originalFilename: 'alice.pdf', mimeType: 'application/pdf', fileSize: 10, storagePath: `${aliceDocId}.pdf`, status: 'READY', createdAt: now, updatedAt: now },
      { id: bobDocId, userId: bob.id, title: 'Bob agreement', originalFilename: 'bob.pdf', mimeType: 'application/pdf', fileSize: 10, storagePath: `${bobDocId}.pdf`, status: 'READY', createdAt: now, updatedAt: now },
    ]).run();

    const documentService = new DocumentService();
    const aliceDocuments = await runAsUser(alice, () => documentService.getDocuments());
    expect(aliceDocuments.map((document) => document.id)).toContain(aliceDocId);
    expect(aliceDocuments.map((document) => document.id)).not.toContain(bobDocId);
    await expect(runAsUser(bob, () => documentService.getDocumentById(aliceDocId)))
      .rejects.toMatchObject({ statusCode: 404 });

    const matterService = new MatterService();
    const aliceMatter = await runAsUser(alice, () => matterService.createMatter({ title: 'Alice matter' }));
    const bobMatters = await runAsUser(bob, () => matterService.listMatters());
    expect(bobMatters.map((matter) => matter.id)).not.toContain(aliceMatter.id);
    await expect(runAsUser(bob, () => matterService.getMatter(aliceMatter.id)))
      .rejects.toMatchObject({ statusCode: 404 });

    const comparisonId = generateId('comp');
    getDb().insert(schema.comparisons).values({
      id: comparisonId,
      userId: alice.id,
      baseDocumentId: aliceDocId,
      targetDocumentId: aliceDocId,
      status: 'COMPLETED',
      comparisonDataJson: JSON.stringify({
        id: comparisonId,
        baseDocumentId: aliceDocId,
        targetDocumentId: aliceDocId,
        summary: {},
        statistics: {},
        differences: [],
        lawyerQuestions: [],
        validationSummary: {},
        comparedAt: now,
        disclaimer: 'Information only.',
        status: 'COMPLETED',
      }),
      createdAt: now,
      updatedAt: now,
    }).run();
    expect(await runAsUser(alice, () => new ComparisonService().getComparison(comparisonId))).not.toBeNull();
    expect(await runAsUser(bob, () => new ComparisonService().getComparison(comparisonId))).toBeNull();

    const preparationId = generateId('prep');
    getDb().insert(schema.preparations).values({
      id: preparationId,
      userId: alice.id,
      documentId: aliceDocId,
      briefKind: 'PREPARATION',
      status: 'COMPLETED',
      preparationDataJson: JSON.stringify({
        id: preparationId,
        purpose: 'Prepare questions',
        overview: {},
        documentsUnderReview: [],
        keyFacts: [],
        keyDates: [],
        financialTerms: [],
        obligations: [],
        rights: [],
        attentionAreas: [],
        lawyerQuestions: [],
        missingInformation: [],
        documentsToBring: [],
        checklist: [],
        userNotes: [],
        validationSummary: {},
        createdAt: now,
        updatedAt: now,
        disclaimer: 'Information only.',
        status: 'COMPLETED',
      }),
      createdAt: now,
      updatedAt: now,
    }).run();
    expect(await runAsUser(alice, () => new PreparationService().getPreparation(preparationId))).not.toBeNull();
    expect(await runAsUser(bob, () => new PreparationService().getPreparation(preparationId))).toBeNull();
  });

  it('requires a valid database session and applies its owner at the API boundary', async () => {
    const anonymous = await listDocuments(new NextRequest('http://localhost:3000/api/documents'));
    expect(anonymous.status).toBe(401);

    const suffix = generateId('session');
    const user = await createAccount({
      name: 'Session Owner',
      email: `${suffix}@example.test`,
      password: 'Strong-Session-2026!',
    });
    const session = createUserSession(user.id);
    const response = await listDocuments(new NextRequest('http://localhost:3000/api/documents', {
      headers: { cookie: `${SESSION_COOKIE}=${session.token}` },
    }));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.documents).toEqual([]);
  });

  it('requires verified mutation headers after session authentication', async () => {
    const suffix = generateId('csrf');
    const user = await createAccount({
      name: 'Mutation Owner',
      email: `${suffix}@example.test`,
      password: 'Strong-Mutation-2026!',
    });
    const session = createUserSession(user.id);
    const cookie = `${SESSION_COOKIE}=${session.token}`;

    const blocked = await createMatterRoute(new NextRequest('http://localhost:3000/api/matters', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Blocked mutation' }),
    }));
    expect(blocked.status).toBe(403);

    const accepted = await createMatterRoute(new NextRequest('http://localhost:3000/api/matters', {
      method: 'POST',
      headers: {
        cookie,
        origin: 'http://localhost:3000',
        'content-type': 'application/json',
        'x-lawguide-request': '1',
      },
      body: JSON.stringify({ title: 'Accepted mutation' }),
    }));
    expect(accepted.status).toBe(201);
  });
});
