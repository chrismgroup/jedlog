import { config } from './config.js';
import { createApp } from './app.js';
import { pool } from './db/pool.js';

const server = createApp().listen(config.port, () => {
  console.log(`Jetlog API listening on port ${config.port}`);
});

function shutdown() {
  server.close(() => pool.end().finally(() => process.exit(0)));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
