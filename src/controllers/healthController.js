'use strict';

const { getHealth } = require('../services/healthService');

/**
 * GET /health
 * 200 when the DB is reachable (even if Redis is down), 503 otherwise.
 */
async function healthCheck(_req, res, next) {
  try {
    const health = await getHealth();
    return res.status(health.status === 'down' ? 503 : 200).json(health);
  } catch (err) {
    return next(err);
  }
}

module.exports = { healthCheck };
