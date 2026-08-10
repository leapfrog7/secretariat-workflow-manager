import { cloudClient } from '../auth/cloudClient';

function requireClient() {
  if (!cloudClient) throw new Error('Push notifications require a signed-in cloud account.');
  return cloudClient;
}

export function decodeApplicationServerKey(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export async function registerPushSubscription(workspaceId, subscription) {
  const value = subscription.toJSON();
  const { data, error } = await requireClient().rpc('register_push_subscription', {
    target_workspace_id: workspaceId,
    target_endpoint: value.endpoint,
    target_p256dh: value.keys?.p256dh || '',
    target_auth_secret: value.keys?.auth || '',
  });
  if (error) throw error;
  return data;
}

export async function unregisterPushSubscription(workspaceId, endpoint) {
  const { error } = await requireClient().rpc('unregister_push_subscription', {
    target_workspace_id: workspaceId,
    target_endpoint: endpoint,
  });
  if (error) throw error;
}
