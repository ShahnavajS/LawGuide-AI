/**
 * Unit & Integration Tests for Matter API Routes (LexiGuide AI Phase 8).
 * Tests REST Endpoints: /api/matters, documents, relationships, consistency, timeline, search, query, notes.
 */

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as GET_MATTERS, POST as POST_MATTERS } from '@/app/api/matters/route';
import {
  GET as GET_MATTER_BY_ID,
  PATCH as PATCH_MATTER,
  DELETE as DELETE_MATTER,
} from '@/app/api/matters/[matterId]/route';
import { POST as POST_MATTER_DOCUMENT } from '@/app/api/matters/[matterId]/documents/route';
import {
  PATCH as PATCH_MATTER_DOCUMENT,
  DELETE as DELETE_MATTER_DOCUMENT,
} from '@/app/api/matters/[matterId]/documents/[documentId]/route';
import { GET as GET_RELATIONSHIPS } from '@/app/api/matters/[matterId]/relationships/route';
import { POST as REFRESH_RELATIONSHIPS } from '@/app/api/matters/[matterId]/relationships/refresh/route';
import { GET as GET_CONSISTENCY } from '@/app/api/matters/[matterId]/consistency/route';
import { GET as GET_TIMELINE } from '@/app/api/matters/[matterId]/timeline/route';
import { GET as GET_SEARCH } from '@/app/api/matters/[matterId]/search/route';
import { POST as POST_QUERY } from '@/app/api/matters/[matterId]/query/route';
import {
  GET as GET_NOTES,
  POST as POST_NOTE,
} from '@/app/api/matters/[matterId]/notes/route';
import { DELETE as DELETE_NOTE } from '@/app/api/matters/[matterId]/notes/[noteId]/route';

