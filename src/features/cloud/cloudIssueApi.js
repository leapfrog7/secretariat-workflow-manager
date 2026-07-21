import { cloudClient } from '../auth/cloudClient';

const CLOUD_ISSUE_FIELDS = 'workspace_id, id, payload, updated_at, deleted_at';

function requireClient() {
  if (!cloudClient) throw new Error('Cloud access is not configured for this build.');
  return cloudClient;
}

export async function listCloudIssueRows(workspaceId) {
  const client = requireClient();
  const { data, error } = await client
    .from('cloud_issues')
    .select(CLOUD_ISSUE_FIELDS)
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function upsertCloudIssue({ workspaceId, userId, issue }) {
  const client = requireClient();
  const update = {
    payload: issue,
    status: issue.status || 'Pending',
    assigned_officer_id: issue.assignedOfficerId || '',
    next_deadline: issue.nextDeadline || null,
    is_archived: Boolean(issue.isArchived),
    is_scheduled: Boolean(issue.isScheduled),
    updated_by: userId,
    updated_at: issue.updatedAt || new Date().toISOString(),
    deleted_at: null,
  };
  const { data: updated, error: updateError } = await client
    .from('cloud_issues')
    .update(update)
    .eq('workspace_id', workspaceId)
    .eq('id', issue.id)
    .select('id');

  if (updateError) throw updateError;
  if (updated?.length) return;

  const { error: insertError } = await client
    .from('cloud_issues')
    .insert({
      workspace_id: workspaceId,
      id: issue.id,
      ...update,
      created_by: userId,
      created_at: issue.createdAt || new Date().toISOString(),
    });

  if (insertError) throw insertError;
}

export async function markCloudIssueDeleted({ workspaceId, userId, issueId, deletedAt }) {
  const client = requireClient();
  const { error } = await client
    .from('cloud_issues')
    .update({ deleted_at: deletedAt, updated_at: deletedAt, updated_by: userId })
    .eq('workspace_id', workspaceId)
    .eq('id', issueId);

  if (error) throw error;
}
