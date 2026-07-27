import { cloudClient } from '../auth/cloudClient';

function requireClient() {
  if (!cloudClient) throw new Error('Cloud access is not configured for this build.');
  return cloudClient;
}

export async function listDivisions(workspaceId) {
  const { data, error } = await requireClient().from('workspace_divisions')
    .select('id, workspace_id, name, code, is_active, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function saveDivision({ workspaceId, userId, division }) {
  const client = requireClient();
  const values = {
    workspace_id: workspaceId,
    name: division.name.trim(),
    code: division.code.trim().toLowerCase(),
    is_active: division.is_active !== false,
    updated_at: new Date().toISOString(),
  };
  if (division.id) {
    const { data, error } = await client.from('workspace_divisions').update(values)
      .eq('workspace_id', workspaceId).eq('id', division.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await client.from('workspace_divisions')
    .insert({ ...values, created_by: userId }).select().single();
  if (error) throw error;
  return data;
}

export async function listDivisionMembers(workspaceId) {
  const { data, error } = await requireClient().from('division_members')
    .select('workspace_id, division_id, user_id, role, status, created_at, updated_at')
    .eq('workspace_id', workspaceId);
  if (error) throw error;
  return data || [];
}

export async function setDivisionMember({ workspaceId, divisionId, userId, role, status, createdBy }) {
  const client = requireClient();
  const values = {
    workspace_id: workspaceId,
    division_id: divisionId,
    user_id: userId,
    role,
    status,
    updated_at: new Date().toISOString(),
  };
  const { data: updated, error: updateError } = await client.from('division_members').update(values)
    .eq('division_id', divisionId).eq('user_id', userId).select();
  if (updateError) throw updateError;
  if (updated?.length) return updated[0];
  const { data, error } = await client.from('division_members')
    .insert({ ...values, created_by: createdBy }).select().single();
  if (error) throw error;
  return data;
}

export async function getIssueAccessReadiness(workspaceId) {
  const { data, error } = await requireClient().rpc('issue_access_readiness', { target_workspace_id: workspaceId });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) || { active_divisions: 0, unassigned_issues: 0, active_members_without_division: 0, ready: false };
}

export async function setDivisionAccessEnabled(workspaceId, enabled) {
  const { data, error } = await requireClient().rpc('set_division_access_enabled', {
    target_workspace_id: workspaceId,
    next_enabled: enabled,
  });
  if (error) throw error;
  return data;
}

export async function getIssueAccessLevel(workspaceId, issueId) {
  const { data, error } = await requireClient().rpc('issue_access_level', {
    candidate_workspace_id: workspaceId,
    candidate_issue_id: issueId,
  });
  if (error) throw error;
  return data || 'none';
}

export async function canManageIssueAccess(workspaceId, issueId) {
  const { data, error } = await requireClient().rpc('can_manage_issue_access', {
    candidate_workspace_id: workspaceId,
    candidate_issue_id: issueId,
  });
  if (error) throw error;
  return data === true;
}

export async function listMyIssueAccess(workspaceId) {
  const { data, error } = await requireClient().rpc('list_my_issue_access', { target_workspace_id: workspaceId });
  if (error) throw error;
  return data || [];
}

export async function listIssueGrants(workspaceId, issueId) {
  const { data, error } = await requireClient().from('issue_access_grants')
    .select('workspace_id, issue_id, id, principal_type, principal_id, access_level, expires_at, created_at, updated_at')
    .eq('workspace_id', workspaceId).eq('issue_id', issueId).order('created_at');
  if (error) throw error;
  return data || [];
}

export async function saveIssueGrant({ workspaceId, issueId, grant, userId }) {
  const client = requireClient();
  const values = {
    workspace_id: workspaceId,
    issue_id: issueId,
    principal_type: grant.principalType,
    principal_id: grant.principalId,
    access_level: grant.accessLevel,
    expires_at: grant.expiresAt || null,
    granted_by: userId,
    updated_at: new Date().toISOString(),
  };
  const { data: existing, error: lookupError } = await client.from('issue_access_grants')
    .select('id').eq('workspace_id', workspaceId).eq('issue_id', issueId)
    .eq('principal_type', grant.principalType).eq('principal_id', grant.principalId);
  if (lookupError) throw lookupError;
  if (existing?.length) {
    const { data, error } = await client.from('issue_access_grants').update(values)
      .eq('workspace_id', workspaceId).eq('id', existing[0].id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await client.from('issue_access_grants').insert(values).select().single();
  if (error) throw error;
  return data;
}

export async function deleteIssueGrant(workspaceId, grantId) {
  const { error } = await requireClient().from('issue_access_grants')
    .delete().eq('workspace_id', workspaceId).eq('id', grantId);
  if (error) throw error;
}
