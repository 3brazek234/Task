'use strict';

const { setRedisClient } = require('../../src/config/redis');

/**
 * In-memory Redis mock supporting get / set (with EX) / del / ping / quit.
 */
function createMockRedis() {
  const store = new Map();

  return {
    _store: store,
    async get(key) {
      const entry = store.get(key);
      if (!entry) {
        return null;
      }
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, ex, ttl) {
      const expiresAt = ex === 'EX' && ttl ? Date.now() + ttl * 1000 : null;
      store.set(key, { value, expiresAt });
      return 'OK';
    },
    async del(key) {
      return store.delete(key) ? 1 : 0;
    },
    async ping() {
      return 'PONG';
    },
    async quit() {
      return 'OK';
    },
  };
}

/**
 * A Redis mock whose every command rejects – simulates Redis being down.
 */
function createBrokenRedis() {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          return undefined; // not a thenable
        }
        if (prop === 'quit') {
          return async () => 'OK';
        }
        return async () => {
          throw new Error('Redis connection refused');
        };
      },
    },
  );
}

module.exports = { createMockRedis, createBrokenRedis, setRedisClient };
