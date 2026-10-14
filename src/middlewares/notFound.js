'use strict';

function notFound(req, _res, next) {
  next({
    status: 404,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    details: [],
  });
}

module.exports = notFound;
