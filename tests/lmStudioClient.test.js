import assert from 'node:assert/strict';
import test from 'node:test';
import {
  estimateLocalPromptTokens,
  requestLocalDraftAI,
  testLMStudioModel,
} from '../src/services/lmStudioClient.js';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('local model test follows the sole loaded model when the saved selection is stale', async (context) => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).endsWith('/api/v1/models')) {
      return jsonResponse({
        models: [
          {
            type: 'llm',
            key: 'old-model',
            display_name: 'Old Model',
            loaded_instances: [],
          },
          {
            type: 'llm',
            key: 'loaded-model',
            display_name: 'Loaded Model',
            loaded_instances: [{ config: { context_length: 8192 } }],
            capabilities: { reasoning: { allowed_options: ['off', 'on'] } },
          },
        ],
      });
    }
    return jsonResponse({
      model_instance_id: 'loaded-model',
      output: [{ type: 'message', content: 'READY' }],
    });
  };
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await testLMStudioModel({
    baseUrl: 'http://127.0.0.1:1234',
    model: 'old-model',
  });
  const chatBody = JSON.parse(requests[1].options.body);

  assert.equal(result.model.id, 'loaded-model');
  assert.equal(chatBody.model, 'loaded-model');
  assert.equal(chatBody.max_output_tokens, 8);
  assert.equal(chatBody.reasoning, 'off');
});

test('local drafting rejects an unloaded selection when several other models are loaded', async (context) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({
    models: [
      { type: 'llm', key: 'selected', display_name: 'Selected', loaded_instances: [] },
      { type: 'llm', key: 'loaded-one', display_name: 'Loaded One', loaded_instances: [{}] },
      { type: 'llm', key: 'loaded-two', display_name: 'Loaded Two', loaded_instances: [{}] },
    ],
  });
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(
    requestLocalDraftAI({
      settings: { baseUrl: 'http://127.0.0.1:1234', model: 'selected' },
      instructions: 'Draft.',
      input: 'Context.',
    }),
    /downloaded but not loaded/,
  );
});

test('local drafting converts an empty server 500 into a useful model recovery message', async (context) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/api/v1/models')) {
      return jsonResponse({
        models: [{
          type: 'llm',
          key: 'loaded-model',
          display_name: 'Loaded Model',
          loaded_instances: [{}],
        }],
      });
    }
    return new Response('', { status: 500 });
  };
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(
    requestLocalDraftAI({
      settings: { baseUrl: 'http://127.0.0.1:1234', model: 'loaded-model' },
      instructions: 'Draft.',
      input: 'Context.',
    }),
    /Unload and reload that model/,
  );
});

test('local drafting rejects context that cannot fit the loaded model before inference', async (context) => {
  const originalFetch = globalThis.fetch;
  let chatCalled = false;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/api/v1/models')) {
      return jsonResponse({
        models: [{
          type: 'llm',
          key: 'small-context-model',
          display_name: 'Small Context Model',
          loaded_instances: [{ config: { context_length: 2048 } }],
        }],
      });
    }
    chatCalled = true;
    return jsonResponse({ output: [{ type: 'message', content: 'Draft.' }] });
  };
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(
    requestLocalDraftAI({
      settings: { baseUrl: 'http://127.0.0.1:1234', model: 'small-context-model' },
      instructions: 'Draft.',
      input: 'x'.repeat(5000),
    }),
    /too large.*2,048-token loaded context/,
  );
  assert.equal(chatCalled, false);
  assert.equal(estimateLocalPromptTokens('abc', 'def'), 2);
});
