import { db } from '../../../db/database';
import { deleteCloudParagraphBankEntry, listCloudParagraphBankEntries, saveCloudParagraphBankEntry } from './paragraphBankApi';
import { normalizeParagraphBankEntry } from './paragraphBankUtils';

let runtime = null;

export function configureParagraphBankSync(configuration) {
  runtime = configuration?.workspaceId && configuration?.userId ? configuration : null;
}

function report(status, detail = {}) {
  runtime?.onStatus?.({ status, ...detail });
}

function cloudEntry(row) {
  return normalizeParagraphBankEntry({
    ...(row.payload || {}),
    id: row.id,
    scope: row.scope,
    ownerUserId: row.owner_user_id,
    status: row.status,
    cloudRevision: row.revision,
    cloudUpdatedAt: row.updated_at,
    cloudUpdatedBy: row.updated_by,
    cloudPending: false,
  });
}

function assertSaved(result) {
  if (result?.saved) return result;
  const error = new Error('This paragraph changed on another device. The latest cloud version has been loaded.');
  error.code = 'paragraph_bank_conflict';
  error.cloudResult = result;
  throw error;
}

async function acceptCloudConflict(entry, result) {
  if (result?.payload) {
    await db.paragraphBank.put(normalizeParagraphBankEntry({
      ...result.payload,
      cloudRevision: result.revision,
      cloudUpdatedAt: result.updated_at,
      cloudUpdatedBy: result.updated_by,
      cloudPending: false,
    }));
  }
}

export async function queueParagraphBankUpsert(entry) {
  const current = runtime;
  if (!current || !entry?.id) return null;
  report('syncing');
  try {
    const result = assertSaved(await saveCloudParagraphBankEntry({
      workspaceId: current.workspaceId,
      entry,
    }));
    await db.paragraphBank.update(entry.id, {
      cloudRevision: Number(result.revision || 0),
      cloudUpdatedAt: result.updated_at || '',
      cloudUpdatedBy: result.updated_by || '',
      cloudPending: false,
    });
    report('synced', { syncedAt: new Date().toISOString() });
    return result;
  } catch (error) {
    if (error.code === 'paragraph_bank_conflict') await acceptCloudConflict(entry, error.cloudResult);
    report('error', { error: error.message || 'Unable to synchronize the paragraph.' });
    if (error.code === 'paragraph_bank_conflict') throw error;
    return null;
  }
}

export async function queueParagraphBankDelete(entry) {
  const tombstone = {
    id: `paragraph-bank:${entry.id}`,
    entityType: 'paragraph-bank',
    itemId: entry.id,
    payload: entry,
    deletedAt: new Date().toISOString(),
  };
  await db.syncTombstones.put(tombstone);
  const current = runtime;
  if (!current) return null;
  report('syncing');
  try {
    const result = assertSaved(await deleteCloudParagraphBankEntry({
      workspaceId: current.workspaceId,
      entry,
    }));
    await db.syncTombstones.delete(tombstone.id);
    report('synced', { syncedAt: new Date().toISOString() });
    return result;
  } catch (error) {
    if (error.code === 'paragraph_bank_conflict') {
      await acceptCloudConflict(entry, error.cloudResult);
      await db.syncTombstones.delete(tombstone.id);
      throw error;
    }
    report('error', { error: error.message || 'Unable to synchronize paragraph deletion.' });
    return null;
  }
}

async function flushTombstones(workspaceId) {
  const tombstones = (await db.syncTombstones.toArray()).filter((item) => item.entityType === 'paragraph-bank');
  for (const tombstone of tombstones) {
    const result = await deleteCloudParagraphBankEntry({
      workspaceId,
      entry: tombstone.payload || { id: tombstone.itemId, cloudRevision: 0 },
    });
    if (result?.saved) await db.syncTombstones.delete(tombstone.id);
  }
}

export async function syncParagraphBank({ workspaceId, userId, isWorkspaceAdmin = false, onStatus }) {
  configureParagraphBankSync({ workspaceId, userId, isWorkspaceAdmin, onStatus });
  report('syncing');
  try {
    await flushTombstones(workspaceId);
    const [rows, localEntries] = await Promise.all([
      listCloudParagraphBankEntries(workspaceId),
      db.paragraphBank.toArray(),
    ]);
    const cloudIds = new Set(rows.map((row) => row.id));
    let downloaded = 0;
    let uploaded = 0;
    let deleted = 0;

    for (const row of rows) {
      const local = localEntries.find((entry) => entry.id === row.id);
      if (row.deleted_at) {
        if (local && !local.cloudPending) {
          await db.paragraphBank.delete(row.id);
          deleted += 1;
        }
      } else if (!local?.cloudPending) {
        await db.paragraphBank.put(cloudEntry(row));
        downloaded += 1;
      }
    }

    for (const local of localEntries) {
      if (local.cloudRevision > 0 && !local.cloudPending && !cloudIds.has(local.id)) {
        await db.paragraphBank.delete(local.id);
        deleted += 1;
        continue;
      }
      if (!local.cloudPending) continue;
      if (local.scope === 'workspace' && !isWorkspaceAdmin) continue;
      const result = await saveCloudParagraphBankEntry({ workspaceId, entry: local });
      if (!result?.saved) {
        await acceptCloudConflict(local, result);
        continue;
      }
      await db.paragraphBank.update(local.id, {
        cloudRevision: Number(result.revision || 0),
        cloudUpdatedAt: result.updated_at || '',
        cloudUpdatedBy: result.updated_by || '',
        cloudPending: false,
      });
      uploaded += 1;
    }

    const result = { downloaded, uploaded, deleted, syncedAt: new Date().toISOString() };
    report('synced', result);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('swm:paragraph-bank-synced', { detail: result }));
    return result;
  } catch (error) {
    report('error', { error: error.message || 'Unable to synchronize the Paragraph Bank.' });
    throw error;
  }
}
