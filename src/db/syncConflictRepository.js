import { db } from './database';

export const SYNC_CONFLICT_EVENT = 'swm:sync-conflicts-changed';

function conflictId(entityType, itemId) {
  return `${entityType}:${itemId}`;
}

function announce(issueId) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_CONFLICT_EVENT, { detail: { issueId } }));
  }
}

export async function recordSyncConflict(conflict) {
  const stored = {
    ...conflict,
    id: conflictId(conflict.entityType, conflict.itemId),
    detectedAt: new Date().toISOString(),
  };
  await db.syncConflicts.put(stored);
  announce(stored.issueId);
  return stored;
}

export async function getSyncConflictsByIssue(issueId) {
  const conflicts = await db.syncConflicts.where('issueId').equals(issueId).toArray();
  return conflicts.sort((a, b) => new Date(b.detectedAt || 0) - new Date(a.detectedAt || 0));
}

export async function getSyncConflict(entityType, itemId) {
  return db.syncConflicts.get(conflictId(entityType, itemId));
}

export async function clearSyncConflict(entityType, itemId, issueId = '') {
  await db.syncConflicts.delete(conflictId(entityType, itemId));
  announce(issueId);
}
