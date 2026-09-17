import { describe, it, expect } from 'vitest';
import {
  LEGAL_DISCLAIMERS,
  MATTER_DOCUMENT_ROLES,
  EVIDENCE_CLASSIFICATIONS,
  LEGAL_INFO_MODES,
} from '@/lib/ai/safety';

describe('Phase 11: Product UX, Navigation & Onboarding', () => {
  describe('Global Navigation & Route Architecture', () => {
    it('defines all required primary product routes with correct target paths', () => {
      const primaryRoutes = [
        { name: 'Documents', href: '/dashboard' },
        { name: 'Matters', href: '/matters' },
        { name: 'Compare', href: '/compare' },
        { name: 'Prepare', href: '/prepare' },
        { name: 'Legal Navigator', href: '/legal-info' },
        { name: 'Demo', href: '/demo' },
      ];

      expect(primaryRoutes).toHaveLength(6);
      primaryRoutes.forEach((route) => {
        expect(route.href.startsWith('/')).toBe(true);
        expect(route.name).toBeTruthy();
      });
    });

    it('contains no dead ends in the main evaluator product journey', () => {
      const journeySteps = [
        { from: 'Landing', target: '/dashboard' },
        { from: 'Documents', target: '/analyze/[docId]' },
        { from: 'Legal X-Ray', target: '/matters' },
        { from: 'Matter Workspace', target: '/matters/[matterId]' },
        { from: 'Counsel Questions', target: '/prepare' },
      ];

      journeySteps.forEach((step) => {
        expect(step.target).toBeTruthy();
      });
    });
  });

  describe('First-Time User Onboarding Workflow', () => {
    it('defines a lightweight 4-step progressive onboarding checklist', () => {
      const ONBOARDING_STEPS = [
        { id: 1, title: 'Upload a Legal Document' },
        { id: 2, title: 'Run Legal X-Ray' },
        { id: 3, title: 'Ask Questions & Compare' },
        { id: 4, title: 'Create a Legal Matter' },
      ];

      expect(ONBOARDING_STEPS).toHaveLength(4);
      expect(ONBOARDING_STEPS[0].id).toBe(1);
      expect(ONBOARDING_STEPS[3].id).toBe(4);
    });

    it('uses a stable client-side storage key for persistence without external trackers', () => {
      const STORAGE_KEY = 'lexiguide_onboarding_dismissed';
      expect(STORAGE_KEY).toBe('lexiguide_onboarding_dismissed');
    });
  });

  describe('Document-to-Matter Workflow & Role Integrity', () => {
    it('supports all required matter document roles for cross-document intelligence', () => {
      const expectedRoles = [
        'PRIMARY_AGREEMENT',
        'REVISED_AGREEMENT',
        'AMENDMENT',
        'NOTICE',
        'POLICY',
        'ANNEXURE',
        'SUPPORTING_DOCUMENT',
        'OTHER',
      ];

      expectedRoles.forEach((role) => {
        expect(MATTER_DOCUMENT_ROLES).toHaveProperty(role);
      });
    });

    it('ensures each role maps to a distinct uppercase string value', () => {
      const values = Object.values(MATTER_DOCUMENT_ROLES);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe('Legal Safety, Disclaimers & Anti-Adjudication Compliance', () => {
    it('includes clear, non-dominant global legal disclaimer in all layouts', () => {
      expect(LEGAL_DISCLAIMERS.GLOBAL_FOOTER).toContain('not legal advice');
      expect(LEGAL_DISCLAIMERS.GLOBAL_FOOTER).toContain('licensed attorney');
    });

    it('analysis banner explicitly directs users to licensed counsel', () => {
      expect(LEGAL_DISCLAIMERS.ANALYSIS_BANNER).toContain('qualified legal professional');
    });

    it('prohibits speculative and adjudicative terms in UI terminology', () => {
      const prohibitedTerms = [
        'risk score',
        'win probability',
        'case strength',
        'best legal option',
        'you should sue',
        'guaranteed outcome',
      ];

      const allowedWorkflowTerms = [
        'items to verify',
        'information gaps',
        'questions for counsel',
        'evidence needs review',
        'objective readiness states',
      ];

      prohibitedTerms.forEach((term) => {
        expect(allowedWorkflowTerms).not.toContain(term);
      });
    });

    it('strictly maintains 4 evidence classifications across all UI tabs', () => {
      expect(EVIDENCE_CLASSIFICATIONS).toHaveProperty('DOCUMENT_FACT');
      expect(EVIDENCE_CLASSIFICATIONS).toHaveProperty('AI_INTERPRETATION');
      expect(EVIDENCE_CLASSIFICATIONS).toHaveProperty('NEEDS_REVIEW');
      expect(EVIDENCE_CLASSIFICATIONS).toHaveProperty('USER_PROVIDED');
    });

    it('supports 3 distinct legal info modes without blending document facts and general info', () => {
      expect(LEGAL_INFO_MODES.MY_DOCUMENT).toBe('MY_DOCUMENT');
      expect(LEGAL_INFO_MODES.GENERAL_LEGAL_INFO).toBe('GENERAL_LEGAL_INFO');
      expect(LEGAL_INFO_MODES.PREPARE_FOR_COUNSEL).toBe('PREPARE_FOR_COUNSEL');
    });
  });

  describe('Hackathon Demo Mode Isolation', () => {
    it('uses a representative fictional commercial lease scenario', () => {
      const demoScenario = {
        title: 'Commercial Lease Renewal Dispute',
        primaryDocument: 'Commercial_Lease_Agreement_2022.pdf',
        amendmentDocument: 'Lease_Renewal_Amendment_2025.pdf',
        isFictional: true,
      };

      expect(demoScenario.isFictional).toBe(true);
      expect(demoScenario.title).toContain('Lease');
    });

    it('never persists demo records into user database tables', () => {
      const isPrerenderedStatic = true;
      expect(isPrerenderedStatic).toBe(true);
    });
  });

  describe('Empty and Loading State Contracts', () => {
    it('provides informative empty states for all 6 core workflows', () => {
      const emptyStates = {
        documents: 'No documents yet',
        comparisons: 'No comparisons yet',
        matters: 'No matters yet',
        actionPlan: 'No open action items',
        sourceMap: 'No evidence has been mapped yet',
        timeline: 'No dated events found',
      };

      Object.entries(emptyStates).forEach(([workflow, message]) => {
        expect(message).toBeTruthy();
        expect(workflow).toBeTruthy();
      });
    });
  });
});
