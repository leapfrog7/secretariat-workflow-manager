import { cloudClient } from '../auth/cloudClient';

export const CLOUD_AI_PROVIDERS = [
  { id: 'openai', label: 'OpenAI', defaultModel: 'gpt-5.6-terra' },
  { id: 'gemini', label: 'Gemini', defaultModel: 'gemini-3.5-flash' },
];

function requireClient() {
  if (!cloudClient) throw new Error('Cloud access is not configured for this build.');
  return cloudClient;
}

export async function listAIProviderSettings(workspaceId) {
  if (!workspaceId) return [];
  const { data, error } = await requireClient().from('cloud_ai_provider_settings')
    .select('workspace_id,provider,enabled,model,allowed_roles,daily_user_request_limit,monthly_workspace_request_limit,monthly_budget_usd,input_cost_per_million_usd,output_cost_per_million_usd,updated_at')
    .eq('workspace_id', workspaceId)
    .order('provider', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveAIProviderSettings({ workspaceId, userId, settings }) {
  const client = requireClient();
  const now = new Date().toISOString();
  const update = {
    enabled: Boolean(settings.enabled),
    model: settings.model.trim(),
    allowed_roles: settings.allowed_roles,
    daily_user_request_limit: Number(settings.daily_user_request_limit),
    monthly_workspace_request_limit: Number(settings.monthly_workspace_request_limit),
    monthly_budget_usd: Number(settings.monthly_budget_usd) || 0,
    input_cost_per_million_usd: Number(settings.input_cost_per_million_usd) || 0,
    output_cost_per_million_usd: Number(settings.output_cost_per_million_usd) || 0,
    updated_by: userId,
    updated_at: now,
  };
  const { data, error } = await client.from('cloud_ai_provider_settings').update(update)
    .eq('workspace_id', workspaceId).eq('provider', settings.provider).select('provider');
  if (error) throw error;
  if (data?.length) return;
  const { error: insertError } = await client.from('cloud_ai_provider_settings').insert({
    workspace_id: workspaceId,
    provider: settings.provider,
    ...update,
    created_by: userId,
    created_at: now,
  });
  if (insertError) throw insertError;
}

export async function listAIUserPermissions(workspaceId) {
  if (!workspaceId) return [];
  const { data, error } = await requireClient().from('cloud_ai_user_permissions')
    .select('workspace_id,user_id,provider,allowed,daily_request_limit,updated_at')
    .eq('workspace_id', workspaceId);
  if (error) throw error;
  return data || [];
}

export async function setAIUserPermission({ workspaceId, userId, provider, value, updatedBy }) {
  const client = requireClient();
  if (value === 'inherit') {
    const { error } = await client.from('cloud_ai_user_permissions').delete()
      .eq('workspace_id', workspaceId).eq('user_id', userId).eq('provider', provider);
    if (error) throw error;
    return;
  }
  const now = new Date().toISOString();
  const update = { allowed: value === 'allow', daily_request_limit: null, updated_by: updatedBy, updated_at: now };
  const { data, error } = await client.from('cloud_ai_user_permissions').update(update)
    .eq('workspace_id', workspaceId).eq('user_id', userId).eq('provider', provider).select('user_id');
  if (error) throw error;
  if (data?.length) return;
  const { error: insertError } = await client.from('cloud_ai_user_permissions').insert({
    workspace_id: workspaceId, user_id: userId, provider, ...update,
  });
  if (insertError) throw insertError;
}

export async function getAIUsageSummary(workspaceId) {
  if (!workspaceId) return [];
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { data, error } = await requireClient().from('cloud_ai_generation_logs')
    .select('provider,status,input_tokens,output_tokens,estimated_cost_usd,created_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', monthStart.toISOString());
  if (error) throw error;
  return CLOUD_AI_PROVIDERS.map(({ id, label }) => {
    const rows = (data || []).filter((row) => row.provider === id);
    return {
      provider: id,
      label,
      requests: rows.length,
      completed: rows.filter((row) => row.status === 'completed').length,
      failed: rows.filter((row) => row.status === 'failed').length,
      inputTokens: rows.reduce((sum, row) => sum + Number(row.input_tokens || 0), 0),
      outputTokens: rows.reduce((sum, row) => sum + Number(row.output_tokens || 0), 0),
      estimatedCost: rows.reduce((sum, row) => sum + Number(row.estimated_cost_usd || 0), 0),
    };
  });
}
