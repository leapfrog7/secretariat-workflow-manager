import { db } from './database';
import {
  normalizeIssueReferenceLink,
  normalizeReference,
  normalizeWorkspaceReference,
  validateWorkspaceReference,
} from '../utils/referenceUtils';
import { queueIssueReferenceLinkDelete, queueIssueReferenceLinkUpsert, queueWorkspaceReferenceUpsert } from '../features/cloud/referenceLibrarySync';

function requireValid(input) {
  const reference = normalizeWorkspaceReference(input);
  const errors = validateWorkspaceReference(reference);
  if (Object.keys(errors).length) {
    const error = new Error('Check the reference details.');
    error.validationErrors = errors;
    throw error;
  }
  return reference;
}

function synchronizeInBackground(operation) {
  void operation.catch((error) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('swm:reference-sync-error', { detail: { message: error.message || 'Reference synchronization failed.' } }));
  });
}

function issueReferenceView(reference, link) {
  const extracts = reference.extracts.filter((item) => link.extractIds.includes(item.id));
  const selectedText = link.includeFullText
    ? reference.retainedText
    : extracts.map((item) => `${item.title}\n${item.content}`).join('\n\n');
  return normalizeReference({
    id: link.id,
    issueId: link.issueId,
    citation: reference.citation || reference.title,
    referenceDate: reference.referenceDate,
    notes: [link.relevanceNote, selectedText].filter(Boolean).join('\n\n'),
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
    libraryReferenceId: reference.id,
    reference,
    link,
  });
}

export async function getWorkspaceReferences({ includeArchived = false } = {}) {
  const items = await db.workspaceReferences.toArray();
  return items.map(normalizeWorkspaceReference)
    .filter((item) => includeArchived || item.status === 'active')
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function getWorkspaceReference(id) {
  const item = await db.workspaceReferences.get(id);
  return item ? normalizeWorkspaceReference(item) : null;
}

export async function saveWorkspaceReference(input, ownerUserId = '') {
  const existing = input.id ? await db.workspaceReferences.get(input.id) : null;
  const reference = requireValid({
    ...existing, ...input,
    ownerUserId: input.ownerUserId || existing?.ownerUserId || ownerUserId,
    updatedAt: new Date().toISOString(), cloudPending: true,
  });
  await db.workspaceReferences.put(reference);
  synchronizeInBackground(queueWorkspaceReferenceUpsert(reference));
  return reference;
}

export async function archiveWorkspaceReference(id) {
  const existing = await getWorkspaceReference(id);
  if (!existing) return null;
  return saveWorkspaceReference({ ...existing, status: 'archived' });
}

export async function attachReferenceToIssue({ issueId, referenceId, relevanceNote = '', extractIds = [], includeFullText = false }) {
  const existing = await db.issueReferenceLinks.where('[issueId+referenceId]').equals([issueId, referenceId]).first();
  const link = normalizeIssueReferenceLink({
    ...existing, issueId, referenceId, relevanceNote, extractIds, includeFullText,
    updatedAt: new Date().toISOString(), cloudPending: true,
  });
  await db.issueReferenceLinks.put(link);
  synchronizeInBackground(queueIssueReferenceLinkUpsert(link));
  return link;
}

export async function updateIssueReferenceLink(input) {
  const existing = await db.issueReferenceLinks.get(input.id);
  if (!existing) throw new Error('The Issue reference link no longer exists.');
  const link = normalizeIssueReferenceLink({ ...existing, ...input, updatedAt: new Date().toISOString(), cloudPending: true });
  await db.issueReferenceLinks.put(link);
  synchronizeInBackground(queueIssueReferenceLinkUpsert(link));
  return link;
}

export async function detachReferenceFromIssue(linkId) {
  const existing = await db.issueReferenceLinks.get(linkId);
  await db.issueReferenceLinks.delete(linkId);
  if (existing) synchronizeInBackground(queueIssueReferenceLinkDelete(existing));
}

export async function getReferencesByIssue(issueId) {
  const links = (await db.issueReferenceLinks.where('issueId').equals(issueId).toArray()).map(normalizeIssueReferenceLink);
  const references = await db.workspaceReferences.bulkGet(links.map((item) => item.referenceId));
  return links.map((link, index) => references[index] ? issueReferenceView(normalizeWorkspaceReference(references[index]), link) : null)
    .filter(Boolean)
    .sort((a, b) => (b.referenceDate || '').localeCompare(a.referenceDate || '') || a.citation.localeCompare(b.citation));
}

export function countReferencesByIssue(issueId) {
  return db.issueReferenceLinks.where('issueId').equals(issueId).count();
}

// Compatibility entry point used by the Issue workspace while the UI migrates.
export async function saveReference(input) {
  if (input.link?.id) {
    await updateIssueReferenceLink({ ...input.link, relevanceNote: input.notes || '' });
    return input;
  }
  const reference = await saveWorkspaceReference({
    title: input.citation, citation: input.citation, referenceDate: input.referenceDate,
    scope: 'workspace',
  });
  await attachReferenceToIssue({ issueId: input.issueId, referenceId: reference.id, relevanceNote: input.notes });
  return reference;
}

export async function deleteReference(id) {
  await detachReferenceFromIssue(id);
}
