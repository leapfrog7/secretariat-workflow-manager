import { db } from '../../db/database';
import { normalizeIssue } from '../../utils/issueUtils';
import { listCloudIssueRows, markCloudIssueDeleted, upsertCloudIssue } from './cloudIssueApi';

let runtime = null;

export function configureCloudIssueSync(configuration) {
  runtime = configuration?.workspaceId && configuration?.userId ? configuration : null;
}

function report(status, detail = {}) {
  runtime?.onStatus?.({ status, ...detail });
}

export function queueCloudIssueUpsert(issue) {
  const current = runtime;
  if (!current || current.canEdit === false || !issue?.id || issue.isDemo) return;
  report('syncing');
  upsertCloudIssue({ workspaceId: current.workspaceId, userId: current.userId, issue })
    .then(() => report('synced', { syncedAt: new Date().toISOString() }))
    .catch((error) => report('error', { error: error.message || 'Unable to sync Issue.' }));
}

export function queueCloudIssueDelete(issueId) {
  const current = runtime;
  if (!issueId) return;
  const deletedAt = new Date().toISOString();
  const tombstone = { id: `issue:${issueId}`, entityType: 'issue', itemId: issueId, deletedAt };
  const persist = db.syncTombstones.put(tombstone);
  if (!current || current.canEdit === false) {
    persist.catch(() => {});
    return;
  }
  report('syncing');
  persist
    .then(() => markCloudIssueDeleted({ workspaceId: current.workspaceId, userId: current.userId, issueId, deletedAt }))
    .then(() => db.syncTombstones.delete(tombstone.id))
    .then(() => report('synced', { syncedAt: deletedAt }))
    .catch((error) => report('error', { error: error.message || 'Unable to sync Issue deletion.' }));
}

async function flushIssueTombstones({ workspaceId, userId, canEdit }) {
  if (!canEdit) return;
  const tombstones = (await db.syncTombstones.toArray()).filter((item) => item.entityType === 'issue');
  for (const tombstone of tombstones) {
    await markCloudIssueDeleted({ workspaceId, userId, issueId: tombstone.itemId, deletedAt: tombstone.deletedAt });
    await db.syncTombstones.delete(tombstone.id);
  }
}

async function deleteLocalIssueGraph(issueId) {
  await db.transaction('rw', db.issues, db.records, db.actions, db.communications, db.references, db.issueMilestones, db.issueSummaries, db.drafts, db.chronology, async () => {
    await Promise.all([
      db.records.where('issueId').equals(issueId).delete(),
      db.actions.where('issueId').equals(issueId).delete(),
      db.communications.where('issueId').equals(issueId).delete(),
      db.references.where('issueId').equals(issueId).delete(),
      db.issueMilestones.where('issueId').equals(issueId).delete(),
      db.issueSummaries.where('issueId').equals(issueId).delete(),
      db.drafts.where('issueId').equals(issueId).delete(),
      db.chronology.where('issueId').equals(issueId).delete(),
      db.issues.delete(issueId),
    ]);
  });
}

export async function syncWorkspaceIssues({ workspaceId, userId, canEdit = true, officerIdMap = {}, onStatus }) {
  configureCloudIssueSync({ workspaceId, userId, canEdit, onStatus });
  report('syncing');

  try {
    await flushIssueTombstones({ workspaceId, userId, canEdit });
    const [cloudRows, localRows] = await Promise.all([
      listCloudIssueRows(workspaceId),
      db.issues.toArray(),
    ]);
    const cloudById = new Map(cloudRows.map((row) => [row.id, row]));
    const localById = new Map(localRows.map((issue) => [issue.id, normalizeIssue(issue)]));
    let downloaded = 0;
    let uploaded = 0;
    let deleted = 0;

    for (const row of cloudRows) {
      const local = localById.get(row.id);
      const cloudUpdatedAt = new Date(row.updated_at || 0).getTime();
      const localUpdatedAt = new Date(local?.updatedAt || 0).getTime();

      if (row.deleted_at) {
        if (local && new Date(row.deleted_at).getTime() >= localUpdatedAt) {
          await deleteLocalIssueGraph(row.id);
          deleted += 1;
        }
        continue;
      }

      if (!local || cloudUpdatedAt > localUpdatedAt) {
        const issue = normalizeIssue(row.payload);
        const assignedOfficerId = officerIdMap[issue.assignedOfficerId] || issue.assignedOfficerId;
        const remapped = assignedOfficerId !== issue.assignedOfficerId;
        const downloadedIssue = remapped ? { ...issue, assignedOfficerId, updatedAt: new Date().toISOString() } : issue;
        await db.issues.put(downloadedIssue);
        if (remapped && canEdit) await upsertCloudIssue({ workspaceId, userId, issue: downloadedIssue });
        downloaded += 1;
      }
    }

    for (const issue of localById.values()) {
      if (!canEdit) break;
      if (issue.isDemo) continue;
      const cloud = cloudById.get(issue.id);
      const localUpdatedAt = new Date(issue.updatedAt || 0).getTime();
      const cloudUpdatedAt = new Date(cloud?.updated_at || 0).getTime();
      const tombstoneAt = new Date(cloud?.deleted_at || 0).getTime();
      if (cloud?.deleted_at && tombstoneAt >= localUpdatedAt) continue;
      if (!cloud || localUpdatedAt > cloudUpdatedAt) {
        await upsertCloudIssue({ workspaceId, userId, issue });
        uploaded += 1;
      }
    }

    const result = { downloaded, uploaded, deleted, syncedAt: new Date().toISOString() };
    report('synced', result);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('swm:issues-synced', { detail: result }));
    return result;
  } catch (error) {
    report('error', { error: error.message || 'Unable to synchronize Issues.' });
    throw error;
  }
}
