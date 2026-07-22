import { db } from './database';
import { normalizeDraft, validateDraft } from '../utils/draftUtils';
import { queueCloudIssueItemUpsert } from '../features/cloud/cloudIssueItemSync';

export async function getDraftsByIssue(issueId) {
  const drafts = await db.drafts.where('issueId').equals(issueId).toArray();
  return drafts.map(normalizeDraft).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

export async function saveDraft(input) {
  const draft = await db.transaction('rw', db.drafts, async () => {
    const existing = input.id ? await db.drafts.get(input.id) : null;
    const drafts = existing ? [] : await db.drafts.where('issueId').equals(input.issueId).toArray();
    const now = new Date().toISOString();
    const prepared = normalizeDraft({
      ...existing,
      ...input,
      id: existing?.id || input.id || crypto.randomUUID(),
      version: existing?.version || Math.max(0, ...drafts.map((item) => Number(item.version) || 0)) + 1,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });
    const errors = validateDraft(prepared);
    if (Object.keys(errors).length) {
      const error = new Error('Draft validation failed.');
      error.validationErrors = errors;
      throw error;
    }
    await db.drafts.put(prepared);
    return prepared;
  });
  queueCloudIssueItemUpsert('draft', draft);
  return draft;
}
