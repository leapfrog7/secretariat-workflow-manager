import { cloudClient } from '../auth/cloudClient';

function requireClient() {
  if (!cloudClient) throw new Error('Cloud access is not configured for this build.');
  return cloudClient;
}

export async function getCloudWorkspaceSettings(workspaceId) {
  const { data, error } = await requireClient().from('cloud_workspace_settings').select('workspace_id, payload, updated_at').eq('workspace_id', workspaceId).limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function upsertCloudWorkspaceSettings({ workspaceId, userId, payload, updatedAt }) {
  const client = requireClient();
  const update = { payload, updated_by: userId, updated_at: updatedAt };
  const { data, error } = await client.from('cloud_workspace_settings').update(update).eq('workspace_id', workspaceId).select('workspace_id');
  if (error) throw error;
  if (data?.length) return;
  const { error: insertError } = await client.from('cloud_workspace_settings').insert({ workspace_id: workspaceId, ...update, created_by: userId, created_at: updatedAt });
  if (insertError) throw insertError;
}

export async function getCloudUserSettings(workspaceId, userId) {
  const { data, error } = await requireClient().from('cloud_user_settings').select('workspace_id, user_id, payload, updated_at').eq('workspace_id', workspaceId).eq('user_id', userId).limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function upsertCloudUserSettings({ workspaceId, userId, payload, updatedAt }) {
  const client = requireClient();
  const update = { payload, updated_at: updatedAt };
  const { data, error } = await client.from('cloud_user_settings').update(update).eq('workspace_id', workspaceId).eq('user_id', userId).select('user_id');
  if (error) throw error;
  if (data?.length) return;
  const { error: insertError } = await client.from('cloud_user_settings').insert({ workspace_id: workspaceId, user_id: userId, ...update, created_at: updatedAt });
  if (insertError) throw insertError;
}
