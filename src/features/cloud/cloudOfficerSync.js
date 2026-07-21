import { db } from '../../db/database';
import { normalizeOfficer } from '../../utils/officerUtils';
import { listCloudOfficerRows, upsertCloudOfficer } from './cloudOfficerApi';

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

export async function syncWorkspaceOfficers({ workspaceId, userId, canEdit = true, onStatus }) {
  configureCloudOfficerSync({ workspaceId, userId, canEdit, onStatus });
  onStatus?.({ status: 'syncing' });
  try {
    const [cloudRows, localRows] = await Promise.all([
      listCloudOfficerRows(workspaceId),
      db.officers.toArray(),
    ]);
    const cloudById = new Map(cloudRows.map((row) => [row.id, row]));
    const localById = new Map(localRows.map((officer) => [officer.id, normalizeOfficer(officer)]));

    for (const row of cloudRows) {
      const local = localById.get(row.id);
      if (!local || new Date(row.updated_at || 0).getTime() > new Date(local.updatedAt || 0).getTime()) {
        await db.officers.put(normalizeOfficer(row.payload));
      }
    }

    if (canEdit) {
      for (const officer of localById.values()) {
        const cloud = cloudById.get(officer.id);
        if (!cloud || new Date(officer.updatedAt || 0).getTime() > new Date(cloud.updated_at || 0).getTime()) {
          await upsertCloudOfficer({ workspaceId, userId, officer });
        }
      }
    }
  } catch (error) {
    onStatus?.({ status: 'error', error: error.message || 'Unable to synchronize officer directory.' });
    throw error;
  }
}
