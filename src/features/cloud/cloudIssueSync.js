import { db } from '../../db/database';
import { normalizeIssue } from '../../utils/issueUtils';
import { listCloudIssueRows, markCloudIssueDeleted, upsertCloudIssue } from './cloudIssueApi';
import { listMyIssueAccess } from '../collaboration/accessApi';
import { clearSyncConflict, getSyncConflict, recordSyncConflict } from '../../db/syncConflictRepository';
import { isCloudRevisionConflict } from './cloudRevisionConflict';

let runtime = null;
const VISIBLE_ISSUES_KEY = 'swm:visible-cloud-issues';

export function configureCloudIssueSync(configuration) {
  runtime = configuration?.workspaceId && configuration?.userId ? configuration : null;
}

function report(status, detail = {}) {
  runtime?.onStatus?.({ status, ...detail });
}

function withCloudMetadata(payload, result) {
  return normalizeIssue({
    ...payload,
    cloudRevision: Number(result?.revision || payload.cloudRevision || 0),
    cloudUpdatedAt: result?.updated_at || payload.cloudUpdatedAt || '',
    cloudUpdatedBy: result?.updated_by || payload.cloudUpdatedBy || '',
  });
}

function issueTimestamp(issue) {
  return Math.max(
    new Date(issue?.updatedAt || 0).getTime(),
    new Date(issue?.cloudUpdatedAt || 0).getTime(),
  );
}

async function rememberConflict(error) {
  if (!isCloudRevisionConflict(error)) return false;
  await recordSyncConflict(error.conflict);
  return true;
}

export async function queueCloudIssueUpsert(issue) {
  const current = runtime;
  if (!current || current.canEdit === false || !issue?.id || issue.isDemo) return null;
  report('syncing');
  try {
    const result = await upsertCloudIssue({ workspaceId: current.workspaceId, userId: current.userId, issue });
    const synced = withCloudMetadata(issue, result);
    if (await db.issues.get(issue.id)) {
      await db.issues.update(issue.id, {
        cloudRevision: synced.cloudRevision,
        cloudUpdatedAt: synced.cloudUpdatedAt,
        cloudUpdatedBy: synced.cloudUpdatedBy,
      });
    }
    await clearSyncConflict('issue', issue.id, issue.id);
    report('synced', { syncedAt: new Date().toISOString() });
    return synced;
  } catch (error) {
    const conflict = await rememberConflict(error);
    report('error', { error: error.message || 'Unable to sync Issue.' });
    if (conflict) throw error;
    return null;
  }
}

export async function queueCloudIssueDelete(issue) {
  const current = runtime;
  if (!issue?.id) return null;
  const deletedAt = new Date().toISOString();
  const tombstone = { id: `issue:${issue.id}`, entityType: 'issue', itemId: issue.id, issueId: issue.id, payload: issue, deletedAt };
  await db.syncTombstones.put(tombstone);
  if (!current || current.canEdit === false) {
    return null;
  }
  report('syncing');
  try {
    await markCloudIssueDeleted({ workspaceId: current.workspaceId, issue, deletedAt });
    await db.syncTombstones.delete(tombstone.id);
    await clearSyncConflict('issue', issue.id, issue.id);
    report('synced', { syncedAt: deletedAt });
    return true;
  } catch (error) {
    const conflict = await rememberConflict(error);
    report('error', { error: error.message || 'Unable to sync Issue deletion.' });
    if (conflict) throw error;
    return null;
  }
}

