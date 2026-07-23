import { spawn } from 'node:child_process';

const viteArguments = ['node_modules/vite/bin/vite.js', ...process.argv.slice(2)];
const apiArguments = [
  '--env-file-if-exists=.env.local',
  '--env-file-if-exists=.env.vercel.local',
  'scripts/local-api-server.js',
];

const processes = [
  { name: 'web', child: spawn(process.execPath, viteArguments, { stdio: 'inherit' }) },
  { name: 'api', child: spawn(process.execPath, apiArguments, { stdio: 'inherit' }) },
];

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
