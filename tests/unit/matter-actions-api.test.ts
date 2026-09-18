/**
 * Unit & Integration Tests for Matter Action Items, Readiness, Counsel Questions, Brief & Activity API Routes (Phase 9).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as POST_MATTER } from '@/app/api/matters/route';
import {
  GET as GET_ACTION_ITEMS,
  POST as POST_ACTION_ITEM,
} from '@/app/api/matters/[matterId]/action-items/route';
import {
  PATCH as PATCH_ACTION_ITEM,
  DELETE as DELETE_ACTION_ITEM,
} from '@/app/api/matters/[matterId]/action-items/[itemId]/route';
import { POST as POST_GENERATE_ACTION_ITEMS } from '@/app/api/matters/[matterId]/action-items/generate/route';
import { GET as GET_READINESS } from '@/app/api/matters/[matterId]/readiness/route';
import { POST as POST_GENERATE_COUNSEL_QUESTIONS } from '@/app/api/matters/[matterId]/counsel-questions/generate/route';
import {
  GET as GET_BRIEF,
  POST as POST_BRIEF,
} from '@/app/api/matters/[matterId]/brief/route';
import { GET as GET_ACTIVITY } from '@/app/api/matters/[matterId]/activity/route';

describe('Phase 9: Matter Action Items & Counsel Workflow API Routes', () => {
  let matterId: string;
  let actionItemId: string;

  beforeAll(async () => {
    // Create test matter
    const req = new NextRequest('http://localhost:3000/api/matters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Phase 9 API Test Matter',
        description: 'Testing action items and counsel brief routes',
        jurisdiction: 'Texas, USA',
      }),
    });
    const res = await POST_MATTER(req);
    const body = await res.json();
    matterId = body.matter.id;
  });

  describe('Action Items API', () => {
    it('POST /api/matters/[matterId]/action-items > creates an action item', async () => {
      const req = new NextRequest(`http://localhost:3000/api/matters/${matterId}/action-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Request Schedule B from opposing party',
          description: 'Needed for complete indemnity review.',
          type: 'REQUEST_DOCUMENT',
          priority: 'HIGH',
        }),
      });

      const res = await POST_ACTION_ITEM(req, {
        params: Promise.resolve({ matterId }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.item).toBeDefined();
      expect(data.item.title).toBe('Request Schedule B from opposing party');
      expect(data.item.priority).toBe('HIGH');
      expect(data.item.sourceType).toBe('USER_CREATED');
      expect(data.item.userProvided).toBe(true);
      actionItemId = data.item.id;
    });

    it('rejects malformed action items and does not trust client provenance', async () => {
      const url = `http://localhost:3000/api/matters/${matterId}/action-items`;
      const params = { params: Promise.resolve({ matterId }) };
      const malformed = await POST_ACTION_ITEM(new NextRequest(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'null',
      }), params);
      expect(malformed.status).toBe(400);

      const spoofed = await POST_ACTION_ITEM(new NextRequest(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Manual question', description: '', sourceType: 'LEGAL_XRAY', userProvided: false }),
      }), params);
      expect(spoofed.status).toBe(201);
      const { item } = await spoofed.json();
      expect(item.sourceType).toBe('USER_CREATED');
      expect(item.userProvided).toBe(true);
    });

    it('GET /api/matters/[matterId]/action-items > lists action items', async () => {
      const req = new NextRequest(`http://localhost:3000/api/matters/${matterId}/action-items`);
      const res = await GET_ACTION_ITEMS(req, {
        params: Promise.resolve({ matterId }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.items.length).toBeGreaterThan(0);
    });

    it('PATCH /api/matters/[matterId]/action-items/[itemId] > updates status', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/matters/${matterId}/action-items/${actionItemId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'COMPLETED',
          }),
        }
      );

      const res = await PATCH_ACTION_ITEM(req, {
        params: Promise.resolve({ matterId, itemId: actionItemId }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.item.status).toBe('COMPLETED');
    });

    it('POST /api/matters/[matterId]/action-items/generate > triggers generation', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/matters/${matterId}/action-items/generate`,
        {
          method: 'POST',
        }
      );

      const res = await POST_GENERATE_ACTION_ITEMS(req, {
        params: Promise.resolve({ matterId }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.items).toBeDefined();
    });

    it('DELETE /api/matters/[matterId]/action-items/[itemId] > removes item', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/matters/${matterId}/action-items/${actionItemId}`,
        {
          method: 'DELETE',
        }
      );

      const res = await DELETE_ACTION_ITEM(req, {
        params: Promise.resolve({ matterId, itemId: actionItemId }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Readiness & Counsel Questions API', () => {
    it('GET /api/matters/[matterId]/readiness > returns readiness report', async () => {
      const req = new NextRequest(`http://localhost:3000/api/matters/${matterId}/readiness`);
      const res = await GET_READINESS(req, {
        params: Promise.resolve({ matterId }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.readiness).toBeDefined();
      expect(data.readiness.snapshot).toBeDefined();
      expect(data.readiness.states).toBeDefined();
    });

    it('POST /api/matters/[matterId]/counsel-questions/generate > generates questions', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/matters/${matterId}/counsel-questions/generate`,
        {
          method: 'POST',
        }
      );

      const res = await POST_GENERATE_COUNSEL_QUESTIONS(req, {
        params: Promise.resolve({ matterId }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.questions).toBeDefined();
      expect(data.disclaimer).toBeDefined();
    });
  });

  describe('Brief Dossier & Activity Trail API', () => {
    it('POST /api/matters/[matterId]/brief > generates brief dossier', async () => {
      const req = new NextRequest(`http://localhost:3000/api/matters/${matterId}/brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });

      const res = await POST_BRIEF(req, {
        params: Promise.resolve({ matterId }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.brief).toBeDefined();
      expect(data.brief.title).toContain('Phase 9 API Test Matter');
    });

    it('GET /api/matters/[matterId]/brief > gets cached brief dossier', async () => {
      const req = new NextRequest(`http://localhost:3000/api/matters/${matterId}/brief`);
      const res = await GET_BRIEF(req, {
        params: Promise.resolve({ matterId }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.brief).not.toBeNull();
      expect(data.brief.title).toContain('Phase 9 API Test Matter');
    });

    it('GET /api/matters/[matterId]/activity > returns activity trail', async () => {
      const req = new NextRequest(`http://localhost:3000/api/matters/${matterId}/activity?limit=10`);
      const res = await GET_ACTIVITY(req, {
        params: Promise.resolve({ matterId }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.activity).toBeDefined();
      expect(data.activity.length).toBeGreaterThan(0);
    });
  });
});
