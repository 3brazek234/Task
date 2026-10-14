'use strict';

const db = require('../config/database');
const { getRedisClient } = require('../config/redis');
const env = require('../config/env');

const CACHE_KEY = 'products:list';
const CACHE_TTL_SECONDS = env.CACHE_TTL_SECONDS; // default 120

// Single-flight: while a DB load is in progress, concurrent cache misses in
// this process await the same promise instead of issuing their own query.
let inflight = null;

function warn(message, err) {
  if (process.env.NODE_ENV !== 'test') {
    console.warn(`[ProductService] ${message}:`, err.message);
  }
}

/**
 * pg returns DECIMAL columns as strings to avoid precision loss.
 * decimal(10,2) (max 99,999,999.99) is represented exactly enough by a JS
 * double, so we expose it as a Number.
 */
function toProductDto(row) {
  return {
    product_code: row.product_code,
    product_title: row.product_title,
    product_price: Number(row.product_price),
  };
}

async function readCache(redis) {
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached === null) {
      return null;
    }
    const parsed = JSON.parse(cached);
    // Normalising on read also covers entries written by older versions
    return Array.isArray(parsed) ? parsed.map(toProductDto) : null;
  } catch (err) {
    warn('Redis GET failed', err);
    return null;
  }
}

async function writeCache(redis, products) {
  try {
    await redis.set(CACHE_KEY, JSON.stringify(products), 'EX', CACHE_TTL_SECONDS);
  } catch (err) {
    warn('Redis SET failed', err);
  }
}

async function loadAndCache(redis) {
  const rows = await db('products')
    .select('product_code', 'product_title', 'product_price')
    .orderBy('id');
  const products = rows.map(toProductDto);
  await writeCache(redis, products);
  return products;
}

/**
 * Fetches products using Redis as a look-aside cache.
 *
 * @returns {Promise<{ products: object[], cacheHit: boolean }>}
 */
async function listProducts() {
  const redis = getRedisClient();

  const cached = await readCache(redis);
  if (cached) {
    return { products: cached, cacheHit: true };
  }

  if (!inflight) {
    inflight = loadAndCache(redis).finally(() => {
      inflight = null;
    });
  }

  return { products: await inflight, cacheHit: false };
}

module.exports = { listProducts, CACHE_KEY };
