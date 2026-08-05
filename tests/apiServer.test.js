import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createApiServer } from '../server/apiServer.js';

async function withApiServer(run) {
  const server = createApiServer({
    logger: { log() {}, error() {} },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('portable API server exposes Cloud Run health information', async () => {
  await withApiServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: 'ok',
      service: 'secretariat-workflow-manager-api',
    });
  });
});

test('portable API readiness fails closed when its database is not configured', async () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    await withApiServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/readiness`);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        status: 'not_ready',
        code: 'database_not_configured',
      });
    });
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});

test('portable API server retains local CORS and protected AI status', async () => {
  await withApiServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/ai/status?workspaceId=workspace-1`, {
      headers: { Origin: 'http://127.0.0.1:5173' },
    });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173');
    assert.equal((await response.json()).code, 'authentication_required');
  });
});

test('portable API server rejects malformed JSON before invoking AI', async () => {
  await withApiServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"unfinished":',
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'Request body must contain valid JSON.',
    });
  });
});
