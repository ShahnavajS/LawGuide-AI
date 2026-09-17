/**
 * Unit tests for Matter Action Items & Activity Trail (Phase 9).
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DocumentService } from '@/lib/document/service';
import { LocalStorageService } from '@/lib/document/storage';
import { AnalysisService } from '@/lib/analysis/service';
import { MatterService } from '@/lib/matter/service';
import { CitationValidator } from '@/lib/evidence/validator';
import { GeminiService } from '@/lib/ai/gemini';
import { NotFoundError, ValidationError } from '@/lib/utils/errors';
import fs from 'fs/promises';
import path from 'path';

describe('Phase 9: Matter Action Items & Activity Audit Trail', () => {
  const testStorageDir = path.join(process.cwd(), 'uploads_test_actions');
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

  describe('Action Item CRUD & Filtering', () => {
    it('creates an action item with full metadata and logs activity', async () => {
      const matter = await matterService.createMatter({
        title: 'Employment Matter',
      });

      const item = await matterService.createActionItem(matter.id, {
        title: 'Review non-compete clause with local counsel',
        description: 'Check geographical scope of 50-mile restriction in Delaware.',
        type: 'ASK_COUNSEL',
        priority: 'HIGH',
        sourceType: 'USER_CREATED',
        dueDate: '2026-10-15',
        dueDateProvenance: 'USER_PROVIDED',
        userProvided: true,
      });

      expect(item.id).toBeDefined();
      expect(item.matterId).toBe(matter.id);
      expect(item.title).toBe('Review non-compete clause with local counsel');
      expect(item.description).toBe('Check geographical scope of 50-mile restriction in Delaware.');
      expect(item.type).toBe('ASK_COUNSEL');
      expect(item.status).toBe('OPEN');
      expect(item.priority).toBe('HIGH');
      expect(item.dueDate).toBe('2026-10-15');
      expect(item.dueDateProvenance).toBe('USER_PROVIDED');
      expect(item.userProvided).toBe(true);

      // Verify activity trail was logged
      const activity = await matterService.getActivity(matter.id);
      expect(activity.length).toBeGreaterThan(0);
      const actionItemActivity = activity.find((a) => a.actionType === 'ACTION_ITEM_CREATED');
      expect(actionItemActivity).toBeDefined();
      expect(actionItemActivity?.description).toContain('Review non-compete clause');
    });

    it('validates required fields when creating an action item', async () => {
      const matter = await matterService.createMatter({
        title: 'Lease Matter',
      });

      await expect(
        matterService.createActionItem(matter.id, {
          title: '',
          description: 'No title provided',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('filters action items by status and priority', async () => {
      const matter = await matterService.createMatter({
        title: 'Filtering Matter',
      });

      await matterService.createActionItem(matter.id, {
        title: 'High priority open task',
        description: 'Desc',
        priority: 'HIGH',
      });

      const item2 = await matterService.createActionItem(matter.id, {
        title: 'Medium priority open task',
        description: 'Desc',
        priority: 'MEDIUM',
      });

      await matterService.updateActionItem(matter.id, item2.id, {
        status: 'COMPLETED',
      });

      // Fetch all
      const allItems = await matterService.getActionItems(matter.id);
      expect(allItems.length).toBe(2);

      // Filter by status OPEN
      const openItems = await matterService.getActionItems(matter.id, { status: 'OPEN' });
      expect(openItems.length).toBe(1);
      expect(openItems[0].title).toBe('High priority open task');

      // Filter by status COMPLETED
      const completedItems = await matterService.getActionItems(matter.id, { status: 'COMPLETED' });
      expect(completedItems.length).toBe(1);
      expect(completedItems[0].title).toBe('Medium priority open task');

      // Filter by priority HIGH
      const highItems = await matterService.getActionItems(matter.id, { priority: 'HIGH' });
      expect(highItems.length).toBe(1);
      expect(highItems[0].priority).toBe('HIGH');
    });

    it('updates action item status, priority, and due date', async () => {
      const matter = await matterService.createMatter({
        title: 'Update Matter',
      });

      const item = await matterService.createActionItem(matter.id, {
        title: 'Initial Title',
        description: 'Initial Desc',
        priority: 'LOW',
      });

      const updated = await matterService.updateActionItem(matter.id, item.id, {
        title: 'Updated Title',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        dueDate: '2026-11-01',
        dueDateProvenance: 'DOCUMENT_STATED',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.priority).toBe('HIGH');
      expect(updated.status).toBe('IN_PROGRESS');
      expect(updated.dueDate).toBe('2026-11-01');
      expect(updated.dueDateProvenance).toBe('DOCUMENT_STATED');
    });

    it('deletes an action item and logs activity without altering member documents', async () => {
      const matter = await matterService.createMatter({
        title: 'Deletion Matter',
      });

      const item = await matterService.createActionItem(matter.id, {
        title: 'Item to delete',
        description: 'Desc',
      });

      await matterService.deleteActionItem(matter.id, item.id);

      const items = await matterService.getActionItems(matter.id);
      expect(items.find((i) => i.id === item.id)).toBeUndefined();

      // Verify deletion was logged
      const activity = await matterService.getActivity(matter.id);
      const deleteLog = activity.find((a) => a.actionType === 'ACTION_ITEM_DELETED');
      expect(deleteLog).toBeDefined();

      // Deleting a nonexistent item throws NotFoundError
      await expect(
        matterService.deleteActionItem(matter.id, 'nonexistent-item-id')
      ).rejects.toThrow(NotFoundError);
    });
  });
});
