import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const PROVIDERS = new Set(['openai', 'gemini']);
const OPERATIONS = new Set(['draft', 'paragraph']);

function dataApiUrl() {
  const value = [process.env.NEON_DATA_API_URL, process.env.VITE_NEON_DATA_API_URL]
    .map((candidate) => String(candidate || '').trim())
    .find((candidate) => {
      try {
        return ['http:', 'https:'].includes(new URL(candidate).protocol);
      } catch {
        return false;
      }
    });
  if (!value) throw Object.assign(new Error('Cloud data access is not configured.'), { status: 503, code: 'data_api_not_configured' });
  return value.replace(/\/$/, '');
}

async function dataApiRequest(token, path, options = {}) {
  const response = await fetch(`${dataApiUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || payload?.error || 'Cloud authorization failed.';
    const status = response.status === 401 ? 401 : response.status === 403 ? 403 : 400;
    throw Object.assign(new Error(message), { status, code: 'cloud_ai_not_authorized' });
  }
  return payload;
}

export async function reserveCloudAIRequest({ token, workspaceId, issueId, provider, operation, requestId, promptCharacters }) {
  if (!PROVIDERS.has(provider) || !OPERATIONS.has(operation)) {
    throw Object.assign(new Error('Invalid Cloud AI request.'), { status: 400, code: 'invalid_request' });
  }
  const rows = await dataApiRequest(token, '/rpc/authorize_cloud_ai_request', {
    method: 'POST',
    body: JSON.stringify({
      target_workspace_id: workspaceId,
      selected_provider: provider,
      selected_operation: operation,
      target_issue_id: issueId || null,
      request_identifier: requestId,
      prompt_size: promptCharacters,
    }),
  });
  const authorization = Array.isArray(rows) ? rows[0] : rows;
  if (!authorization?.model) throw Object.assign(new Error('Cloud AI access was not granted.'), { status: 403, code: 'cloud_ai_not_authorized' });
  return authorization;
}

export async function listAccessibleProviders({ token, workspaceId }) {
  const query = new URLSearchParams({
    workspace_id: `eq.${workspaceId}`,
    select: 'provider,enabled,model,daily_user_request_limit,monthly_workspace_request_limit,monthly_budget_usd,input_cost_per_million_usd,output_cost_per_million_usd',
    order: 'provider.asc',
  });
  return dataApiRequest(token, `/cloud_ai_provider_settings?${query}`, { method: 'GET' });
}

export function providerKeyConfigured(provider) {
  if (provider === 'openai') return Boolean(process.env.OPENAI_API_KEY);
  if (provider === 'gemini') return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  return false;
}

export function requireCloudAIDatabase() {
  if (!process.env.DATABASE_URL) {
    throw Object.assign(new Error('Cloud AI logging is not configured on the server.'), { status: 503, code: 'database_not_configured' });
  }
}

async function callOpenAI({ model, instructions, input }) {
  if (!process.env.OPENAI_API_KEY) throw Object.assign(new Error('OpenAI is not configured on the server.'), { status: 503, code: 'provider_not_configured' });
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(55000),
    body: JSON.stringify({ model, instructions, input, max_output_tokens: 4096, store: false }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error?.message || 'OpenAI rejected the request.'), { status: 502, code: 'provider_request_failed' });
  const text = payload.output_text || (payload.output || []).flatMap((item) => item.content || []).map((item) => item.text || '').join('\n').trim();
  return { text, inputTokens: payload.usage?.input_tokens || 0, outputTokens: payload.usage?.output_tokens || 0, model: payload.model || model };
}

function geminiModelUnavailable(response, payload) {
  const message = String(payload?.error?.message || '');
  return response.status === 404 || /(?:model.+(?:unavailable|not found|not supported|deprecated)|no longer available)/i.test(message);
}

async function callGemini({ model, fallbackModels = [], thinkingLevel = 'medium', instructions, input }) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw Object.assign(new Error('Gemini is not configured on the server.'), { status: 503, code: 'provider_not_configured' });
  const modelCandidates = [...new Set([model, ...fallbackModels].filter(Boolean))];
  let payload = {};

  for (let modelIndex = 0; modelIndex < modelCandidates.length; modelIndex += 1) {
    const candidateModel = modelCandidates[modelIndex];
    const request = {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: instructions }] },
        contents: [{ role: 'user', parts: [{ text: input }] }],
        generationConfig: {
          maxOutputTokens: 4096,
          thinkingConfig: { thinkingLevel },
        },
      }),
    };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidateModel)}:generateContent`, {
        ...request,
        signal: AbortSignal.timeout(50000),
      });
      payload = await response.json().catch(() => ({}));
      if (response.ok) {
        const text = (payload.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('\n').trim();
        return {
          text,
          inputTokens: payload.usageMetadata?.promptTokenCount || 0,
          outputTokens: payload.usageMetadata?.candidatesTokenCount || 0,
          model: candidateModel,
        };
      }

      if (geminiModelUnavailable(response, payload) && modelIndex < modelCandidates.length - 1) break;
      const temporarilyUnavailable = response.status === 429 || response.status >= 500;
      if (!temporarilyUnavailable || attempt === 2) {
        const busyMessage = temporarilyUnavailable
          ? 'Gemini is currently busy. Please try again in a few minutes.'
          : undefined;
        throw Object.assign(new Error(payload.error?.message || 'Gemini rejected the request.'), {
          status: temporarilyUnavailable ? 503 : 502,
          code: geminiModelUnavailable(response, payload) ? 'provider_model_unavailable' : temporarilyUnavailable ? 'provider_busy' : 'provider_request_failed',
          publicMessage: busyMessage,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
    }
  }

  throw Object.assign(new Error(payload.error?.message || 'No configured Gemini model is available.'), {
    status: 502,
    code: 'provider_model_unavailable',
  });
}

export async function callCloudProvider({ provider, model, fallbackModels, thinkingLevel, instructions, input }) {
  const result = provider === 'openai'
    ? await callOpenAI({ model, instructions, input })
    : await callGemini({ model, fallbackModels, thinkingLevel, instructions, input });
  if (!result.text) throw Object.assign(new Error('The provider returned no draft text.'), { status: 502, code: 'empty_provider_response' });
  return result;
}

export function requestFingerprint(instructions, input) {
  return createHash('sha256').update(`${instructions}\n${input}`).digest('hex');
}

export async function completeGenerationLog({ requestId, result, authorization, responseCharacters }) {
  requireCloudAIDatabase();
  const sql = neon(process.env.DATABASE_URL);
  const inputRate = Number(authorization.input_rate) || 0;
  const outputRate = Number(authorization.output_rate) || 0;
  const estimatedCost = ((result.inputTokens * inputRate) + (result.outputTokens * outputRate)) / 1000000;
  await sql`
    UPDATE public.cloud_ai_generation_logs
    SET status = 'completed', model = ${result.model}, input_tokens = ${result.inputTokens},
        output_tokens = ${result.outputTokens}, estimated_cost_usd = ${estimatedCost},
        response_characters = ${responseCharacters}, completed_at = now()
    WHERE id = ${requestId}::uuid
  `;
  return estimatedCost;
}

export async function failGenerationLog({ requestId, code, fingerprint }) {
  if (!process.env.DATABASE_URL) return;
  const sql = neon(process.env.DATABASE_URL);
  await sql`
    UPDATE public.cloud_ai_generation_logs
    SET status = 'failed', error_code = ${String(code || 'provider_error').slice(0, 80)},
        request_fingerprint = ${fingerprint || ''}, completed_at = now()
    WHERE id = ${requestId}::uuid
  `;
}

export async function attachGenerationFingerprint({ requestId, fingerprint }) {
  requireCloudAIDatabase();
  const sql = neon(process.env.DATABASE_URL);
  await sql`UPDATE public.cloud_ai_generation_logs SET request_fingerprint = ${fingerprint} WHERE id = ${requestId}::uuid`;
}
