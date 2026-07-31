import { startApiServer } from '../server/apiServer.js';

const port = Number(process.env.LOCAL_API_PORT) || 3000;
const server = startApiServer({ host: '127.0.0.1', port });

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Local API port ${port} is already in use. Stop the other process or set LOCAL_API_PORT to another port.`);
  } else {
    console.error('Local protected API failed to start.', error);
  }
  process.exitCode = 1;
});
