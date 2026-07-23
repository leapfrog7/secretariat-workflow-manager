import { randomUUID } from 'node:crypto';
import { applyCors, requireBearerToken, sendError } from '../lib/http.js';
import {
  attachGenerationFingerprint,
  callCloudProvider,
  completeGenerationLog,
  failGenerationLog,
  requireCloudAIDatabase,
  requestFingerprint,
  reserveCloudAIRequest,
} from '../lib/cloudAI.js';
import { getGeminiTaskLevel, normalizeGeminiTaskLevel } from '../../shared/cloudAIModels.js';

export default async function handler(request, response) {
  applyCors(request, response);
  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

  let requestId = '';
  let fingerprint = '';
  try {
    const token = requireBearerToken(request);
    const { workspaceId, issueId = null, provider, operation, instructions, input, taskLevel } = request.body || {};
    if (!workspaceId || typeof instructions !== 'string' || typeof input !== 'string') {
      throw Object.assign(new Error('Workspace, instructions and input are required.'), { status: 400, code: 'invalid_request' });
    }
    const promptCharacters = instructions.length + input.length;
    requireCloudAIDatabase();
    requestId = randomUUID();
    fingerprint = requestFingerprint(instructions, input);
    const authorization = await reserveCloudAIRequest({ token, workspaceId, issueId, provider, operation, requestId, promptCharacters });
    await attachGenerationFingerprint({ requestId, fingerprint });
    const selectedTaskLevel = provider === 'gemini' ? normalizeGeminiTaskLevel(taskLevel) : null;
    const geminiTask = selectedTaskLevel ? getGeminiTaskLevel(selectedTaskLevel) : null;
    const model = geminiTask?.model || authorization.model;
    const result = await callCloudProvider({
      provider,
      model,
      fallbackModels: geminiTask?.fallbackModel ? [geminiTask.fallbackModel] : [],
      thinkingLevel: geminiTask?.thinkingLevel,
      instructions,
      input,
    });
    const estimatedCost = await completeGenerationLog({ requestId, result, authorization, responseCharacters: result.text.length });
    return response.status(200).json({
      text: result.text,
      model: result.model,
      provider,
      taskLevel: selectedTaskLevel,
      usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens, estimatedCost: estimatedCost || 0 },
      requestId,
    });
  } catch (error) {
    console.error('Cloud AI generation failed.', {
      requestId: requestId || undefined,
      provider: String(request.body?.provider || ''),
      operation: String(request.body?.operation || ''),
      code: error.code || 'cloud_ai_error',
      status: Number(error.status) || 500,
      message: error.message,
    });
    if (requestId) await failGenerationLog({ requestId, code: error.code, fingerprint }).catch(() => {});
    return sendError(response, error);
  }
}
