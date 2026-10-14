'use strict';

const Redis = require('ioredis');
const env = require('./env');

let client = null;

function createClient() {
  const redis = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    lazyConnect: true,
    // Fail fast: never queue commands while disconnected...
    enableOfflineQueue: false,
    // ...and never wait longer than this for a reply.
    commandTimeout: env.REDIS_COMMAND_TIMEOUT_MS,
    connectTimeout: 2000,
    maxRetriesPerRequest: 1,
    // Keep reconnecting in the background with capped back-off so the cache
    // recovers on its own once Redis is reachable again.
    retryStrategy: (times) => Math.min(times * 500, 5000),
  });

  let lastError = null;

  redis.on('ready', () => {
    lastError = null;
    console.log('[Redis] Ready');
  });

  redis.on('error', (err) => {
    // ECONNREFUSED arrives as an AggregateError with an empty message
    const reason = err.message || err.code || String(err);
    // Log each distinct error once instead of on every reconnect attempt
    if (reason !== lastError) {
      lastError = reason;
      console.warn('[Redis] Error – falling back to DB:', reason);
    }
  });

  return redis;
}

/**
 * Returns the Redis client singleton (created lazily).
 */
function getRedisClient() {
  if (!client) {
    client = createClient();
  }
  return client;
}

/**
 * Attempt to connect on startup. Failures are non-fatal: the app serves from
 * the DB and ioredis keeps retrying in the background.
 */
async function connectRedis() {
  try {
    await getRedisClient().connect();
  } catch (err) {
    console.warn('[Redis] Could not connect on startup:', err.message);
  }
}

/**
 * Close the connection (graceful shutdown and test teardown).
 */
async function disconnectRedis() {
  if (!client) {
    return;
  }
  const current = client;
  client = null;
  try {
    await current.quit();
  } catch {
    if (typeof current.disconnect === 'function') {
      current.disconnect();
    }
  }
}

/**
 * Replace the internal client – used by tests to inject in-memory mocks.
 */
function setRedisClient(newClient) {
  client = newClient;
}

module.exports = { getRedisClient, connectRedis, disconnectRedis, setRedisClient };
