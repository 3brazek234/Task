'use strict';

/**
 * Tests for GET /health
 */

const request = require('supertest');
const app = require('../src/app');
const { createMockRedis, createBrokenRedis, setRedisClient } = require('./helpers/redisHelper');

describe('GET /health', () => {
  it('returns 200 "ok" when DB and Redis are up', async () => {
    setRedisClient(createMockRedis());

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      checks: { database: 'up', redis: 'up' },
      timestamp: expect.any(String),
    });
  });

  it('returns 200 "degraded" when Redis is down (API still works)', async () => {
    setRedisClient(createBrokenRedis());

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'degraded',
      checks: { database: 'up', redis: 'down' },
    });
  });
});
