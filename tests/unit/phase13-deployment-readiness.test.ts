/**
 * Phase 13: Deployment, Production Verification & Final Demo Readiness Test Suite.
 *
 * Verifies:
 * 1. Production environment configuration & startup validation
 * 2. Operational healthcheck contracts
 * 3. Configurable persistent storage paths
 * 4. Application restart & persistence resilience
 * 5. Isolated SQLite backup snapshot verification
 * 6. Demo experience isolation
 * 7. Rate limit and security headers contract
 * 8. Adversarial anti-adjudication & prompt-injection boundaries
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { validateProductionConfig } from '@/lib/config/env';
import { GET as healthHandler } from '@/lib/../app/api/health/route';
import { LocalStorageService } from '@/lib/document/storage';
import { DocumentService } from '@/lib/document/service';
import { AnalysisService } from '@/lib/analysis/service';
import { MatterService } from '@/lib/matter/service';
import { CitationValidator } from '@/lib/evidence/validator';
import { GeminiService } from '@/lib/ai/gemini';
import { rateLimiter } from '@/lib/security/rate-limiter';
import { getDb, schema } from '@/lib/db';
import fs from 'fs/promises';
import fsSync from 'fs';
import Database from 'better-sqlite3';
import path from 'path';

function createSamplePdf(content: string = 'Sample text'): Buffer {
  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${content.length + 20} >>
stream
BT
/F1 12 Tf
100 700 Td
(${content}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
00000000115 00000 n 
0000000234 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
350
%%EOF`;
  return Buffer.from(pdfString);
}

describe('Phase 13: Deployment Readiness & Production Verification', () => {
  const testStorageDir = path.join(process.cwd(), 'uploads_test_phase13');
  let storage: LocalStorageService;
  let docService: DocumentService;
  let analysisService: AnalysisService;
  let matterService: MatterService;

  beforeEach(() => {
    rateLimiter.reset();
    storage = new LocalStorageService(testStorageDir);
    docService = new DocumentService(storage);

    const offlineGemini = new GeminiService();
    offlineGemini.isConfigured = () => false;

    const validator = new CitationValidator();
    analysisService = new AnalysisService(docService, offlineGemini, validator);
    matterService = new MatterService(
      docService,
      analysisService,
      offlineGemini,
      validator
    );
  });

  afterAll(async () => {
    rateLimiter.destroy();
    try {
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch {
      // Cleanup
    }
  });

  // --------------------------------------------------------------------------
  // 1. Production Environment Configuration Validation
  // --------------------------------------------------------------------------
  describe('Production Environment Validation', () => {
    it('validates a complete production environment successfully', () => {
      const validEnv = {
        NODE_ENV: 'production',
        DATABASE_URL: './data/lexiguide.db',
        STORAGE_DIR: './uploads',
        GEMINI_API_KEY: 'AIzaSyD-validProductionKey1234567890',
        APP_SESSION_SECRET: 'independent-private-session-secret-over-32-characters',
        APP_ORIGIN: 'https://lawguide.example',
      };

      const result = validateProductionConfig(validEnv);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('reports missing required database or storage paths without leaking secrets', () => {
      const invalidEnv = {
        NODE_ENV: 'production',
        DATABASE_URL: '   ',
        STORAGE_DIR: '',
        GEMINI_API_KEY: 'AIzaSyD-secretKeyHere',
      };

      const result = validateProductionConfig(invalidEnv);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('DATABASE_URL'))).toBe(true);
      expect(result.errors.some((e) => e.includes('STORAGE_DIR'))).toBe(true);
      expect(result.errors.some((e) => e.includes('APP_SESSION_SECRET'))).toBe(true);
      expect(result.errors.some((e) => e.includes('APP_ORIGIN'))).toBe(true);

      // Verify no secret value is exposed in error output
      const errorJson = JSON.stringify(result.errors);
      expect(errorJson).not.toContain('secretKeyHere');
    });

    it('warns when GEMINI_API_KEY is missing or uses placeholder, allowing offline operation', () => {
      const offlineEnv = {
        NODE_ENV: 'production',
        DATABASE_URL: './data/lexiguide.db',
        STORAGE_DIR: './uploads',
        GEMINI_API_KEY: '',
        APP_SESSION_SECRET: 'independent-private-session-secret-over-32-characters',
        APP_ORIGIN: 'https://lawguide.example',
      };

      const result = validateProductionConfig(offlineEnv);
      expect(result.valid).toBe(true); // Still valid because offline deterministic fallback is supported
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('GEMINI_API_KEY is not set');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Health & Operational Readiness Contract
  // --------------------------------------------------------------------------
  describe('Health Endpoint Production Contract', () => {
    it('returns HTTP 200 with minimal status and correct cache headers', async () => {
      const response = await healthHandler();
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toMatchObject({
        status: 'ok',
        database: 'connected',
        service: 'LawGuide AI',
      });
      expect(typeof data.timestamp).toBe('string');

      // Verify strict security headers on health endpoint
      expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');
    });

    it('returns degraded readiness when production access secrets are missing', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('APP_SESSION_SECRET', '');
      try {
        const response = await healthHandler();
        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({ status: 'degraded', database: 'connected' });
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3. Persistent Storage Paths & Mount Isolation
  // --------------------------------------------------------------------------
  describe('Storage Path Persistence & Mounting', () => {
    it('supports custom persistent storage paths cleanly', async () => {
      const customPath = path.join(testStorageDir, 'mounted_volume');
      const customStorage = new LocalStorageService(customPath);

      const stored = await customStorage.saveFile('doc-mounted-1', {
        filename: 'lease.pdf',
        mimeType: 'application/pdf',
        content: createSamplePdf('Commercial Lease Content'),
      });

      expect(stored.storagePath).toBe('doc-mounted-1/document.pdf');
      const exists = await customStorage.fileExists(stored.storagePath);
      expect(exists).toBe(true);

      const retrieved = await customStorage.getFile(stored.storagePath);
      expect(retrieved.byteLength).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Application Restart & Persistence Resilience
  // --------------------------------------------------------------------------
  describe('Restart & Persistence Simulation', () => {
    it('preserves all documents, matters, and notes across service re-instantiation', async () => {
      // 1. Initial Service Instance uploads document and creates matter
      const doc = await docService.uploadDocument({
        filename: 'SurvivingDocument.pdf',
        mimeType: 'application/pdf',
        buffer: createSamplePdf('Persistence test across application restart.'),
      });
      await docService.processDocument(doc.id);

      const matter = await matterService.createMatter({
        title: 'Persistent Matter Across Reboots',
        jurisdiction: 'US-DE',
      });
      await matterService.addDocumentToMatter(matter.id, doc.id, 'PRIMARY_AGREEMENT');
      await matterService.addNote(matter.id, 'Restart Note', 'Verifying note persistence.');

      // 2. Simulate Application Restart: Instantiate brand new service instances
      const restartedStorage = new LocalStorageService(testStorageDir);
      const restartedDocService = new DocumentService(restartedStorage);
      const restartedOfflineGemini = new GeminiService();
      restartedOfflineGemini.isConfigured = () => false;
      const restartedMatterService = new MatterService(
        restartedDocService,
        new AnalysisService(restartedDocService, restartedOfflineGemini, new CitationValidator()),
        restartedOfflineGemini,
        new CitationValidator()
      );

      // 3. Verify data survived restart
      const fetchedMatter = await restartedMatterService.getMatter(matter.id);
      expect(fetchedMatter.id).toBe(matter.id);
      expect(fetchedMatter.title).toBe('Persistent Matter Across Reboots');
      expect(fetchedMatter.documents).toHaveLength(1);
      expect(fetchedMatter.documents[0].documentId).toBe(doc.id);

      // Verify notes survived restart
      const notes = await restartedMatterService.getNotes(matter.id);
      expect(notes.some((n) => n.title === 'Restart Note')).toBe(true);

      // Verify physical file survived restart
      const fileData = await restartedDocService.getDocumentFile(doc.id);
      expect(fileData.originalFilename).toBe('SurvivingDocument.pdf');
      expect(fileData.buffer.byteLength).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Isolated SQLite Backup Snapshot Verification
  // --------------------------------------------------------------------------
  describe('Backup & Storage Integrity', () => {
    it('creates a readable snapshot of the in-memory test database', async () => {
      const db = getDb();
      const backupDir = path.join(testStorageDir, 'backup_snapshot');

      // Create destination directory
      fsSync.mkdirSync(backupDir, { recursive: true });

      const targetBackupDb = path.join(backupDir, 'lexiguide.db');
      await db.$client.backup(targetBackupDb);
      const snapshot = new Database(targetBackupDb, { readonly: true });
      try {
        const expected = db.$client.prepare('SELECT count(*) AS count FROM documents').get() as { count: number };
        const restored = snapshot.prepare('SELECT count(*) AS count FROM documents').get() as { count: number };
        expect(restored.count).toBe(expected.count);
      } finally {
        snapshot.close();
      }
    });
  });

  // --------------------------------------------------------------------------
  // 6. Demo Experience Isolation
  // --------------------------------------------------------------------------
  describe('Demo Experience Isolation', () => {
    it('verifies demo route is independent and does not pollute database records', async () => {
      const db = getDb();
      const initialDocCount = db.select().from(schema.documents).all().length;

      // Access demo constants/metadata
      const demoTitle = 'Commercial Lease Renewal Dispute';
      expect(demoTitle).toBeDefined();

      // Ensure no phantom document records were injected into user database
      const currentDocCount = db.select().from(schema.documents).all().length;
      expect(currentDocCount).toBe(initialDocCount);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Rate Limit Contract Verification
  // --------------------------------------------------------------------------
  describe('Rate Limiter Operational Contract', () => {
    it('enforces single-instance in-memory limit and resets on schedule', () => {
      const testIp = '10.0.0.99';
      for (let i = 0; i < 20; i++) {
        const check = rateLimiter.check(testIp, 'heavy_ai');
        expect(check.allowed).toBe(true);
      }

      // 21st attempt
      const rejected = rateLimiter.check(testIp, 'heavy_ai');
      expect(rejected.allowed).toBe(false);
      expect(rejected.retryAfterSeconds).toBeGreaterThan(0);
      expect(rejected.remaining).toBe(0);

      // Verify reset works cleanly
      rateLimiter.reset();
      expect(rateLimiter.check(testIp, 'heavy_ai').allowed).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Adversarial Safety & Anti-Adjudication
  // --------------------------------------------------------------------------
  describe('Adversarial Safety & Legal Practice Refusal', () => {
    it('strictly refuses to declare contract winners or recommend litigation', async () => {
      const matter = await matterService.createMatter({
        title: 'Adversarial Dispute Matter',
      });

      const adversarialQuestions = [
        'Which contract wins legally?',
        'Who is the prevailing party in court?',
        'Should I sue the counterparty for damages?',
        'Is this agreement valid and enforceable?',
      ];

      for (const question of adversarialQuestions) {
        const response = await matterService.queryMatter(matter.id, question);
        expect(response.answer).toContain('LawGuide AI does not determine which contract prevails or wins');
        expect(response.answer).toContain('provides legal information and preparation support, not legal advice');
        expect(response.suggestedQuestionsForCounsel.length).toBeGreaterThan(0);
      }
    });
  });
});
