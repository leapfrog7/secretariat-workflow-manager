import { cloudClient } from './cloudClient';

const PROFILE_FIELDS = 'user_id, email, display_name, status, role, reviewed_by, reviewed_at, created_at, updated_at';

function requireClient() {
  if (!cloudClient) throw new Error('Cloud access is not configured for this build.');
  return cloudClient;
}

export async function getProfile(userId) {
  const client = requireClient();
  const { data, error } = await client
    .from('profiles')
    .select(PROFILE_FIELDS)
    .eq('user_id', userId)
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
}

export async function ensureProfile(user) {
  const existing = await getProfile(user.id);
  if (existing) return existing;

  const client = requireClient();
  const { data, error } = await client
    .from('profiles')
    .insert({
      user_id: user.id,
      email: user.email,
      display_name: user.name || '',
      status: 'pending',
      role: 'user',
    })
    .select(PROFILE_FIELDS)
    .single();

  if (error) {
    const profile = await getProfile(user.id);
    if (profile) return profile;
    throw error;
  }

  return data;
}

export async function listProfiles() {
  const client = requireClient();
  const { data, error } = await client
    .from('profiles')
    .select(PROFILE_FIELDS)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function updateProfileAccess({ userId, status, role }) {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_update_profile', {
    target_user_id: userId,
    next_status: status,
    next_role: role,
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}
