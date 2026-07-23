import { db } from '../../db/database';
import { normalizeCommunication } from '../../utils/communicationUtils';
import { normalizeDraft } from '../../utils/draftUtils';
import { normalizeMilestone } from '../../utils/milestoneUtils';
import { normalizeReference } from '../../utils/referenceUtils';
import { normalizeIssueSummary } from '../../utils/summaryUtils';
import { listCloudIssueItems, markCloudIssueItemDeleted, upsertCloudIssueItem } from './cloudIssueItemApi';

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
  return new Date(item?.updatedAt || item?.createdAt || item?.recordedAt || 0).getTime();
}

function itemKey(type, id) {
  return `${type}:${id}`;
}

export function queueCloudIssueItemUpsert(itemType, item) {
  const current = runtime;
  if (!current || current.canEdit === false || !ITEM_CONFIG[itemType] || !item?.id || !item.issueId) return;
  report('syncing');
  upsertCloudIssueItem({ workspaceId: current.workspaceId, userId: current.userId, itemType, item })
    .then(() => report('synced', { syncedAt: new Date().toISOString() }))
    .catch((error) => report('error', { error: error.message || `Unable to sync ${itemType}.` }));
}

export function queueCloudIssueItemDelete(itemType, itemId) {
  const current = runtime;
  if (!ITEM_CONFIG[itemType] || !itemId) return;
  const deletedAt = new Date().toISOString();
  const tombstone = { id: `item:${itemType}:${itemId}`, entityType: itemType, itemId, deletedAt };
  const persist = db.syncTombstones.put(tombstone);
  if (!current || current.canEdit === false) {
    persist.catch(() => {});
    return;
  }
  report('syncing');
  persist
    .then(() => markCloudIssueItemDeleted({ workspaceId: current.workspaceId, userId: current.userId, itemType, itemId, deletedAt }))
    .then(() => db.syncTombstones.delete(tombstone.id))
    .then(() => report('synced', { syncedAt: deletedAt }))
    .catch((error) => report('error', { error: error.message || `Unable to sync ${itemType} deletion.` }));
}

async function flushItemTombstones({ workspaceId, userId, canEdit }) {
  if (!canEdit) return;
  const tombstones = (await db.syncTombstones.toArray()).filter((item) => ITEM_CONFIG[item.entityType]);
  for (const tombstone of tombstones) {
    await markCloudIssueItemDeleted({
      workspaceId,
      userId,
      itemType: tombstone.entityType,
      itemId: tombstone.itemId,
      deletedAt: tombstone.deletedAt,
    });
    await db.syncTombstones.delete(tombstone.id);
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
        if (local && new Date(row.deleted_at).getTime() >= itemTimestamp(local)) {
          await table.delete(row.id);
          deleted += 1;
        }
      } else if (!local || cloudUpdatedAt > itemTimestamp(local)) {
        const normalized = config.normalize(row.payload);
        const remapped = remapOfficerReferences(row.item_type, normalized, officerIdMap);
        const downloadedItem = config.normalize(remapped.item);
        await table.put(downloadedItem);
        if (remapped.changed && canEdit) {
          await upsertCloudIssueItem({ workspaceId, userId, itemType: row.item_type, item: downloadedItem });
        }
        downloaded += 1;
      }
    }

    if (canEdit) {
      const configs = Object.entries(ITEM_CONFIG);
      for (let index = 0; index < configs.length; index += 1) {
        const [type, config] = configs[index];
        for (const raw of localCollections[index]) {
          const item = config.normalize(raw);
          if (!activeIssueIds.has(item.issueId)) continue;
          const cloud = cloudByKey.get(itemKey(type, item.id));
          const cloudUpdatedAt = new Date(cloud?.updated_at || 0).getTime();
          const tombstoneAt = new Date(cloud?.deleted_at || 0).getTime();
          if (cloud?.deleted_at && tombstoneAt >= itemTimestamp(item)) continue;
          if (!cloud || itemTimestamp(item) > cloudUpdatedAt) {
            await upsertCloudIssueItem({ workspaceId, userId, itemType: type, item });
            uploaded += 1;
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
