'use strict';

/**
 * Tests for GET /api/products
 *
 * Strategy:
 *  - Real PostgreSQL test DB (migrated in globalSetup)
 *  - In-memory mock Redis so tests are fast and hermetic
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateTables, db } = require('./helpers/dbHelper');
const { createMockRedis, createBrokenRedis, setRedisClient } = require('./helpers/redisHelper');
const { listProducts, CACHE_KEY } = require('../src/services/productService');

const SAMPLE_PRODUCTS = [
  { product_code: 'T-001', product_title: 'Test Widget A', product_price: 9.99 },
  { product_code: 'T-002', product_title: 'Test Widget B', product_price: 19.99 },
];

let mockRedis;

beforeEach(async () => {
  await truncateTables('products');
  await db('products').insert(SAMPLE_PRODUCTS);
  mockRedis = createMockRedis();
  setRedisClient(mockRedis);
});

/** Counts SQL queries against the products table while `fn` runs. */
async function countProductQueries(fn) {
  let count = 0;
  const onQuery = (q) => {
    if (/from "products"/i.test(q.sql)) {
      count += 1;
    }
  };
  db.on('query', onQuery);
  try {
    const result = await fn();
    return { count, result };
  } finally {
    db.removeListener('query', onQuery);
  }
}

// ── 1. Response shape ────────────────────────────────────────────────────────
describe('GET /api/products – response shape', () => {
  it('returns 200 with an array', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns ONLY product_code, product_title, product_price fields', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);

    for (const product of res.body) {
      expect(Object.keys(product).sort()).toEqual([
        'product_code',
        'product_price',
        'product_title',
      ]);
    }
  });

  it('does NOT expose id, created_at, updated_at', async () => {
    const res = await request(app).get('/api/products');
    for (const p of res.body) {
      expect(p).not.toHaveProperty('id');
      expect(p).not.toHaveProperty('created_at');
      expect(p).not.toHaveProperty('updated_at');
    }
  });

  it('returns product_price as a Number (MISS and HIT)', async () => {
    const miss = await request(app).get('/api/products');
    const hit = await request(app).get('/api/products');

    for (const res of [miss, hit]) {
      expect(res.body).toEqual([
        { product_code: 'T-001', product_title: 'Test Widget A', product_price: 9.99 },
        { product_code: 'T-002', product_title: 'Test Widget B', product_price: 19.99 },
      ]);
    }
  });
});

// ── 2. Cache MISS on first call, HIT on second ───────────────────────────────
describe('GET /api/products – caching', () => {
  it('first call → X-Cache: MISS', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.headers['x-cache']).toBe('MISS');
  });

  it('second call → X-Cache: HIT without querying the DB', async () => {
    await request(app).get('/api/products'); // prime cache

    const { count, result: res } = await countProductQueries(() =>
      request(app).get('/api/products'),
    );
    expect(res.status).toBe(200);
    expect(res.headers['x-cache']).toBe('HIT');
    expect(count).toBe(0);
  });

  it('HIT response contains the same data as MISS response', async () => {
    const miss = await request(app).get('/api/products');
    const hit = await request(app).get('/api/products');
    expect(hit.body).toEqual(miss.body);
  });

  it('stores the list under products:list with a 120 s TTL', async () => {
    const setSpy = jest.spyOn(mockRedis, 'set');

    await request(app).get('/api/products');

    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith(CACHE_KEY, expect.any(String), 'EX', 120);
  });
});

// ── 3. Cache expiry refreshes data ───────────────────────────────────────────
describe('GET /api/products – cache TTL expiry', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('serves HIT just before 120 s and MISS (fresh data) after expiry', async () => {
    const start = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(start);

    const first = await request(app).get('/api/products');
    expect(first.headers['x-cache']).toBe('MISS');

    clock.mockReturnValue(start + 119 * 1000);
    const beforeExpiry = await request(app).get('/api/products');
    expect(beforeExpiry.headers['x-cache']).toBe('HIT');

    // Change the DB so we can prove the refreshed response comes from the DB
    await db('products').where({ product_code: 'T-001' }).update({ product_price: 1.5 });

    clock.mockReturnValue(start + 121 * 1000);
    const afterExpiry = await request(app).get('/api/products');
    expect(afterExpiry.headers['x-cache']).toBe('MISS');
    expect(afterExpiry.body[0].product_price).toBe(1.5);
  });
});

// ── 4. Single-flight ─────────────────────────────────────────────────────────
describe('productService – single-flight on cache miss', () => {
  it('concurrent cache misses trigger exactly one DB query', async () => {
    const { count, result } = await countProductQueries(() =>
      Promise.all(Array.from({ length: 10 }, () => listProducts())),
    );

    expect(count).toBe(1);
    for (const r of result) {
      expect(r.cacheHit).toBe(false);
      expect(r.products).toHaveLength(SAMPLE_PRODUCTS.length);
    }

    // The shared load populated the cache once
    const next = await listProducts();
    expect(next.cacheHit).toBe(true);
  });

  it('a failed load is not memoised – the next call retries', async () => {
    await db.schema.renameTable('products', 'products_tmp');
    try {
      await expect(listProducts()).rejects.toThrow();
    } finally {
      await db.schema.renameTable('products_tmp', 'products');
    }

    const r = await listProducts();
    expect(r.products).toHaveLength(SAMPLE_PRODUCTS.length);
  });
});

// ── 5. Redis unavailable – graceful fallback to DB ────────────────────────────
describe('GET /api/products – Redis unavailable', () => {
  beforeEach(() => {
    setRedisClient(createBrokenRedis());
  });

  it('returns 200 from DB when Redis is completely down', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(SAMPLE_PRODUCTS.length);
  });

  it('always returns X-Cache: MISS when Redis is down', async () => {
    const first = await request(app).get('/api/products');
    const second = await request(app).get('/api/products');

    expect(first.headers['x-cache']).toBe('MISS');
    expect(second.headers['x-cache']).toBe('MISS');
  });
});
