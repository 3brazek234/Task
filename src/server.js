'use strict';

const app = require('./app');
const env = require('./config/env');
const db = require('./config/database');
const { connectRedis, disconnectRedis } = require('./config/redis');

const SHUTDOWN_TIMEOUT_MS = 10000;

async function start() {
  // Non-fatal: the API works without Redis (uncached)
  await connectRedis();

  const server = app.listen(env.PORT, () => {
    console.log(`[Server] Running on port ${env.PORT} (${env.NODE_ENV})`);
  });

  // ── Graceful shutdown ────────────────────────────────────────────────────
  let shuttingDown = false;

  const shutdown = (signal) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log(`[Server] ${signal} received – shutting down...`);

    // Don't hang forever on keep-alive connections
    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    server.close(async (err) => {
      await Promise.allSettled([disconnectRedis(), db.destroy()]);
      console.log('[Server] Shut down cleanly.');
      process.exit(err ? 1 : 0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
