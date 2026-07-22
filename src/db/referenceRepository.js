import { db } from './database';
import { normalizeReference, validateReference } from '../utils/referenceUtils';
import { queueCloudIssueItemDelete, queueCloudIssueItemUpsert } from '../features/cloud/cloudIssueItemSync';

function requireValidReference(input) {
  const reference = normalizeReference(input);
  const errors = validateReference(reference);
  if (Object.keys(errors).length) {
    const error = new Error('Reference validation failed.');
    error.validationErrors = errors;
    throw error;
  }
  return reference;
}

export async function getReferencesByIssue(issueId) {
  const items = await db.references.where('issueId').equals(issueId).toArray();
  return items
    .map(normalizeReference)
    .sort((a, b) => (b.referenceDate || '').localeCompare(a.referenceDate || '') || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export async function saveReference(input) {
  const now = new Date().toISOString();
  const existing = input.id ? await db.references.get(input.id) : null;
  const reference = requireValidReference({
    ...existing,
    ...input,
    id: input.id || crypto.randomUUID(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });
  await db.references.put(reference);
  queueCloudIssueItemUpsert('reference', reference);
  return reference;
}

export async function deleteReference(id) {
  await db.references.delete(id);
  queueCloudIssueItemDelete('reference', id);
}
