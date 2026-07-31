import { startApiServer } from './apiServer.js';

const port = Number(process.env.PORT) || 8080;
const server = startApiServer({ host: '0.0.0.0', port });

function shutdown(signal) {
  console.log(`${signal} received; closing the API server.`);
  server.close((error) => {
    if (error) {
      console.error('API server shutdown failed.', error);
      process.exitCode = 1;
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.on('error', (error) => {
  console.error('Protected API failed to start.', error);
  process.exitCode = 1;
});
