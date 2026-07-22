import { createServer } from 'node:http';
import generateHandler from '../api/ai/generate.js';
import statusHandler from '../api/ai/status.js';

const port = Number(process.env.LOCAL_API_PORT) || 3000;
const handlers = new Map([
  ['/api/ai/generate', generateHandler],
  ['/api/ai/status', statusHandler],
]);

function responseAdapter(response) {
  response.status = (statusCode) => {
    response.statusCode = statusCode;
    return response;
  };
  response.json = (payload) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify(payload));
  };
  return response;
}

async function readBody(request) {
  if (!['POST', 'PUT', 'PATCH'].includes(request.method)) return undefined;
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const handler = handlers.get(url.pathname);
  if (!handler) {
    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  try {
    request.query = Object.fromEntries(url.searchParams);
    request.body = await readBody(request);
    await handler(request, responseAdapter(response));
  } catch (error) {
    console.error('Local API request failed.', error);
    if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    if (!response.writableEnded) response.end(JSON.stringify({ error: 'Local API request failed.' }));
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Local protected API listening at http://127.0.0.1:${port}`);
});
