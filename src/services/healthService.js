'use strict';

const db = require('../config/database');
const { getRedisClient } = require('../config/redis');

const CHECK_TIMEOUT_MS = 1000;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function checkDatabase() {
  try {
    await withTimeout(db.raw('select 1'), CHECK_TIMEOUT_MS);
    return 'up';
  } catch {
    return 'down';
  }
}

async function checkRedis() {
  try {
    const reply = await withTimeout(getRedisClient().ping(), CHECK_TIMEOUT_MS);
    return reply === 'PONG' ? 'up' : 'down';
  } catch {
    return 'down';
  }
}

/**
 * The DB is required, Redis is optional:
 *   ok       – both up
 *   degraded – DB up, Redis down (API still fully functional, just uncached)
 *   down     – DB down
 */
async function getHealth() {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);

  let status = 'ok';
  if (database !== 'up') {
    status = 'down';
  } else if (redis !== 'up') {
    status = 'degraded';
  }

  return { status, checks: { database, redis }, timestamp: new Date().toISOString() };
}

module.exports = { getHealth };
