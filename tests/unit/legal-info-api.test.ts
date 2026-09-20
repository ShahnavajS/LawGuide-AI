/**
 * Integration Tests for Legal Information API Routes (LexiGuide AI Phase 7).
 */

import { describe, it, expect } from 'vitest';
import { authenticatedRequest } from '../helpers/authenticated-request';
import { GET as GET_TOPICS } from '@/app/api/legal-info/topics/route';
import { GET as GET_TOPIC_BY_ID } from '@/app/api/legal-info/topics/[topicId]/route';
import { POST as POST_QUERY } from '@/app/api/legal-info/query/route';
import { GET as GET_LEGAL_AID } from '@/app/api/legal-info/legal-aid/route';

describe('Phase 7: Legal Information API Routes', () => {
  it('GET /api/legal-info/topics returns full list of taxonomy topics', async () => {
    const req = authenticatedRequest('http://localhost:3000/api/legal-info/topics');
    const res = await GET_TOPICS(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.topics.length).toBeGreaterThanOrEqual(29);
  });

  it('GET /api/legal-info/topics?q=notice filters topics by search query', async () => {
    const req = authenticatedRequest('http://localhost:3000/api/legal-info/topics?q=notice');
    const res = await GET_TOPICS(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.topics.some((t: { id: string }) => t.id === 'NOTICE_PERIOD')).toBe(true);
  });

  it('GET /api/legal-info/topics/[topicId] returns dossier for valid topic', async () => {
    const req = authenticatedRequest('http://localhost:3000/api/legal-info/topics/INDEMNIFICATION?country=India');
    const context = { params: Promise.resolve({ topicId: 'INDEMNIFICATION' }) };
    const res = await GET_TOPIC_BY_ID(req, context);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.dossier.topic).toBe('INDEMNIFICATION');
    expect(body.dossier.jurisdiction.country).toBe('India');
    expect(body.dossier.sources.length).toBeGreaterThan(0);
  });

  it('GET /api/legal-info/topics/[topicId] returns 404 for unknown topic', async () => {
    const req = authenticatedRequest('http://localhost:3000/api/legal-info/topics/NON_EXISTENT_TOPIC');
    const context = { params: Promise.resolve({ topicId: 'NON_EXISTENT_TOPIC' }) };
    const res = await GET_TOPIC_BY_ID(req, context);
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('POST /api/legal-info/query validates body and answers concept question', async () => {
    const req = authenticatedRequest('http://localhost:3000/api/legal-info/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: 'TERMINATION',
        question: 'What is a notice period generally used for?',
        jurisdiction: { country: 'India' },
      }),
    });

    const res = await POST_QUERY(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.topic).toBe('TERMINATION');
    expect(body.data.generalLegalInfo).toBeDefined();
    expect(body.data.questionsForCounsel.length).toBeGreaterThan(0);
  });

  it('POST /api/legal-info/query rejects invalid payload with 400', async () => {
    const req = authenticatedRequest('http://localhost:3000/api/legal-info/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: '', // Invalid empty topic
        question: 'Hi', // Too short
      }),
    });

    const res = await POST_QUERY(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('GET /api/legal-info/legal-aid returns authoritative resources for India', async () => {
    const req = authenticatedRequest('http://localhost:3000/api/legal-info/legal-aid?country=India');
    const res = await GET_LEGAL_AID(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.resources.length).toBeGreaterThan(0);
    expect(body.resources.some((r: { id: string }) => r.id === 'NALSA_INDIA')).toBe(true);
  });
});
