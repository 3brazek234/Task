'use strict';

const { listProducts } = require('../services/productService');

/**
 * GET /api/products
 * Returns all products with cache HIT/MISS header.
 */
async function getProducts(req, res, next) {
  try {
    const { products, cacheHit } = await listProducts();

    res.set('X-Cache', cacheHit ? 'HIT' : 'MISS');
    return res.status(200).json(products);
  } catch (err) {
    return next(err);
  }
}

module.exports = { getProducts };
