import { cloudClient } from '../auth/cloudClient';

function requireClient() {
  if (!cloudClient) throw new Error('Cloud access is not configured for this build.');
  return cloudClient;
}

export async function getCloudWorkspaceSettings(workspaceId) {
  const { data, error } = await requireClient().from('cloud_workspace_settings').select('workspace_id, payload, revision, updated_at, updated_by').eq('workspace_id', workspaceId).limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function upsertCloudWorkspaceSettings({ workspaceId, payload, expectedRevision = 0 }) {
  const { data, error } = await requireClient().rpc('save_cloud_workspace_settings_revision', {
    target_workspace_id: workspaceId,
    target_payload: payload,
    expected_revision: Number(expectedRevision || 0),
  });
  if (error) throw error;
  const result = data?.[0];
  if (!result?.saved) {
    const conflict = new Error('Office settings changed in the cloud. Sync before saving your changes again.');
    conflict.name = 'CloudWorkspaceSettingsConflict';
    conflict.code = 'workspace_settings_conflict';
    conflict.cloudResult = result || null;
    throw conflict;
  }
  return result;
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
