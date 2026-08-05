import { cloudClient } from '../auth/cloudClient';

import { CloudRevisionConflict } from './cloudRevisionConflict';
import { fetchCompleteCloudCollection } from './cloudPagination';

const CLOUD_ISSUE_FIELDS = 'workspace_id, id, payload, owning_division_id, visibility, created_by, updated_by, updated_at, deleted_at, revision';

function requireClient() {
  if (!cloudClient) throw new Error('Cloud access is not configured for this build.');
  return cloudClient;
}

export async function listCloudIssueRows(workspaceId) {
  const client = requireClient();
  return fetchCompleteCloudCollection(({ from, to, includeCount }) => client
    .from('cloud_issues')
    .select(CLOUD_ISSUE_FIELDS, includeCount ? { count: 'exact' } : undefined)
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: true })
    .range(from, to));
}

export async function upsertCloudIssue({ workspaceId, issue }) {
  const client = requireClient();
  const { data, error } = await client.rpc('save_cloud_issue_revision', {
    target_workspace_id: workspaceId,
    target_issue_id: issue.id,
    target_payload: issue,
    expected_revision: Number(issue.cloudRevision || 0),
    target_status: issue.status || 'Pending',
    target_assigned_officer_id: issue.assignedOfficerId || '',
    target_next_deadline: issue.nextDeadline || null,
    target_is_archived: Boolean(issue.isArchived),
    target_is_scheduled: Boolean(issue.isScheduled),
    target_owning_division_id: issue.owningDivisionId || null,
    target_visibility: issue.visibility || 'workspace',
  });
  if (error) throw error;
  const result = data?.[0];
  if (!result?.saved) {
    throw new CloudRevisionConflict({
      entityType: 'issue',
      itemId: issue.id,
      issueId: issue.id,
      localPayload: issue,
      cloudResult: result,
    });
  }
  return result;
}

export async function markCloudIssueDeleted({ workspaceId, issue, deletedAt }) {
  const client = requireClient();
  const localPayload = { ...issue, deletedAt, _deleted: true };
  const { data, error } = await client.rpc('delete_cloud_issue_revision', {
    target_workspace_id: workspaceId,
    target_issue_id: issue.id,
    expected_revision: Number(issue.cloudRevision || 0),
  });
  if (error) throw error;
  const result = data?.[0];
  if (!result?.saved) {
    throw new CloudRevisionConflict({
      entityType: 'issue',
      itemId: issue.id,
      issueId: issue.id,
      localPayload,
      cloudResult: result,
      operation: 'delete',
    });
  }
  return result;
}
