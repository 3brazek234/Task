'use strict';

require('dotenv').config();

/**
 * Application-level configuration.
 *
 * Database connection settings intentionally live in knexfile.js only, because
 * that file is shared with the Knex CLI (migrations / seeds).
 */
function positiveInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

module.exports = Object.freeze({
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: positiveInt(process.env.PORT, 3000),

  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: positiveInt(process.env.REDIS_PORT, 6379),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
  // Max time to wait for any single Redis command before falling back to the DB
  REDIS_COMMAND_TIMEOUT_MS: positiveInt(process.env.REDIS_COMMAND_TIMEOUT_MS, 500),

  CACHE_TTL_SECONDS: positiveInt(process.env.CACHE_TTL_SECONDS, 120),
});
