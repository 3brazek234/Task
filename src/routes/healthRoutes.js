'use strict';

const { Router } = require('express');
const { healthCheck } = require('../controllers/healthController');

const router = Router();

/**
 * GET /health
 */
router.get('/', healthCheck);

module.exports = router;
