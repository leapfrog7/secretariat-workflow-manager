import { cloudClient } from '../auth/cloudClient';

const WORKSPACE_FIELDS = 'id, name, code, is_active, division_access_enabled, created_by, created_at, updated_at';
const MEMBER_FIELDS = 'workspace_id, user_id, role, status, created_at, updated_at';

function requireClient() {
  if (!cloudClient) throw new Error('Cloud access is not configured for this build.');
  return cloudClient;
}

export async function listMyWorkspaces(userId) {
  if (!userId) return [];
  const client = requireClient();
  const { data: memberships, error: membershipError } = await client
    .from('workspace_members')
    .select(MEMBER_FIELDS)
    .eq('user_id', userId)
    .eq('status', 'active');

  if (membershipError) throw membershipError;
  if (!memberships?.length) return [];

  const { data: workspaces, error: workspaceError } = await client
    .from('workspaces')
    .select(WORKSPACE_FIELDS)
    .in('id', memberships.map((membership) => membership.workspace_id))
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (workspaceError) throw workspaceError;
  const membershipsByWorkspace = new Map(memberships.map((membership) => [membership.workspace_id, membership]));
  return (workspaces || []).map((workspace) => ({
    ...workspace,
    membership: membershipsByWorkspace.get(workspace.id),
  }));
}

export async function ensurePlatformWorkspace() {
  const client = requireClient();
  const { data, error } = await client.rpc('ensure_platform_workspace', {
    default_name: 'Secretariat Workspace',
    default_code: 'secretariat',
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function listWorkspaceMembers(workspaceId) {
  if (!workspaceId) return [];
  const client = requireClient();
  const { data, error } = await client
    .from('workspace_members')
    .select(MEMBER_FIELDS)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function listWorkspaceAccessDirectory() {
  const client = requireClient();
  const [{ data: memberships, error: membershipError }, { data: workspaces, error: workspaceError }] =
    await Promise.all([
      client
        .from('workspace_members')
        .select(MEMBER_FIELDS)
        .order('created_at', { ascending: true }),
      client
        .from('workspaces')
        .select(WORKSPACE_FIELDS)
        .eq('is_active', true)
        .order('created_at', { ascending: true }),
    ]);

  if (membershipError) throw membershipError;
  if (workspaceError) throw workspaceError;
  const workspacesById = new Map(
    (workspaces || []).map((workspace) => [workspace.id, workspace]),
  );
  return (memberships || []).map((membership) => ({
    ...membership,
    workspace: workspacesById.get(membership.workspace_id) || null,
  }));
}

export async function setWorkspaceMember({ workspaceId, userId, role, status }) {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_set_workspace_member', {
    target_workspace_id: workspaceId,
    target_user_id: userId,
    next_role: role,
    next_status: status,
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function createWorkspaceForUser({
  userId,
  name,
  code,
  sourceWorkspaceId = null,
}) {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_create_workspace_for_user', {
    target_user_id: userId,
    workspace_name: name,
    workspace_code: code,
    source_workspace_id: sourceWorkspaceId || null,
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function approveAndAssignUser({
  userId,
  workspaceId,
  role,
}) {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_approve_and_assign_user', {
    target_user_id: userId,
    target_workspace_id: workspaceId,
    next_workspace_role: role,
  });

  if (error) throw error;
  return data;
}
