import { cloudClient } from '../auth/cloudClient';

function requireClient() {
  if (!cloudClient) throw new Error('Cloud access is not configured for this build.');
  return cloudClient;
}

export async function listNotifications(workspaceId, userId) {
  const { data, error } = await requireClient()
    .from('cloud_notifications')
    .select('id, issue_id, notification_type, title, message, due_date, read_at, created_at')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('in_app', true)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data || [];
}

export async function markNotificationRead(id) {
  const { error } = await requireClient().from('cloud_notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(workspaceId, userId) {
  const { error } = await requireClient()
    .from('cloud_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('in_app', true)
    .is('read_at', null);
  if (error) throw error;
}
