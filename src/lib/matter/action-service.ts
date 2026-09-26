import { getDb, schema } from '@/lib/db';
import {
  LegalXRayAnalysis,
  MatterActionItem,
  CreateActionItemInput,
  UpdateActionItemInput,
  MatterSnapshotMetrics,
  MatterReadinessReport,
  MatterReadinessState,
} from '@/lib/ai/schemas';
import { ActionItemType, ActionItemStatus, ActionItemPriority, ActionItemSourceType, DateProvenanceType, MatterActivityType } from '@/lib/ai/safety';
import { generateId } from '@/lib/utils/id';
import { NotFoundError, ValidationError } from '@/lib/utils/errors';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { getCurrentUserId } from '@/lib/auth/context';
import { MatterQueryService } from './query-service';

export class MatterActionService extends MatterQueryService {

  /**
   * Creates an action item in the matter action plan.
   */
  public async createActionItem(
    matterId: string,
    input: CreateActionItemInput
  ): Promise<MatterActionItem> {
    const trimmedTitle = typeof input?.title === 'string' ? input.title.trim() : '';
    const trimmedDesc = typeof input?.description === 'string' ? input.description.trim() : '';
    if (!trimmedTitle) {
      throw new ValidationError('Action item title is required.');
    }

    const matter = await this.getMatter(matterId);

    const db = getDb();
    const memberIds = new Set(matter.documents.map((doc) => doc.documentId));
    if (input.relatedDocumentId && !memberIds.has(input.relatedDocumentId)) {
      throw new ValidationError('Related document must belong to this matter.');
    }
    if (input.relatedComparisonId) {
      const userId = getCurrentUserId();
      const comparison = db.select({
        baseDocumentId: schema.comparisons.baseDocumentId,
        targetDocumentId: schema.comparisons.targetDocumentId,
      }).from(schema.comparisons)
        .where(and(
          eq(schema.comparisons.id, input.relatedComparisonId),
          eq(schema.comparisons.userId, userId)
        )).get();
      if (!comparison || !memberIds.has(comparison.baseDocumentId) || !memberIds.has(comparison.targetDocumentId)) {
        throw new ValidationError('Related comparison must use documents in this matter.');
      }
    }
    if (input.relatedRelationshipId) {
      const relationship = db.select({ matterId: schema.documentRelationships.matterId })
        .from(schema.documentRelationships)
        .where(eq(schema.documentRelationships.id, input.relatedRelationshipId)).get();
      if (relationship?.matterId !== matterId) {
        throw new ValidationError('Related relationship must belong to this matter.');
      }
    }
    const id = generateId('mact_item');
    const now = new Date().toISOString();

    const record = {
      id,
      matterId,
      title: trimmedTitle,
      description: trimmedDesc,
      type: input.type || 'FOLLOW_UP',
      status: 'OPEN' as const,
      priority: input.priority || 'MEDIUM',
      sourceType: input.sourceType || 'MANUAL',
      sourceReference: input.sourceReference || null,
      relatedDocumentId: input.relatedDocumentId || null,
      relatedComparisonId: input.relatedComparisonId || null,
      relatedRelationshipId: input.relatedRelationshipId || null,
      relatedConsistencyFindingId: input.relatedConsistencyFindingId || null,
      userProvided: input.userProvided ? true : false,
      dueDate: input.dueDate || null,
      dueDateProvenance: input.dueDateProvenance || null,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(schema.matterActionItems).values(record).run();

    await this.logActivity(
      matterId,
      'ACTION_ITEM_CREATED',
      `Created action item: "${trimmedTitle}"`,
      { itemId: id, type: record.type, priority: record.priority }
    );

    return {
      ...record,
      userProvided: Boolean(record.userProvided),
    };
  }

  /**
   * Retrieves action items for a matter with optional filtering.
   */
  public async getActionItems(
    matterId: string,
    filter?: {
      status?: ActionItemStatus;
      priority?: ActionItemPriority;
      itemType?: ActionItemType;
    }
  ): Promise<MatterActionItem[]> {
    this.assertMatterOwned(matterId);
    const db = getDb();
    const conditions = [eq(schema.matterActionItems.matterId, matterId)];

    if (filter?.status) {
      conditions.push(eq(schema.matterActionItems.status, filter.status));
    }
    if (filter?.priority) {
      conditions.push(eq(schema.matterActionItems.priority, filter.priority));
    }
    if (filter?.itemType) {
      conditions.push(eq(schema.matterActionItems.type, filter.itemType));
    }

    const rows = db
      .select()
      .from(schema.matterActionItems)
      .where(and(...conditions))
      .orderBy(desc(schema.matterActionItems.createdAt))
      .all();

    // Query document titles for member documents in this matter
    const docMap = new Map<string, string>();
    const matterDocs = rows.some((row) => row.relatedDocumentId) ? db
      .select({ id: schema.documents.id, title: schema.documents.title })
      .from(schema.documents)
      .innerJoin(
        schema.matterDocuments,
        eq(schema.documents.id, schema.matterDocuments.documentId)
      )
      .where(and(
        eq(schema.matterDocuments.matterId, matterId),
        eq(schema.documents.userId, getCurrentUserId())
      ))
      .all() : [];
    for (const d of matterDocs) {
      docMap.set(d.id, d.title);
    }

    return rows.map((r) => {
      const isUser =
        r.sourceType === 'USER_CREATED' ||
        r.sourceType === 'MANUAL' ||
        Boolean(r.userProvided);
      const docTitle = r.relatedDocumentId
        ? docMap.get(r.relatedDocumentId) || null
        : null;

      let why = 'Derived from matter analysis.';
      if (isUser) {
        why = 'User-created preparation task.';
      } else if (r.sourceType === 'CONSISTENCY') {
        why = `Generated from Cross-Document Consistency observation${
          r.sourceReference ? ` (${r.sourceReference})` : ''
        }.`;
      } else if (r.sourceType === 'RELATIONSHIP') {
        why = `Generated from Cross-Document Relationship verification${
          r.sourceReference ? ` (${r.sourceReference})` : ''
        }.`;
      } else if (r.sourceType === 'LEGAL_XRAY' || r.sourceType === 'DOCUMENT') {
        why = `Generated from Legal X-Ray analysis of ${
          docTitle || 'member document'
        }.`;
      } else if (r.sourceType === 'TIMELINE') {
        why = 'Generated from Matter Chronology event.';
      }

      const evidenceChain = r.relatedDocumentId
        ? [
            {
              documentId: r.relatedDocumentId,
              documentTitle: docTitle || 'Member Document',
              pageNumber: undefined,
              quotedText: undefined,
              classification: 'NEEDS_REVIEW' as const,
              verificationStatus: 'UNVERIFIED' as const,
            },
          ]
        : undefined;

      return {
        id: r.id,
        matterId: r.matterId,
        title: r.title,
        description: r.description,
        type: r.type as ActionItemType,
        status: r.status as ActionItemStatus,
        priority: r.priority as ActionItemPriority,
        sourceType: r.sourceType as ActionItemSourceType,
        sourceReference: r.sourceReference,
        relatedDocumentId: r.relatedDocumentId,
        relatedDocumentTitle: docTitle,
        relatedComparisonId: r.relatedComparisonId,
        relatedRelationshipId: r.relatedRelationshipId,
        relatedConsistencyFindingId: r.relatedConsistencyFindingId,
        userProvided: Boolean(r.userProvided),
        dueDate: r.dueDate,
        dueDateProvenance: r.dueDateProvenance as DateProvenanceType | null,
        whyThisExists: why,
        isUserCreated: isUser,
        evidenceChain,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });
  }

  /**
   * Updates an action item.
   */
  public async updateActionItem(
    matterId: string,
    itemId: string,
    input: UpdateActionItemInput
  ): Promise<MatterActionItem> {
    this.assertMatterOwned(matterId);
    const db = getDb();
    const [existing] = db
      .select()
      .from(schema.matterActionItems)
      .where(
        and(
          eq(schema.matterActionItems.id, itemId),
          eq(schema.matterActionItems.matterId, matterId)
        )
      )
      .all();

    if (!existing) {
      throw new NotFoundError(`Action item ${itemId} not found in matter ${matterId}`);
    }

    const updates: Partial<typeof schema.matterActionItems.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    if (input.title !== undefined) updates.title = input.title.trim();
    if (input.description !== undefined) updates.description = input.description.trim();
    if (input.type !== undefined) updates.type = input.type;
    if (input.status !== undefined) updates.status = input.status;
    if (input.priority !== undefined) updates.priority = input.priority;
    if (input.dueDate !== undefined) updates.dueDate = input.dueDate;
    if (input.dueDateProvenance !== undefined) updates.dueDateProvenance = input.dueDateProvenance;

    db.update(schema.matterActionItems)
      .set(updates)
      .where(
        and(
          eq(schema.matterActionItems.id, itemId),
          eq(schema.matterActionItems.matterId, matterId)
        )
      )
      .run();

    const activityType: MatterActivityType =
      input.status === 'COMPLETED' ? 'ACTION_ITEM_COMPLETED' : 'ACTION_ITEM_UPDATED';

    await this.logActivity(
      matterId,
      activityType,
      input.status === 'COMPLETED'
        ? `Completed action item: "${existing.title}"`
        : `Updated action item: "${existing.title}"`,
      { itemId, changes: input }
    );

    const [updated] = db
      .select()
      .from(schema.matterActionItems)
      .where(eq(schema.matterActionItems.id, itemId))
      .all();

    return {
      id: updated.id,
      matterId: updated.matterId,
      title: updated.title,
      description: updated.description,
      type: updated.type as ActionItemType,
      status: updated.status as ActionItemStatus,
      priority: updated.priority as ActionItemPriority,
      sourceType: updated.sourceType as ActionItemSourceType,
      sourceReference: updated.sourceReference,
      relatedDocumentId: updated.relatedDocumentId,
      relatedComparisonId: updated.relatedComparisonId,
      relatedRelationshipId: updated.relatedRelationshipId,
      relatedConsistencyFindingId: updated.relatedConsistencyFindingId,
      userProvided: Boolean(updated.userProvided),
      dueDate: updated.dueDate,
      dueDateProvenance: updated.dueDateProvenance as DateProvenanceType | null,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Deletes an action item.
   */
  public async deleteActionItem(matterId: string, itemId: string): Promise<void> {
    this.assertMatterOwned(matterId);
    const db = getDb();
    const [existing] = db
      .select()
      .from(schema.matterActionItems)
      .where(
        and(
          eq(schema.matterActionItems.id, itemId),
          eq(schema.matterActionItems.matterId, matterId)
        )
      )
      .all();

    if (!existing) {
      throw new NotFoundError(`Action item ${itemId} not found in matter ${matterId}`);
    }

    db.delete(schema.matterActionItems)
      .where(
        and(
          eq(schema.matterActionItems.id, itemId),
          eq(schema.matterActionItems.matterId, matterId)
        )
      )
      .run();

    await this.logActivity(
      matterId,
      'ACTION_ITEM_DELETED',
      `Deleted action item "${existing.title}".`
    );
  }

  /**
   * Automatically generates action items from cross-document consistency checks,
   * unverified relationships, and member document attention areas/missing facts.
   * Deduplicates against existing open items.
   */
  public async generateActionItems(
    matterId: string
  ): Promise<{ createdCount: number; items: MatterActionItem[] }> {
    const matter = await this.getMatter(matterId);
    const existingItems = await this.getActionItems(matterId);
    const existingTitles = new Set(existingItems.map((i) => i.title.toLowerCase()));

    const newCandidates: CreateActionItemInput[] = [];

    // 1. Consistency discrepancies
    const consistencyFindings = await this.checkConsistency(matterId);
    for (const finding of consistencyFindings) {
      const title = `Verify consistency: ${finding.category} discrepancy`;
      if (existingTitles.has(title.toLowerCase())) continue;

      newCandidates.push({
        title,
        description: `Discrepancy identified between "${finding.sourceA.documentTitle}" (${finding.sourceA.value}) and "${finding.sourceB.documentTitle}" (${finding.sourceB.value}). Review both clauses to prepare discussion for counsel.`,
        type: 'REVIEW_CONSISTENCY',
        priority: finding.severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
        sourceType: 'CONSISTENCY',
        sourceReference: `Consistency Finding ${finding.id}`,
        relatedDocumentId: finding.sourceA.documentId,
        relatedConsistencyFindingId: finding.id,
      });
      existingTitles.add(title.toLowerCase());
    }

    // 2. Unverified relationships
    const relationships = await this.getRelationships(matterId);
    for (const rel of relationships) {
      if (rel.status === 'SUGGESTED') {
        const title = `Confirm relationship: ${rel.sourceDocumentTitle} → ${rel.targetDocumentTitle}`;
        if (existingTitles.has(title.toLowerCase())) continue;

        newCandidates.push({
          title,
          description: `Suggested relationship "${rel.relationshipType}": ${rel.description}. Confirm if this matches your legal context.`,
          type: 'CONFIRM_USER_CONTEXT',
          priority: 'MEDIUM',
          sourceType: 'RELATIONSHIP',
          sourceReference: `Relationship ${rel.id}`,
          relatedDocumentId: rel.sourceDocumentId,
          relatedRelationshipId: rel.id,
        });
        existingTitles.add(title.toLowerCase());
      }
    }

    // 3. Member document attention areas & missing information
    const db = getDb();
    const docIds = matter.documents.map((d) => d.documentId);
    if (docIds.length > 0) {
      const analysesList = db
        .select({
          documentId: schema.analyses.documentId,
          analysisDataJson: schema.analyses.analysisDataJson,
        })
        .from(schema.analyses)
        .where(inArray(schema.analyses.documentId, docIds))
        .all();

      for (const a of analysesList) {
        if (!a.analysisDataJson) continue;
        const doc = matter.documents.find((d) => d.documentId === a.documentId);
        const docTitle = doc?.title || 'Document';

        try {
          const parsed = JSON.parse(a.analysisDataJson) as LegalXRayAnalysis;

          // Attention areas (High/Medium severity)
          if (parsed.attentionAreas) {
            for (const aa of parsed.attentionAreas) {
              if (aa.attentionLevel === 'HIGH' || aa.attentionLevel === 'MEDIUM') {
                const title = `Review critical term: ${aa.title || aa.category} in ${docTitle}`;
                if (existingTitles.has(title.toLowerCase())) continue;

                newCandidates.push({
                  title,
                  description: `${aa.description || aa.whyItMatters}. Located on page ${aa.pageNumber || 1}.`,
                  type: 'REVIEW_DOCUMENT',
                  priority: aa.attentionLevel === 'HIGH' ? 'HIGH' : 'MEDIUM',
                  sourceType: 'LEGAL_XRAY',
                  sourceReference: `Page ${aa.pageNumber || 1} in ${docTitle}`,
                  relatedDocumentId: a.documentId,
                });
                existingTitles.add(title.toLowerCase());
              }
            }
          }
        } catch {
          // ignore parse errors
        }
      }

      // Also check if any preparation briefs exist for member documents with missingInformation
      const prepRecords = db
        .select({
          documentId: schema.preparations.documentId,
          preparationDataJson: schema.preparations.preparationDataJson,
        })
        .from(schema.preparations)
        .where(and(
          eq(schema.preparations.userId, getCurrentUserId()),
          inArray(schema.preparations.documentId, docIds),
          eq(schema.preparations.briefKind, 'PREPARATION')
        ))
        .all();

      for (const pr of prepRecords) {
        if (!pr.preparationDataJson) continue;
        try {
          const prepBrief = JSON.parse(pr.preparationDataJson);
          if (prepBrief.missingInformation) {
            for (const mi of prepBrief.missingInformation) {
              const title = `Collect missing document / fact: ${mi.item}`;
              if (existingTitles.has(title.toLowerCase())) continue;

              newCandidates.push({
                title,
                description: `Identified gap: ${mi.whyItMatters}. Prepare this record for consultation.`,
                type: 'PROVIDE_MISSING_INFORMATION',
                priority: 'MEDIUM',
                sourceType: 'MISSING_INFO',
                sourceReference: `Missing item in preparation`,
                relatedDocumentId: pr.documentId || undefined,
              });
              existingTitles.add(title.toLowerCase());
            }
          }
        } catch {
          // ignore
        }
      }

      // 4. Check for member documents without analysis or needing initial review
      for (const doc of matter.documents) {
        const hasAnalysis = analysesList.some((a) => a.documentId === doc.documentId);
        if (!hasAnalysis) {
          const title = `Perform Legal X-Ray analysis on "${doc.title}"`;
          if (!existingTitles.has(title.toLowerCase())) {
            newCandidates.push({
              title,
              description: `Document "${doc.title}" has been added to this matter with role ${doc.role}. Run Legal X-Ray analysis to extract key terms and clauses.`,
              type: 'REQUEST_DOCUMENT',
              priority: 'HIGH',
              sourceType: 'DOCUMENT',
              sourceReference: `Member Document ${doc.documentId}`,
              relatedDocumentId: doc.documentId,
            });
            existingTitles.add(title.toLowerCase());
          }
        }
      }
    }

    // Insert created candidates
    const createdItems: MatterActionItem[] = [];
    for (const cand of newCandidates) {
      const created = await this.createActionItem(matterId, cand);
      createdItems.push(created);
    }

    if (createdItems.length > 0) {
      await this.logActivity(
        matterId,
        'ACTION_ITEMS_GENERATED',
        `Generated ${createdItems.length} preparation action items`,
        { count: createdItems.length }
      );
    }

    const allItems = await this.getActionItems(matterId);
    return {
      createdCount: createdItems.length,
      items: allItems,
    };
  }

  /**
   * Computes an objective matter readiness report without artificial win-rates or advice.
   */
  public async getMatterReadiness(matterId: string): Promise<MatterReadinessReport> {
    const matter = await this.getMatter(matterId);
    const db = getDb();

    const totalDocuments = matter.documents.length;
    const analyzedDocuments = matter.documents.filter((d) => d.status === 'READY').length;

    // Timeline events
    const timeline = await this.getTimeline(matterId);
    const timelineEvents = timeline.length;

    // Relationships
    const relationships = await this.getRelationships(matterId);
    const verifiedRelationships = relationships.filter((r) => r.status === 'CONFIRMED').length;
    const relationshipsNeedingReview = relationships.filter((r) => r.status === 'SUGGESTED').length;

    // Consistency findings
    const consistencyFindings = matter.metrics.totalInconsistencies;

    // Action items
    const actionItems = await this.getActionItems(matterId);
    const openActionItems = actionItems.filter(
      (i) => i.status === 'OPEN' || i.status === 'IN_PROGRESS'
    ).length;
    const completedActionItems = actionItems.filter((i) => i.status === 'COMPLETED').length;

    // Information gaps and counsel questions from member analyses
    let informationGaps = actionItems.filter(
      (i) => i.type === 'PROVIDE_MISSING_INFORMATION' && i.status !== 'COMPLETED'
    ).length;
    let counselQuestions = consistencyFindings;
    const docIds = matter.documents.map((d) => d.documentId);

    if (docIds.length > 0) {
      const analysesList = db
        .select({ analysisDataJson: schema.analyses.analysisDataJson })
        .from(schema.analyses)
        .where(inArray(schema.analyses.documentId, docIds))
        .all();

      for (const a of analysesList) {
        if (!a.analysisDataJson) continue;
        try {
          const parsed = JSON.parse(a.analysisDataJson) as LegalXRayAnalysis;
          if (parsed.attentionAreas) {
            const gaps = parsed.attentionAreas.filter(
              (aa) => aa.attentionLevel === 'HIGH' || aa.category === 'OTHER'
            );
            informationGaps += gaps.length;
          }
          if (parsed.lawyerQuestions) {
            counselQuestions += parsed.lawyerQuestions.length;
          }
        } catch {
          // ignore
        }
      }
    }

    // User notes
    const notes = await this.getNotes(matterId);
    const userNotes = notes.length;

    const snapshot: MatterSnapshotMetrics = {
      totalDocuments,
      analyzedDocuments,
      timelineEvents,
      verifiedRelationships,
      relationshipsNeedingReview,
      consistencyFindings,
      openActionItems,
      completedActionItems,
      counselQuestions,
      informationGaps,
      userNotes,
    };

    // Derive readiness states
    const states: MatterReadinessState[] = [];
    const recommendations: string[] = [];

    const verifyItems = actionItems.filter(
      (i) =>
        (i.type === 'VERIFY_TERM' || i.type === 'REVIEW_CONSISTENCY') &&
        i.status !== 'COMPLETED'
    );

    if (consistencyFindings > 0 || relationshipsNeedingReview > 0 || verifyItems.length > 0) {
      states.push('ITEMS_TO_VERIFY');
      if (consistencyFindings > 0) {
        recommendations.push(
          `Review ${consistencyFindings} cross-document consistency discrepancy findings.`
        );
      }
      if (relationshipsNeedingReview > 0) {
        recommendations.push(
          `Confirm or reject ${relationshipsNeedingReview} suggested document relationships.`
        );
      }
      if (verifyItems.length > 0) {
        recommendations.push(
          `Verify ${verifyItems.length} specific terms flagged in action items.`
        );
      }
    }

    if (informationGaps > 0) {
      states.push('INFORMATION_GAPS');
      recommendations.push(
        `Address ${informationGaps} missing fact or document items identified across member documents.`
      );
    }

    if (counselQuestions > 0) {
      states.push('QUESTIONS_FOR_COUNSEL');
      recommendations.push(
        `Prepare questions on ${counselQuestions} specific points for consultation with legal counsel.`
      );
    }

    const collectDocs = actionItems.filter(
      (i) =>
        (i.type === 'COLLECT_DOCUMENT' || i.type === 'PROVIDE_MISSING_INFORMATION') &&
        i.status !== 'COMPLETED'
    );
    if (collectDocs.length > 0) {
      states.push('DOCUMENTS_TO_COLLECT');
      recommendations.push(
        `Gather ${collectDocs.length} pending documentation items noted in the action plan.`
      );
    }

    if (openActionItems > 0) {
      states.push('FOLLOW_UP_ITEMS');
      recommendations.push(`Complete ${openActionItems} open preparation items before meeting counsel.`);
    }

    if (
      totalDocuments > 0 &&
      analyzedDocuments === totalDocuments &&
      consistencyFindings === 0 &&
      openActionItems === 0
    ) {
      states.push('READY_FOR_REVIEW');
      recommendations.push(
        'All member documents are analyzed and no pending discrepancies remain.'
      );
    }

    if (states.length === 0) {
      states.push('READY_FOR_REVIEW');
    }

    const summary = `Matter "${matter.title}" includes ${totalDocuments} document${
      totalDocuments === 1 ? '' : 's'
    } (${analyzedDocuments} analyzed), ${consistencyFindings} consistency finding${
      consistencyFindings === 1 ? '' : 's'
    }, and ${openActionItems} open preparation task${openActionItems === 1 ? '' : 's'}.`;

    return {
      matterId,
      states,
      summary,
      snapshot,
      recommendations,
    };
  }}
