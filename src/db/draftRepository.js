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

async function createDraftVersion(input, { separateVersion = true } = {}) {
  if (input.id) throw new Error('Saved draft versions are immutable. Save a new version instead.');
  const result = await db.transaction('rw', db.drafts, async () => {
    const drafts = await db.drafts.where('issueId').equals(input.issueId).toArray();
    const now = new Date().toISOString();
    const plan = planDraftStorage(drafts, MAX_DRAFTS_PER_ISSUE);
    const deletedIds = [plan.overwrite?.id, ...plan.deletedIds].filter(Boolean);
    const prepared = normalizeDraft({
      ...input,
      id: crypto.randomUUID(),
      version: plan.nextVersion,
      snapshotSchemaVersion: 1,
      immutableSnapshot: separateVersion,
      savedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const errors = validateDraft(prepared);
    if (Object.keys(errors).length) {
      const error = new Error('Draft validation failed.');
      error.validationErrors = errors;
      throw error;
    }
    const deletedDrafts = deletedIds.length ? await db.drafts.bulkGet(deletedIds) : [];
    if (deletedIds.length) await db.drafts.bulkDelete(deletedIds);
    await db.drafts.put(prepared);
    return { draft: prepared, deletedDrafts: deletedDrafts.filter(Boolean).map(normalizeDraft) };
  });
  await Promise.all(result.deletedDrafts.map((draft) => queueCloudIssueItemDelete('draft', draft)));
  await queueCloudIssueItemUpsert('draft', result.draft);
  return result.draft;
}

export async function saveDraft(input) {
  const targetId = input.id || input.baseDraftId || '';
  if (!targetId) return createDraftVersion(input, { separateVersion: false });
  const existing = await db.drafts.get(targetId);
  if (!existing || existing.issueId !== input.issueId) {
    throw new Error('The draft being edited is no longer available.');
  }
  if (existing.immutableSnapshot) {
    return createDraftVersion({
      ...input,
      id: undefined,
      baseDraftId: existing.id,
      baseVersion: existing.version,
    }, { separateVersion: false });
  }
  const now = new Date().toISOString();
  const prepared = normalizeDraft({
    ...existing,
    ...input,
    id: existing.id,
    version: existing.version,
    baseDraftId: existing.baseDraftId || '',
    baseVersion: existing.baseVersion || 0,
    immutableSnapshot: false,
    savedAt: now,
    createdAt: existing.createdAt,
    updatedAt: now,
    cloudRevision: existing.cloudRevision,
    cloudUpdatedAt: existing.cloudUpdatedAt,
    cloudUpdatedBy: existing.cloudUpdatedBy,
  });
  const errors = validateDraft(prepared);
  if (Object.keys(errors).length) {
    const error = new Error('Draft validation failed.');
    error.validationErrors = errors;
    throw error;
  }
  await db.drafts.put(prepared);
  await queueCloudIssueItemUpsert('draft', prepared);
  return prepared;
}

export async function saveDraftSnapshot(input) {
  return createDraftVersion({ ...input, id: undefined }, { separateVersion: true });
}
