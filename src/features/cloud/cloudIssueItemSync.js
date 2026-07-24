import { db } from '../../db/database';
import { normalizeCommunication } from '../../utils/communicationUtils';
import { normalizeDraft } from '../../utils/draftUtils';
import { normalizeMilestone } from '../../utils/milestoneUtils';
import { normalizeReference } from '../../utils/referenceUtils';
import { normalizeIssueSummary } from '../../utils/summaryUtils';
import { listCloudIssueItems, markCloudIssueItemDeleted, upsertCloudIssueItem } from './cloudIssueItemApi';
import { clearSyncConflict, getSyncConflict, recordSyncConflict } from '../../db/syncConflictRepository';
import { isCloudRevisionConflict } from './cloudRevisionConflict';

const ITEM_CONFIG = {
  communication: { table: 'communications', normalize: normalizeCommunication },
  reference: { table: 'references', normalize: normalizeReference },
  milestone: { table: 'issueMilestones', normalize: normalizeMilestone },
  summary: { table: 'issueSummaries', normalize: normalizeIssueSummary },
  draft: { table: 'drafts', normalize: normalizeDraft },
};

let runtime = null;

export function configureCloudIssueItemSync(configuration) {
  runtime = configuration?.workspaceId && configuration?.userId ? configuration : null;
}

function report(status, detail = {}) {
  runtime?.onStatus?.({ status, ...detail });
}

function itemTimestamp(item) {
  return Math.max(
    new Date(item?.updatedAt || item?.createdAt || item?.recordedAt || 0).getTime(),
    new Date(item?.cloudUpdatedAt || 0).getTime(),
  );
}

function itemKey(type, id) {
  return `${type}:${id}`;
}

export function queueCloudIssueItemUpsert(itemType, item) {
  const current = runtime;
  if (!current || current.canEdit === false || !ITEM_CONFIG[itemType] || !item?.id || !item.issueId) return Promise.resolve(null);
  return getSyncConflict('issue', item.issueId).then((parentConflict) => {
    if (parentConflict) return null;
    report('syncing');
    return upsertCloudIssueItem({ workspaceId: current.workspaceId, userId: current.userId, itemType, item });
  })
    .then(async (result) => {
      if (!result) return null;
      await db[ITEM_CONFIG[itemType].table].update(item.id, {
        cloudRevision: Number(result.revision || 0),
        cloudUpdatedAt: result.updated_at || '',
        cloudUpdatedBy: result.updated_by || '',
      });
      await clearSyncConflict(itemType, item.id, item.issueId);
      report('synced', { syncedAt: new Date().toISOString() });
      return result;
    })
    .catch(async (error) => {
      if (isCloudRevisionConflict(error)) {
        await recordSyncConflict(error.conflict);
        report('error', { error: error.message });
        throw error;
      }
      report('error', { error: error.message || `Unable to sync ${itemType}.` });
      return null;
    });
}

export async function queueCloudIssueItemDelete(itemType, item) {
  const current = runtime;
  if (!ITEM_CONFIG[itemType] || !item?.id) return null;
  const deletedAt = new Date().toISOString();
  const tombstone = { id: `item:${itemType}:${item.id}`, entityType: itemType, itemId: item.id, issueId: item.issueId, payload: item, deletedAt };
  await db.syncTombstones.put(tombstone);
  if (!current || current.canEdit === false) {
    return null;
  }
  report('syncing');
  try {
    await markCloudIssueItemDeleted({ workspaceId: current.workspaceId, itemType, item, deletedAt });
    await db.syncTombstones.delete(tombstone.id);
    await clearSyncConflict(itemType, item.id, item.issueId);
    report('synced', { syncedAt: deletedAt });
    return true;
  } catch (error) {
    if (isCloudRevisionConflict(error)) {
      await recordSyncConflict(error.conflict);
      report('error', { error: error.message });
      throw error;
    }
    report('error', { error: error.message || `Unable to sync ${itemType} deletion.` });
    return null;
  }
}

async function flushItemTombstones({ workspaceId, userId, canEdit }) {
  if (!canEdit) return;
  const tombstones = (await db.syncTombstones.toArray()).filter((item) => ITEM_CONFIG[item.entityType]);
  for (const tombstone of tombstones) {
    try {
      await markCloudIssueItemDeleted({
        workspaceId,
        itemType: tombstone.entityType,
        item: tombstone.payload || { id: tombstone.itemId, issueId: tombstone.issueId },
        deletedAt: tombstone.deletedAt,
      });
      await db.syncTombstones.delete(tombstone.id);
    } catch (error) {
      if (isCloudRevisionConflict(error)) {
        await recordSyncConflict(error.conflict);
        continue;
      }
      throw error;
    }
  }
}

