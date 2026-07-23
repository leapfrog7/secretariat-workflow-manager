import { cloudClient } from '../auth/cloudClient';

function requireClient() {
  if (!cloudClient) throw new Error('Cloud access is not configured for this build.');
  return cloudClient;
}

export async function listCloudOfficerRows(workspaceId) {
  const client = requireClient();
  const { data, error } = await client
    .from('cloud_officers')
    .select('workspace_id, id, payload, updated_at')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function upsertCloudOfficer({ workspaceId, userId, officer }) {
  const client = requireClient();
  const update = {
    payload: officer,
    is_active: Boolean(officer.isActive),
    updated_by: userId,
    updated_at: officer.updatedAt || new Date().toISOString(),
  };
  const { data: updated, error: updateError } = await client
    .from('cloud_officers')
    .update(update)
    .eq('workspace_id', workspaceId)
    .eq('id', officer.id)
    .select('id');

  if (updateError) throw updateError;
  if (updated?.length) return;

  const { error: insertError } = await client
    .from('cloud_officers')
    .insert({
      workspace_id: workspaceId,
      id: officer.id,
      ...update,
      created_by: userId,
      created_at: officer.createdAt || new Date().toISOString(),
    });

  if (insertError) throw insertError;
}

export async function deleteCloudOfficer({ workspaceId, officerId }) {
  const { error } = await requireClient()
    .from('cloud_officers')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', officerId);

  if (error) throw error;
}
