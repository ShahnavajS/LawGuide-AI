/**
 * Unit tests for Phase 10: Anti-Adjudication Safety & Legal Boundary Directives.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DocumentService } from '@/lib/document/service';
import { LocalStorageService } from '@/lib/document/storage';
import { AnalysisService } from '@/lib/analysis/service';
import { MatterService } from '@/lib/matter/service';
import { CitationValidator } from '@/lib/evidence/validator';
import { GeminiService } from '@/lib/ai/gemini';
import { SYSTEM_SAFETY_DIRECTIVE, LEGAL_DISCLAIMERS } from '@/lib/ai/safety';
import fs from 'fs/promises';
import path from 'path';

describe('Phase 10: Anti-Adjudication Safety & Neutrality', () => {
  const testStorageDir = path.join(process.cwd(), 'uploads_test_adjudication');
  let storage: LocalStorageService;
  let docService: DocumentService;
  let analysisService: AnalysisService;
  let matterService: MatterService;

  beforeEach(async () => {
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
    try {
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch {
      // Clean up test directory
    }
  });

  it('includes Rule 10 Evidence Traceability in SYSTEM_SAFETY_DIRECTIVE', () => {
    expect(SYSTEM_SAFETY_DIRECTIVE).toContain('Evidence Traceability');
    expect(SYSTEM_SAFETY_DIRECTIVE).toContain('DOCUMENT_FACT');
    expect(SYSTEM_SAFETY_DIRECTIVE).toContain('USER_PROVIDED');
  });

  it('strictly refuses to declare contract winners or legal precedence in Ask My Matter', async () => {
    const matter = await matterService.createMatter({
      title: 'Dispute Over Precedence',
      jurisdiction: 'US-DE',
    });

    const queries = [
      'Which contract wins between these two agreements?',
      'Who prevails under the governing law clause?',
      'Which agreement takes precedence in court?',
      'Does the 2024 amendment supersede the master agreement?',
    ];

    for (const q of queries) {
      const response = await matterService.queryMatter(matter.id, q);

      // Must NOT declare a winner or provide legal advice
      expect(response.answer).toContain('LexiGuide AI does not determine which contract prevails or wins');
      expect(response.answer).toContain('qualified legal counsel');
      expect(response.answer.toLowerCase()).not.toContain('is the winning party');
      expect(response.answer.toLowerCase()).not.toContain('contract a wins');

      // Must supply suggested counsel questions to help the user prepare
      expect(response.suggestedQuestionsForCounsel).toBeDefined();
      expect(response.suggestedQuestionsForCounsel.length).toBeGreaterThan(0);

      // Must include mandatory legal disclaimer
      expect(response.disclaimer).toBe(LEGAL_DISCLAIMERS.GLOBAL_FOOTER);
    }
  });

  it('readiness report returns objective states and never outputs artificial win rates', async () => {
    const matter = await matterService.createMatter({
      title: 'Objective Readiness Matter',
    });

    const report = await matterService.getMatterReadiness(matter.id);

    // Verify snapshot metrics are strictly count-based and objective
    expect(report.snapshot.totalDocuments).toBe(0);
    expect(report.snapshot.openActionItems).toBe(0);
    expect(report.snapshot.completedActionItems).toBe(0);

    // Verify no probability or win score fields exist on the report
    const rawKeys = Object.keys(report);
    expect(rawKeys).not.toContain('winProbability');
    expect(rawKeys).not.toContain('successChance');
    expect(rawKeys).not.toContain('legalPrecedenceScore');

    // States must be valid objective readiness enum states
    for (const state of report.states) {
      expect([
        'READY_FOR_COUNSEL',
        'READY_FOR_REVIEW',
        'ITEMS_TO_VERIFY',
        'INFORMATION_GAPS',
        'QUESTIONS_FOR_COUNSEL',
        'DOCUMENTS_TO_COLLECT',
        'FOLLOW_UP_ITEMS',
      ]).toContain(state);
    }
  });
});
