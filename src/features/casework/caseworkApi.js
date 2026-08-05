import { cloudClient } from '../auth/cloudClient';

export async function searchCloudCaseworkIssues({ workspaceId, query = '', limit = 20, offset = 0 }) {
  if (!cloudClient || !workspaceId) throw new Error('Cloud Casework search is unavailable.');
  const { data, error } = await cloudClient.rpc('search_casework_issues', {
    target_workspace_id: workspaceId,
    search_text: query,
    page_limit: limit,
    page_offset: offset,
  });
  if (error) throw error;
  const rows = data || [];
  return {
    items: rows.map((row) => ({
      id: row.issue_id,
      shortTitle: row.short_title,
      status: row.status,
      updatedAt: row.updated_at,
    })),
    total: Number(rows[0]?.total_count || 0),
  };
}

function safeErrorCode(error) {
  return String(error?.code || error?.name || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .slice(0, 80) || 'unknown';
}

export async function recordCaseworkOperationalEvent({ workspaceId, issueId = null, eventType, operation = '', provider = '', error }) {
  if (!cloudClient || !workspaceId) return false;
  try {
    const { error: rpcError } = await cloudClient.rpc('record_casework_operational_event', {
      target_workspace_id: workspaceId,
      target_issue_id: issueId || null,
      target_event_type: eventType,
      target_operation: operation,
      target_provider: provider,
      target_error_code: safeErrorCode(error),
    });
    return !rpcError;
  } catch {
    return false;
  }
}
