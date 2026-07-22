import { db } from './database';
import { normalizeDraft, planDraftStorage, validateDraft } from '../utils/draftUtils';
import { queueCloudIssueItemDelete, queueCloudIssueItemUpsert } from '../features/cloud/cloudIssueItemSync';

export const MAX_DRAFTS_PER_ISSUE = 5;

export async function getDraftsByIssue(issueId) {
  const drafts = await db.drafts.where('issueId').equals(issueId).toArray();
  return drafts
    .map(normalizeDraft)
    .sort((a, b) => b.version - a.version || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, MAX_DRAFTS_PER_ISSUE);
}

export async function saveDraft(input) {
  const result = await db.transaction('rw', db.drafts, async () => {
    const existing = input.id ? await db.drafts.get(input.id) : null;
    const drafts = existing ? [] : await db.drafts.where('issueId').equals(input.issueId).toArray();
    const now = new Date().toISOString();
    const plan = planDraftStorage(drafts, MAX_DRAFTS_PER_ISSUE);
    const overwrite = existing ? null : plan.overwrite;
    const deletedIds = existing ? [] : [overwrite?.id, ...plan.deletedIds].filter(Boolean);
    const prepared = normalizeDraft({
      ...existing,
      ...input,
      id: existing?.id || input.id || crypto.randomUUID(),
      version: existing?.version || plan.nextVersion,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });
    const errors = validateDraft(prepared);
    if (Object.keys(errors).length) {
      const error = new Error('Draft validation failed.');
      error.validationErrors = errors;
      throw error;
    }
    if (deletedIds.length) await db.drafts.bulkDelete(deletedIds);
    await db.drafts.put(prepared);
    return { draft: prepared, deletedIds };
  });
  result.deletedIds.forEach((id) => queueCloudIssueItemDelete('draft', id));
  queueCloudIssueItemUpsert('draft', result.draft);
  return result.draft;
}