async function flushIssueTombstones({ workspaceId, userId, canEdit }) {
  if (!canEdit) return;
  const tombstones = (await db.syncTombstones.toArray()).filter((item) => item.entityType === 'issue');
  for (const tombstone of tombstones) {
    try {
      await markCloudIssueDeleted({ workspaceId, issue: tombstone.payload || { id: tombstone.itemId }, deletedAt: tombstone.deletedAt });
      await db.syncTombstones.delete(tombstone.id);
    } catch (error) {
      if (await rememberConflict(error)) continue;
      throw error;
    }
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

function visibleStorageKey(workspaceId, userId) {
  return `${VISIBLE_ISSUES_KEY}:${workspaceId}:${userId}`;
}

function readPreviouslyVisibleIds(workspaceId, userId) {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(visibleStorageKey(workspaceId, userId)) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function storeVisibleIds(workspaceId, userId, ids) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(visibleStorageKey(workspaceId, userId), JSON.stringify(ids));
  }
}

export async function syncWorkspaceIssues({ workspaceId, userId, canEdit = true, divisionAccessEnabled = false, officerIdMap = {}, onStatus }) {
  configureCloudIssueSync({ workspaceId, userId, canEdit, onStatus });
  report('syncing');

  try {
    await flushIssueTombstones({ workspaceId, userId, canEdit });
    const [cloudRows, localRows, accessRows] = await Promise.all([
      listCloudIssueRows(workspaceId),
      db.issues.toArray(),
      divisionAccessEnabled ? listMyIssueAccess(workspaceId) : Promise.resolve([]),
    ]);
    const accessByIssue = new Map(accessRows.map((row) => [row.issue_id, row.access_level]));
    const defaultAccessLevel = canEdit ? 'editor' : 'viewer';
    const cloudById = new Map(cloudRows.map((row) => [row.id, row]));
    const visibleIds = new Set(cloudRows.filter((row) => !row.deleted_at).map((row) => row.id));
    const revokedIds = readPreviouslyVisibleIds(workspaceId, userId).filter((id) => !visibleIds.has(id));
    const localById = new Map(localRows.map((issue) => [issue.id, normalizeIssue(issue)]));
    let downloaded = 0;
    let uploaded = 0;
    let deleted = 0;

    for (const issueId of revokedIds) {
      if (localById.has(issueId)) {
        await deleteLocalIssueGraph(issueId);
        localById.delete(issueId);
        deleted += 1;
      }
    }

    for (const row of cloudRows) {
      const local = localById.get(row.id);
      const cloudUpdatedAt = new Date(row.updated_at || 0).getTime();
      const localUpdatedAt = issueTimestamp(local);

      if (row.deleted_at) {
        if (local && new Date(row.deleted_at).getTime() >= localUpdatedAt) {
          await deleteLocalIssueGraph(row.id);
          deleted += 1;
        }
        continue;
      }

      if (!local || cloudUpdatedAt > localUpdatedAt) {
        const issue = normalizeIssue({
          ...row.payload,
          owningDivisionId: row.owning_division_id || row.payload?.owningDivisionId || '',
          visibility: row.visibility || row.payload?.visibility || 'workspace',
          accessLevel: accessByIssue.get(row.id) || defaultAccessLevel,
          createdBy: row.created_by || row.payload?.createdBy || '',
          cloudRevision: Number(row.revision || 0),
          cloudUpdatedAt: row.updated_at || '',
          cloudUpdatedBy: row.updated_by || '',
        });
        const assignedOfficerId = officerIdMap[issue.assignedOfficerId] || issue.assignedOfficerId;
        const remapped = assignedOfficerId !== issue.assignedOfficerId;
        const downloadedIssue = remapped ? { ...issue, assignedOfficerId, updatedAt: new Date().toISOString() } : issue;
        if (!(await getSyncConflict('issue', row.id))) {
          await db.issues.put(downloadedIssue);
          if (remapped && canEdit) {
            const result = await upsertCloudIssue({ workspaceId, userId, issue: downloadedIssue });
            await db.issues.update(row.id, {
              cloudRevision: result.revision,
              cloudUpdatedAt: result.updated_at,
              cloudUpdatedBy: result.updated_by,
            });
          }
        }
        downloaded += 1;
      } else if (local) {
        const updates = {};
        const accessLevel = accessByIssue.get(row.id) || defaultAccessLevel;
        if (local.accessLevel !== accessLevel) updates.accessLevel = accessLevel;
        if (!local.cloudRevision) {
          updates.cloudRevision = Number(row.revision || 0);
          updates.cloudUpdatedAt = row.updated_at || '';
          updates.cloudUpdatedBy = row.updated_by || '';
          localById.set(row.id, normalizeIssue({ ...local, ...updates }));
        }
        if (Object.keys(updates).length) await db.issues.update(row.id, updates);
      }
    }

    for (const issue of localById.values()) {
      if (!canEdit) break;
      if (issue.isDemo) continue;
      const cloud = cloudById.get(issue.id);
      const localUpdatedAt = issueTimestamp(issue);
      const cloudUpdatedAt = new Date(cloud?.updated_at || 0).getTime();
      const tombstoneAt = new Date(cloud?.deleted_at || 0).getTime();
      if (cloud?.deleted_at && tombstoneAt >= localUpdatedAt) continue;
      if (!cloud || localUpdatedAt > cloudUpdatedAt) {
        if (await getSyncConflict('issue', issue.id)) continue;
        try {
          const result = await upsertCloudIssue({ workspaceId, userId, issue });
          await db.issues.update(issue.id, {
            cloudRevision: result.revision,
            cloudUpdatedAt: result.updated_at,
            cloudUpdatedBy: result.updated_by,
          });
          uploaded += 1;
        } catch (error) {
          if (await rememberConflict(error)) continue;
          throw error;
        }
      }
    }

    storeVisibleIds(workspaceId, userId, [...visibleIds, ...[...localById.values()]
      .filter((issue) => !issue.isDemo && !cloudById.has(issue.id))
      .map((issue) => issue.id)]);
    const result = { downloaded, uploaded, deleted, revoked: revokedIds.length, visibleIssueIds: [...visibleIds], syncedAt: new Date().toISOString() };
    report('synced', result);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('swm:issues-synced', { detail: result }));
    return result;
  } catch (error) {
    report('error', { error: error.message || 'Unable to synchronize Issues.' });
    throw error;
  }
}
