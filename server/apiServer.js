import { createServer } from 'node:http';
import generateHandler from '../api/ai/generate.js';
import statusHandler from '../api/ai/status.js';
import dailyHandler from '../api/cron/daily.js';

const DEFAULT_MAX_BODY_BYTES = 2 * 1024 * 1024;

const handlers = new Map([
  ['/api/ai/generate', generateHandler],
  ['/api/ai/status', statusHandler],
  ['/api/cron/daily', dailyHandler],
]);

function responseAdapter(response) {
  response.status = (statusCode) => {
    response.statusCode = statusCode;
    return response;
  };
  response.json = (payload) => {
    if (!response.headersSent) {
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    response.end(JSON.stringify(payload));
  };
  return response;
}

async function readJsonBody(request, maxBodyBytes) {
  if (!['POST', 'PUT', 'PATCH'].includes(request.method)) return undefined;
  const declaredLength = Number(request.headers['content-length']) || 0;
  if (declaredLength > maxBodyBytes) {
    request.resume();
    throw Object.assign(new Error('Request body is too large.'), { status: 413 });
  }

  const chunks = [];
  let receivedBytes = 0;
  let tooLarge = false;
  for await (const chunk of request) {
    receivedBytes += chunk.length;
    if (receivedBytes > maxBodyBytes) {
      tooLarge = true;
      continue;
    }
    chunks.push(chunk);
  }
  if (tooLarge) {
    throw Object.assign(new Error('Request body is too large.'), { status: 413 });
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Request body must contain valid JSON.'), { status: 400 });
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

export function createApiServer({
  logger = console,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
} = {}) {
  return createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

    if (url.pathname === '/' || url.pathname === '/api/health') {
      sendJson(response, 200, {
        status: 'ok',
        service: 'secretariat-workflow-manager-api',
      });
      return;
    }

    const handler = handlers.get(url.pathname);
    if (!handler) {
      sendJson(response, 404, { error: 'Not found' });
      return;
    }

    try {
      request.query = Object.fromEntries(url.searchParams);
      request.body = await readJsonBody(request, maxBodyBytes);
      await handler(request, responseAdapter(response));
    } catch (error) {
      logger.error('API request failed.', {
        method: request.method,
        path: url.pathname,
        status: Number(error.status) || 500,
        message: error.message,
      });
      if (!response.headersSent) {
        sendJson(response, Number(error.status) || 500, {
          error: Number(error.status) >= 500 ? 'API request failed.' : error.message,
        });
      } else if (!response.writableEnded) {
        response.end();
      }
    }
  });
}

export function startApiServer({
  host = '127.0.0.1',
  port = 3000,
  logger = console,
} = {}) {
  const server = createApiServer({ logger });
  server.listen(port, host, () => {
    logger.log(`Protected API listening at http://${host}:${port}`);
  });
  return server;
}
