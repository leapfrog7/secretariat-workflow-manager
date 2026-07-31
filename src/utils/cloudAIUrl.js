export const CLOUD_RUN_AI_API_BASE_URL = 'https://swm-api-531052651172.asia-southeast1.run.app';

const LEGACY_VERCEL_AI_HOSTS = new Set([
  'secretariat-workflow-manager.vercel.app',
]);

export function resolveCloudAIBaseUrl(configuredValue = '') {
  const configured = String(configuredValue || '').trim().replace(/\/$/, '');
  if (!configured) return CLOUD_RUN_AI_API_BASE_URL;

  try {
    const url = new URL(configured);
    if (LEGACY_VERCEL_AI_HOSTS.has(url.hostname.toLowerCase())) {
      return CLOUD_RUN_AI_API_BASE_URL;
    }
    return configured;
  } catch {
    return CLOUD_RUN_AI_API_BASE_URL;
  }
}
