import { db } from '../../db/database';
import { normalizeOfficer } from '../../utils/officerUtils';
import { consolidateDuplicateOfficers } from '../../db/officerDeduplication';
import { deleteCloudOfficer, listCloudOfficerRows, upsertCloudOfficer } from './cloudOfficerApi';

let runtime = null;

export function configureCloudOfficerSync(configuration) {
  runtime = configuration?.workspaceId && configuration?.userId ? configuration : null;
}

export function queueCloudOfficerUpsert(officer) {
  const current = runtime;
  if (!current || current.canEdit === false || !officer?.id) return;
  current.onStatus?.({ status: 'syncing' });
  upsertCloudOfficer({ workspaceId: current.workspaceId, userId: current.userId, officer })
    .then(() => current.onStatus?.({ status: 'synced', syncedAt: new Date().toISOString() }))
    .catch((error) => current.onStatus?.({ status: 'error', error: error.message || 'Unable to sync officer directory.' }));
}

async function flushOfficerTombstones({ workspaceId, canManageOfficerDirectory }) {
  const tombstones = (await db.syncTombstones.toArray()).filter((item) => item.entityType === 'officer');
  if (!canManageOfficerDirectory) return tombstones;
  for (const tombstone of tombstones) {
    await deleteCloudOfficer({ workspaceId, officerId: tombstone.itemId });
    await db.syncTombstones.delete(tombstone.id);
  }
  return [];
}

export async function syncWorkspaceOfficers({ workspaceId, userId, canEdit = true, canManageOfficerDirectory = false, onStatus }) {
  configureCloudOfficerSync({ workspaceId, userId, canEdit, canManageOfficerDirectory, onStatus });
  onStatus?.({ status: 'syncing' });
  try {
    const pendingTombstones = await flushOfficerTombstones({ workspaceId, canManageOfficerDirectory });
    const blockedIds = new Set(pendingTombstones.map((item) => item.itemId));
    const [cloudRows, localRows] = await Promise.all([
      listCloudOfficerRows(workspaceId),
      db.officers.toArray(),
    ]);
    const activeCloudRows = cloudRows.filter((row) => !blockedIds.has(row.id));
    const cloudById = new Map(activeCloudRows.map((row) => [row.id, row]));
    const localById = new Map(localRows.map((officer) => [officer.id, normalizeOfficer(officer)]));

    for (const row of activeCloudRows) {
      const local = localById.get(row.id);
      if (!local || new Date(row.updated_at || 0).getTime() > new Date(local.updatedAt || 0).getTime()) {
        await db.officers.put(normalizeOfficer(row.payload));
      }
    }

    const consolidated = await consolidateDuplicateOfficers({ preferredIds: new Set(activeCloudRows.map((row) => row.id)) });
    for (const duplicateId of consolidated.duplicateIds) {
      const tombstone = { id: `officer:${duplicateId}`, entityType: 'officer', itemId: duplicateId, deletedAt: new Date().toISOString() };
      await db.syncTombstones.put(tombstone);
      if (canManageOfficerDirectory) {
        await deleteCloudOfficer({ workspaceId, officerId: duplicateId });
        await db.syncTombstones.delete(tombstone.id);
      }
    }

    let uploaded = 0;
    if (canEdit) {
      for (const officer of consolidated.officers) {
        const cloud = cloudById.get(officer.id);
        if (!cloud || new Date(officer.updatedAt || 0).getTime() > new Date(cloud.updated_at || 0).getTime()) {
          await upsertCloudOfficer({ workspaceId, userId, officer });
          uploaded += 1;
        }
      }
    }
    const result = {
      downloaded: activeCloudRows.filter((row) => !localById.has(row.id)).length,
      uploaded,
      duplicatesRemoved: consolidated.duplicateIds.length,
      idMap: consolidated.idMap,
      syncedAt: new Date().toISOString(),
    };
    onStatus?.({ status: 'synced', ...result });
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('swm:officers-synced', { detail: result }));
    return result;
  } catch (error) {
    onStatus?.({ status: 'error', error: error.message || 'Unable to synchronize officer directory.' });
    throw error;
  }
}
