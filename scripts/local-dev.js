import { spawn } from 'node:child_process';
import { loadEnv } from 'vite';

const rawArguments = process.argv.slice(2);
const forceLocalApi = rawArguments.includes('--local-api');
const viteArguments = [
  'node_modules/vite/bin/vite.js',
  ...rawArguments.filter((argument) => argument !== '--local-api'),
];
const fileEnvironment = loadEnv('development', process.cwd(), '');
const environment = { ...fileEnvironment, ...process.env };
const defaultLocalApiOrigin = `http://127.0.0.1:${Number(environment.LOCAL_API_PORT) || 3000}`;

function localApiOrigin(value) {
  const configured = String(value || '').trim();
  if (!configured) return defaultLocalApiOrigin;
  try {
    const url = new URL(configured);
    return ['127.0.0.1', 'localhost'].includes(url.hostname.toLowerCase())
      ? url.origin
      : '';
  } catch {
    return '';
  }
}

async function hasHealthyApi(origin) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(`${origin}/api/health`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

const configuredApiBase = environment.VITE_API_BASE_URL;
const configuredLocalOrigin = localApiOrigin(configuredApiBase);
const shouldStartLocalApi = forceLocalApi || !String(configuredApiBase || '').trim() || Boolean(configuredLocalOrigin);
const apiOrigin = forceLocalApi
  ? defaultLocalApiOrigin
  : configuredLocalOrigin || defaultLocalApiOrigin;
const childEnvironment = shouldStartLocalApi
  ? { ...process.env, VITE_API_BASE_URL: apiOrigin }
  : process.env;

const processes = [];

function startProcess(name, argumentsList) {
  const child = spawn(process.execPath, argumentsList, {
    stdio: 'inherit',
    env: childEnvironment,
  });
  processes.push({ name, child });
  return child;
}

if (shouldStartLocalApi) {
  if (await hasHealthyApi(apiOrigin)) {
    console.log(`Reusing local protected API at ${apiOrigin}`);
  } else {
    const port = Number(new URL(apiOrigin).port) || 3000;
    childEnvironment.LOCAL_API_PORT = String(port);
    startProcess('api', [
      '--env-file-if-exists=.env.local',
      '--env-file-if-exists=.env.vercel.local',
      'scripts/local-api-server.js',
    ]);
  }
} else {
  console.log(`Using configured hosted API: ${configuredApiBase}`);
}

startProcess('web', viteArguments);

let stopping = false;

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  processes.forEach(({ child }) => {
    if (!child.killed) child.kill();
  });
  process.exitCode = exitCode;
}

processes.forEach(({ name, child }) => {
  child.on('error', (error) => {
    console.error(`Unable to start the local ${name} process.`, error);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    if (stopping) return;
    console.error(`Local ${name} process stopped${signal ? ` (${signal})` : ` with code ${code ?? 1}`}.`);
    stop(code ?? 1);
  });
});

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
