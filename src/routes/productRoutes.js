'use strict';

const { Router } = require('express');
const { getProducts } = require('../controllers/productController');

const router = Router();

/**
 * GET /api/products
 */
router.get('/', getProducts);

module.exports = router;