describe('Phase 8: Matter API Routes', () => {
  let createdMatterId: string;

  describe('POST /api/matters', () => {
    it('creates a new matter successfully', async () => {
      const req = new NextRequest('http://localhost:3000/api/matters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'API Test Acquisition Matter',
          description: 'M&A due diligence documentation review',
          jurisdiction: 'Delaware, USA',
          jurisdictionProvenance: 'USER_PROVIDED',
        }),
      });

      const res = await POST_MATTERS(req);
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.matter).toBeDefined();
      expect(body.matter.title).toBe('API Test Acquisition Matter');
      createdMatterId = body.matter.id;
    });

    it('returns 400 when title is missing or empty', async () => {
      const req = new NextRequest('http://localhost:3000/api/matters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '' }),
      });

      const res = await POST_MATTERS(req);
      expect(res.status).toBe(400);
    });

    it('returns a safe 400 for null or wrongly typed matter details', async () => {
      for (const payload of ['null', '{"title":42}']) {
        const res = await POST_MATTERS(new NextRequest('http://localhost:3000/api/matters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        }));
        expect(res.status).toBe(400);
        expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('GET /api/matters', () => {
    it('returns list of matters filtered by status', async () => {
      const req = new NextRequest('http://localhost:3000/api/matters?status=ACTIVE');
      const res = await GET_MATTERS(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(Array.isArray(body.matters)).toBe(true);
      expect(body.matters.some((m: { id: string }) => m.id === createdMatterId)).toBe(true);
    });
  });

  describe('GET, PATCH, DELETE /api/matters/[matterId]', () => {
    it('GET returns 200 and matter details for valid ID', async () => {
      const req = new NextRequest(`http://localhost:3000/api/matters/${createdMatterId}`);
      const res = await GET_MATTER_BY_ID(req, {
        params: Promise.resolve({ matterId: createdMatterId }),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.matter.id).toBe(createdMatterId);
    });

    it('GET returns 404 for unknown matter ID', async () => {
      const req = new NextRequest('http://localhost:3000/api/matters/nonexistent_matter_id');
      const res = await GET_MATTER_BY_ID(req, {
        params: Promise.resolve({ matterId: 'nonexistent_matter_id' }),
      });
      expect(res.status).toBe(404);
    });

    it('PATCH updates matter metadata', async () => {
      const req = new NextRequest(`http://localhost:3000/api/matters/${createdMatterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Updated description for test' }),
      });

      const res = await PATCH_MATTER(req, {
        params: Promise.resolve({ matterId: createdMatterId }),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.matter.description).toBe('Updated description for test');
    });
  });

  describe('Matter Documents & Relationships Routes', () => {
    it('POST /api/matters/[matterId]/documents validates document ID exists', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/matters/${createdMatterId}/documents`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: 'doc_nonexistent_9999', role: 'PRIMARY_AGREEMENT' }),
        }
      );

      const res = await POST_MATTER_DOCUMENT(req, {
        params: Promise.resolve({ matterId: createdMatterId }),
      });
      expect(res.status).toBe(404);
    });

    it('PATCH /api/matters/[matterId]/documents/[documentId] handles missing membership', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/matters/${createdMatterId}/documents/doc_dummy`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'AMENDMENT' }),
        }
      );

      const res = await PATCH_MATTER_DOCUMENT(req, {
        params: Promise.resolve({ matterId: createdMatterId, documentId: 'doc_dummy' }),
      });
      expect(res.status).toBe(404);
    });

    it('DELETE /api/matters/[matterId]/documents/[documentId] handles non-member document gracefully', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/matters/${createdMatterId}/documents/doc_dummy`,
        { method: 'DELETE' }
      );

      const res = await DELETE_MATTER_DOCUMENT(req, {
        params: Promise.resolve({ matterId: createdMatterId, documentId: 'doc_dummy' }),
      });
      expect(res.status).toBe(404);
    });

    it('GET /api/matters/[matterId]/relationships returns relationships list', async () => {
      const req = new NextRequest(`http://localhost:3000/api/matters/${createdMatterId}/relationships`);
      const res = await GET_RELATIONSHIPS(req, {
        params: Promise.resolve({ matterId: createdMatterId }),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(Array.isArray(body.relationships)).toBe(true);
    });

    it('POST /api/matters/[matterId]/relationships/refresh refreshes relationships', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/matters/${createdMatterId}/relationships/refresh`,
        { method: 'POST' }
      );
      const res = await REFRESH_RELATIONSHIPS(req, {
        params: Promise.resolve({ matterId: createdMatterId }),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(Array.isArray(body.relationships)).toBe(true);
    });

    it('GET /api/matters/[matterId]/consistency returns consistency findings', async () => {
      const req = new NextRequest(`http://localhost:3000/api/matters/${createdMatterId}/consistency`);
      const res = await GET_CONSISTENCY(req, {
        params: Promise.resolve({ matterId: createdMatterId }),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(Array.isArray(body.findings)).toBe(true);
    });
  });

  describe('Matter Sub-Resources: Timeline, Search, Query, Notes', () => {
    it('GET /api/matters/[matterId]/timeline returns timeline events', async () => {
      const req = new NextRequest(`http://localhost:3000/api/matters/${createdMatterId}/timeline`);
      const res = await GET_TIMELINE(req, {
        params: Promise.resolve({ matterId: createdMatterId }),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(Array.isArray(body.timeline)).toBe(true);
    });

    it('GET /api/matters/[matterId]/search searches across matter', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/matters/${createdMatterId}/search?q=agreement`
      );
      const res = await GET_SEARCH(req, {
        params: Promise.resolve({ matterId: createdMatterId }),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.query).toBe('agreement');
      expect(Array.isArray(body.results)).toBe(true);
    });

    it('POST /api/matters/[matterId]/query handles matter Q&A safely', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/matters/${createdMatterId}/query`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'What are the main documents in this matter?' }),
        }
      );

      const res = await POST_QUERY(req, {
        params: Promise.resolve({ matterId: createdMatterId }),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.answer).toBeDefined();
    });

    it('POST, GET, DELETE /api/matters/[matterId]/notes manages user notes', async () => {
      // 1. Create Note
      const postReq = new NextRequest(
        `http://localhost:3000/api/matters/${createdMatterId}/notes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Initial Consultation Prep',
            content: 'Discuss liability cap with outside counsel.',
          }),
        }
      );

      const postRes = await POST_NOTE(postReq, {
        params: Promise.resolve({ matterId: createdMatterId }),
      });
      expect(postRes.status).toBe(201);
      const postBody = await postRes.json();
      const noteId = postBody.note.id;
      expect(noteId).toBeDefined();

      // 2. List Notes
      const getReq = new NextRequest(
        `http://localhost:3000/api/matters/${createdMatterId}/notes`
      );
      const getRes = await GET_NOTES(getReq, {
        params: Promise.resolve({ matterId: createdMatterId }),
      });
      expect(getRes.status).toBe(200);
      const getBody = await getRes.json();
      expect(getBody.notes.some((n: { id: string }) => n.id === noteId)).toBe(true);

      // 3. Delete Note
      const delReq = new NextRequest(
        `http://localhost:3000/api/matters/${createdMatterId}/notes/${noteId}`,
        { method: 'DELETE' }
      );
      const delRes = await DELETE_NOTE(delReq, {
        params: Promise.resolve({ matterId: createdMatterId, noteId }),
      });
      expect(delRes.status).toBe(200);
    });
  });

  describe('DELETE /api/matters/[matterId]', () => {
    it('deletes the matter', async () => {
      const req = new NextRequest(`http://localhost:3000/api/matters/${createdMatterId}`, {
        method: 'DELETE',
      });
      const res = await DELETE_MATTER(req, {
        params: Promise.resolve({ matterId: createdMatterId }),
      });
      expect(res.status).toBe(200);

      // Verify 404 after deletion
      const checkReq = new NextRequest(`http://localhost:3000/api/matters/${createdMatterId}`);
      const checkRes = await GET_MATTER_BY_ID(checkReq, {
        params: Promise.resolve({ matterId: createdMatterId }),
      });
      expect(checkRes.status).toBe(404);
    });
  });
});
