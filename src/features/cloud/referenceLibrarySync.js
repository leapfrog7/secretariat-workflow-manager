import { db } from '../../db/database';
import { normalizeIssueReferenceLink, normalizeWorkspaceReference } from '../../utils/referenceUtils';
import { deleteCloudIssueReferenceLink, listCloudIssueReferenceLinks, listCloudWorkspaceReferences, saveCloudIssueReferenceLink, saveCloudWorkspaceReference } from './referenceLibraryApi';

let runtime = null;
export function configureReferenceLibrarySync(value) { runtime = value?.workspaceId ? value : null; }

function applyCloudMeta(payload, row) { return { ...payload, cloudRevision: Number(row.revision || 0), cloudUpdatedAt: row.updated_at || '', cloudUpdatedBy: row.updated_by || '', cloudPending: false }; }
export async function queueWorkspaceReferenceUpsert(item) { if (!runtime) return null; const result = await saveCloudWorkspaceReference(runtime.workspaceId, item); if (!result?.saved) throw new Error('This reference changed on another device. Synchronize and review the latest version.'); await db.workspaceReferences.put(normalizeWorkspaceReference(applyCloudMeta(item, result))); return result; }
export async function queueIssueReferenceLinkUpsert(item) { if (!runtime) return null; const result = await saveCloudIssueReferenceLink(runtime.workspaceId, item); if (!result?.saved) throw new Error('This Issue reference link changed on another device.'); await db.issueReferenceLinks.put(normalizeIssueReferenceLink(applyCloudMeta(item, result))); return result; }
export async function queueIssueReferenceLinkDelete(item) {
  const tombstone = { id: `reference-link:${item.id}`, entityType: 'reference-link', itemId: item.id, payload: item, deletedAt: new Date().toISOString() };
  await db.syncTombstones.put(tombstone);
  if (!runtime) return null;
  await deleteCloudIssueReferenceLink(runtime.workspaceId, item);
  await db.syncTombstones.delete(tombstone.id);
  return true;
}

async function flushReferenceLinkDeletes(workspaceId) {
  const tombstones = (await db.syncTombstones.toArray()).filter((item) => item.entityType === 'reference-link');
  for (const tombstone of tombstones) {
    await deleteCloudIssueReferenceLink(workspaceId, tombstone.payload || { id: tombstone.itemId });
    await db.syncTombstones.delete(tombstone.id);
  }
}

export async function syncReferenceLibrary(configuration) {
  configureReferenceLibrarySync(configuration);
  await flushReferenceLinkDeletes(configuration.workspaceId);
  const [cloudReferences, cloudLinks, localReferences, localLinks] = await Promise.all([listCloudWorkspaceReferences(configuration.workspaceId), listCloudIssueReferenceLinks(configuration.workspaceId), db.workspaceReferences.toArray(), db.issueReferenceLinks.toArray()]);
  const localReferenceById = new Map(localReferences.map((item) => [item.id, item]));
  const localLinkById = new Map(localLinks.map((item) => [item.id, item]));
  for (const row of cloudReferences) if (!row.deleted_at && !localReferenceById.get(row.id)?.cloudPending) await db.workspaceReferences.put(normalizeWorkspaceReference(applyCloudMeta({ ...row.payload, id: row.id, status: row.status }, row)));
  for (const row of cloudLinks) if (!row.deleted_at) {
    if (localLinkById.get(row.id)?.cloudPending) continue;
    const cloudLink = normalizeIssueReferenceLink(applyCloudMeta({ ...row.payload, id: row.id, issueId: row.issue_id, referenceId: row.reference_id }, row));
    const duplicate = localLinks.find((item) => item.id !== cloudLink.id && item.issueId === cloudLink.issueId && item.referenceId === cloudLink.referenceId);
    if (duplicate) await db.issueReferenceLinks.delete(duplicate.id);
    await db.issueReferenceLinks.put(cloudLink);
  }
  for (const item of localReferences.filter((x) => x.cloudPending)) await queueWorkspaceReferenceUpsert(item);
  const currentLinks = await db.issueReferenceLinks.toArray();
  for (const item of currentLinks.filter((x) => x.cloudPending)) await queueIssueReferenceLinkUpsert(item);
  return { references: cloudReferences.length, links: cloudLinks.length };
}
