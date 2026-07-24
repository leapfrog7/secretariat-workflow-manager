import { db } from '../../db/database';
import { normalizeIssue } from '../../utils/issueUtils';
import { normalizeCommunication } from '../../utils/communicationUtils';
import { normalizeDraft } from '../../utils/draftUtils';
import { normalizeMilestone } from '../../utils/milestoneUtils';
import { normalizeReference } from '../../utils/referenceUtils';
import { normalizeIssueSummary } from '../../utils/summaryUtils';
import { clearSyncConflict } from '../../db/syncConflictRepository';
import { markCloudIssueDeleted, upsertCloudIssue } from './cloudIssueApi';
import { markCloudIssueItemDeleted, upsertCloudIssueItem } from './cloudIssueItemApi';

const ITEM_CONFIG = {
  communication: { table: 'communications', normalize: normalizeCommunication },
  reference: { table: 'references', normalize: normalizeReference },
  milestone: { table: 'issueMilestones', normalize: normalizeMilestone },
  summary: { table: 'issueSummaries', normalize: normalizeIssueSummary },
  draft: { table: 'drafts', normalize: normalizeDraft },
};

function metadata(result) {
  return {
    cloudRevision: Number(result?.revision || 0),
    cloudUpdatedAt: result?.updated_at || '',
    cloudUpdatedBy: result?.updated_by || '',
  };
}

async function finish(conflict) {
  await db.syncTombstones.delete(conflict.entityType === 'issue'
    ? `issue:${conflict.itemId}`
    : `item:${conflict.entityType}:${conflict.itemId}`);
  await clearSyncConflict(conflict.entityType, conflict.itemId, conflict.issueId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('swm:workspace-synced'));
  }
}

export async function acceptCloudVersion(conflict) {
  if (!conflict.cloudPayload) throw new Error('The cloud version is no longer available.');
  if (conflict.entityType === 'issue') {
    if (conflict.operation !== 'delete' && conflict.localPayload?.updatedAt) {
      const milestones = await db.issueMilestones.where('issueId').equals(conflict.issueId).toArray();
      const rejectedMilestones = milestones
        .filter((item) => item.recordedAt === conflict.localPayload.updatedAt && !item.cloudRevision)
        .map((item) => item.id);
      if (rejectedMilestones.length) await db.issueMilestones.bulkDelete(rejectedMilestones);
      const chronology = await db.chronology.where('issueId').equals(conflict.issueId).toArray();
      const rejectedEvents = chronology
        .filter((item) => item.eventDate === conflict.localPayload.updatedAt && item.eventType === 'Issue scheduled')
        .map((item) => item.id);
      if (rejectedEvents.length) await db.chronology.bulkDelete(rejectedEvents);
    }
    await db.issues.put(normalizeIssue({
      ...conflict.cloudPayload,
      ...metadata({
        revision: conflict.cloudRevision,
        updated_at: conflict.cloudUpdatedAt,
        updated_by: conflict.cloudUpdatedBy,
      }),
    }));
  } else {
    const config = ITEM_CONFIG[conflict.entityType];
    if (!config) throw new Error('Unsupported conflict type.');
    await db[config.table].put(config.normalize({
      ...conflict.cloudPayload,
      ...metadata({
        revision: conflict.cloudRevision,
        updated_at: conflict.cloudUpdatedAt,
        updated_by: conflict.cloudUpdatedBy,
      }),
    }));
  }
  await finish(conflict);
}

export async function retryLocalVersion(conflict, { workspaceId, userId }) {
  const config = conflict.entityType === 'issue' ? null : ITEM_CONFIG[conflict.entityType];
  const currentLocal = conflict.operation === 'delete'
    ? null
    : conflict.entityType === 'issue'
      ? await db.issues.get(conflict.itemId)
      : config
        ? await db[config.table].get(conflict.itemId)
        : null;
  const local = {
    ...(currentLocal || conflict.localPayload),
    cloudRevision: Number(conflict.cloudRevision || 0),
    cloudUpdatedAt: conflict.cloudUpdatedAt || '',
    cloudUpdatedBy: conflict.cloudUpdatedBy || '',
  };
  if (conflict.entityType === 'issue') {
    if (conflict.operation === 'delete') {
      await markCloudIssueDeleted({ workspaceId, issue: local, deletedAt: new Date().toISOString() });
    } else {
      const result = await upsertCloudIssue({ workspaceId, userId, issue: local });
      await db.issues.put(normalizeIssue({ ...local, ...metadata(result) }));
    }
  } else {
    if (!config) throw new Error('Unsupported conflict type.');
    if (conflict.operation === 'delete') {
      await markCloudIssueItemDeleted({
        workspaceId,
        itemType: conflict.entityType,
        item: local,
        deletedAt: new Date().toISOString(),
      });
    } else {
      const result = await upsertCloudIssueItem({
        workspaceId,
        userId,
        itemType: conflict.entityType,
        item: local,
      });
      await db[config.table].put(config.normalize({ ...local, ...metadata(result) }));
    }
  }
  await finish(conflict);
}
