import { cloudClient } from '../auth/cloudClient';
import { CloudRevisionConflict } from './cloudRevisionConflict';
import { shouldRetryMissingCloudIssueItem } from './cloudIssueItemRecovery';

const CLOUD_ITEM_FIELDS = 'workspace_id, issue_id, item_type, id, payload, updated_by, updated_at, deleted_at, revision';

function requireClient() {
  if (!cloudClient) throw new Error('Cloud access is not configured for this build.');
  return cloudClient;
}

export async function listCloudIssueItems(workspaceId) {
  const { data, error } = await requireClient()
    .from('cloud_issue_items')
    .select(CLOUD_ITEM_FIELDS)
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function saveCloudIssueItem({ workspaceId, itemType, item, expectedRevision }) {
  const client = requireClient();
  return client.rpc('save_cloud_issue_item_revision', {
    target_workspace_id: workspaceId,
    target_issue_id: item.issueId,
    target_item_type: itemType,
    target_item_id: item.id,
    target_payload: item,
    expected_revision: expectedRevision,
  });
}

export async function upsertCloudIssueItem({
  workspaceId,
  itemType,
  item,
  expectedRevision: suppliedExpectedRevision,
}) {
  const expectedRevision = suppliedExpectedRevision === undefined
    ? Number(item.cloudRevision || 0)
    : Number(suppliedExpectedRevision || 0);
  let { data, error } = await saveCloudIssueItem({
    workspaceId,
    itemType,
    item,
    expectedRevision,
  });

  if (shouldRetryMissingCloudIssueItem(error, expectedRevision)) {
    ({ data, error } = await saveCloudIssueItem({
      workspaceId,
      itemType,
      item,
      expectedRevision: 0,
    }));
  }

  if (error) throw error;
  const result = data?.[0];
  if (!result?.saved) {
    throw new CloudRevisionConflict({
      entityType: itemType,
      itemId: item.id,
      issueId: item.issueId,
      localPayload: item,
      cloudResult: result,
    });
  }
  return result;
}

export async function markCloudIssueItemDeleted({ workspaceId, itemType, item, deletedAt }) {
  const localPayload = { ...item, deletedAt, _deleted: true };
  const { data, error } = await requireClient().rpc('delete_cloud_issue_item_revision', {
    target_workspace_id: workspaceId,
    target_item_type: itemType,
    target_item_id: item.id,
    expected_revision: Number(item.cloudRevision || 0),
  });
  if (error) throw error;
  const result = data?.[0];
  if (!result?.saved) {
    throw new CloudRevisionConflict({
      entityType: itemType,
      itemId: item.id,
      issueId: item.issueId,
      localPayload,
      cloudResult: result,
      operation: 'delete',
    });
  }
  return result;
}
