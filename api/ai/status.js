import { applyCors, requireBearerToken, sendError } from '../lib/http.js';
import { listAccessibleProviders, providerKeyConfigured } from '../lib/cloudAI.js';

export default async function handler(request, response) {
  applyCors(request, response);
  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  try {
    const token = requireBearerToken(request);
    const workspaceId = String(request.query.workspaceId || '');
    if (!workspaceId) throw Object.assign(new Error('Workspace is required.'), { status: 400, code: 'invalid_request' });
    const providers = await listAccessibleProviders({ token, workspaceId });
    return response.status(200).json({ providers: providers.map((provider) => ({ ...provider, keyConfigured: providerKeyConfigured(provider.provider) })) });
  } catch (error) {
    return sendError(response, error);
  }
}
