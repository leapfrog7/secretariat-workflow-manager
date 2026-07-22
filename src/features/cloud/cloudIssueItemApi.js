import { cloudClient } from '../auth/cloudClient';

const CLOUD_ITEM_FIELDS = 'workspace_id, issue_id, item_type, id, payload, updated_at, deleted_at';

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

export async function upsertCloudIssueItem({ workspaceId, userId, itemType, item }) {
  const client = requireClient();
  const updatedAt = item.updatedAt || item.createdAt || new Date().toISOString();
  const update = {
    issue_id: item.issueId,
    payload: item,
    updated_by: userId,
    updated_at: updatedAt,
    deleted_at: null,
  };
  const { data: updated, error: updateError } = await client
    .from('cloud_issue_items')
    .update(update)
    .eq('workspace_id', workspaceId)
    .eq('item_type', itemType)
    .eq('id', item.id)
    .select('id');
  if (updateError) throw updateError;
  if (updated?.length) return;

  const { error: insertError } = await client.from('cloud_issue_items').insert({
    workspace_id: workspaceId,
    issue_id: item.issueId,
    item_type: itemType,
    id: item.id,
    ...update,
    created_by: userId,
    created_at: item.createdAt || updatedAt,
  });
  if (insertError) throw insertError;
}

export async function markCloudIssueItemDeleted({ workspaceId, userId, itemType, itemId, deletedAt }) {
  const { error } = await requireClient()
    .from('cloud_issue_items')
    .update({ deleted_at: deletedAt, updated_at: deletedAt, updated_by: userId })
    .eq('workspace_id', workspaceId)
    .eq('item_type', itemType)
    .eq('id', itemId);
  if (error) throw error;
}