function remapOfficerReferences(type, item, officerIdMap) {
  const field = type === 'milestone' ? 'assignedOfficerId' : ['communication', 'draft'].includes(type) ? 'signatoryId' : '';
  if (!field || !item[field] || !officerIdMap[item[field]]) return { item, changed: false };
  return {
    item: { ...item, [field]: officerIdMap[item[field]], updatedAt: new Date().toISOString() },
    changed: true,
  };
}

export async function syncWorkspaceIssueItems({ workspaceId, userId, canEdit = true, officerIdMap = {}, onStatus }) {
  configureCloudIssueItemSync({ workspaceId, userId, canEdit, onStatus });
  report('syncing');
  try {
    await flushItemTombstones({ workspaceId, userId, canEdit });
    const [cloudRows, issues, ...localCollections] = await Promise.all([
      listCloudIssueItems(workspaceId),
      db.issues.toArray(),
      ...Object.values(ITEM_CONFIG).map(({ table }) => db[table].toArray()),
    ]);
    const activeIssueIds = new Set(issues.filter((issue) => !issue.isDemo).map((issue) => issue.id));
    const cloudByKey = new Map(cloudRows.map((row) => [itemKey(row.item_type, row.id), row]));
    let downloaded = 0;
    let uploaded = 0;
    let deleted = 0;

    for (const row of cloudRows) {
      const config = ITEM_CONFIG[row.item_type];
      if (!config || !activeIssueIds.has(row.issue_id)) continue;
      const table = db[config.table];
      const local = await table.get(row.id);
      const cloudUpdatedAt = new Date(row.updated_at || 0).getTime();
      if (row.deleted_at) {
        if (local && (!canEdit || new Date(row.deleted_at).getTime() >= itemTimestamp(local))) {
          await table.delete(row.id);
          deleted += 1;
        }
      } else if (!local || !canEdit || cloudUpdatedAt > itemTimestamp(local)) {
        const normalized = config.normalize({
          ...row.payload,
          cloudRevision: Number(row.revision || 0),
          cloudUpdatedAt: row.updated_at || '',
          cloudUpdatedBy: row.updated_by || '',
        });
        const remapped = remapOfficerReferences(row.item_type, normalized, officerIdMap);
        const downloadedItem = config.normalize(remapped.item);
        if (canEdit && await getSyncConflict(row.item_type, row.id)) continue;
        await table.put(downloadedItem);
        if (remapped.changed && canEdit) {
          const result = await upsertCloudIssueItem({ workspaceId, userId, itemType: row.item_type, item: downloadedItem });
          await table.update(row.id, {
            cloudRevision: result.revision,
            cloudUpdatedAt: result.updated_at,
            cloudUpdatedBy: result.updated_by,
          });
        }
        downloaded += 1;
      }
    }

    if (canEdit) {
      const configs = Object.entries(ITEM_CONFIG);
      for (let index = 0; index < configs.length; index += 1) {
        const [type, config] = configs[index];
        for (const raw of localCollections[index]) {
          let item = config.normalize(raw);
          if (!activeIssueIds.has(item.issueId)) continue;
          if (await getSyncConflict('issue', item.issueId)) continue;
          const cloud = cloudByKey.get(itemKey(type, item.id));
          if (cloud && !item.cloudRevision) {
            item = config.normalize({
              ...item,
              cloudRevision: Number(cloud.revision || 0),
              cloudUpdatedAt: cloud.updated_at || '',
              cloudUpdatedBy: cloud.updated_by || '',
            });
            await db[config.table].update(item.id, {
              cloudRevision: item.cloudRevision,
              cloudUpdatedAt: item.cloudUpdatedAt,
              cloudUpdatedBy: item.cloudUpdatedBy,
            });
          }
          const cloudUpdatedAt = new Date(cloud?.updated_at || 0).getTime();
          const tombstoneAt = new Date(cloud?.deleted_at || 0).getTime();
          if (cloud?.deleted_at && tombstoneAt >= itemTimestamp(item)) continue;
          if (!cloud || itemTimestamp(item) > cloudUpdatedAt) {
            if (await getSyncConflict(type, item.id)) continue;
            try {
              const result = await upsertCloudIssueItem({ workspaceId, userId, itemType: type, item });
              await db[config.table].update(item.id, {
                cloudRevision: result.revision,
                cloudUpdatedAt: result.updated_at,
                cloudUpdatedBy: result.updated_by,
              });
              uploaded += 1;
            } catch (error) {
              if (isCloudRevisionConflict(error)) {
                await recordSyncConflict(error.conflict);
                continue;
              }
              throw error;
            }
          }
        }
      }
    }

    const result = { downloaded, uploaded, deleted, syncedAt: new Date().toISOString() };
    report('synced', result);
    return result;
  } catch (error) {
    report('error', { error: error.message || 'Unable to synchronize Issue workspace records.' });
    throw error;
  }
}
