'use strict';

/**
 * Per-test-file setup (setupFilesAfterEnv). Shares the module registry with
 * the test file, so `db` and the Redis client here are the same instances
 * the app uses.
 *
 *  - Installs an in-memory mock Redis before any test code runs.
 *  - Closes the Knex pool and the Redis client after the file finishes, so
 *    Jest exits on its own (no --forceExit).
 */

const { setRedisClient, disconnectRedis } = require('../src/config/redis');
const db = require('../src/config/database');
const { createMockRedis } = require('./helpers/redisHelper');

setRedisClient(createMockRedis());

afterAll(async () => {
  await disconnectRedis();
  await db.destroy();
});
