'use strict';

/**
 * Centralised error-handling middleware.
 *
 * Normalises every error into:
 *   { "error": { "message": "...", "details": [...] } }
 *
 * 5xx messages are replaced with a generic one so internals (SQL, stack
 * details) never leak to clients; the real error is logged instead.
 * Must be the LAST middleware registered.
 */
function errorHandler(err, _req, res, _next) {
  const status = err.status || err.statusCode || 500;

  if (status >= 500 && process.env.NODE_ENV !== 'test') {
    console.error('[ErrorHandler]', err);
  }

  return res.status(status).json({
    error: {
      message: status >= 500 ? 'Internal Server Error' : err.message,
      details: Array.isArray(err.details) ? err.details : [],
    },
  });
}

module.exports = errorHandler;
