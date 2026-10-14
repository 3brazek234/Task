'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const apiRoutes = require('./routes');
const healthRoutes = require('./routes/healthRoutes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const BODY_LIMIT = '10kb';

const app = express();

// ── Security & utility middleware ─────────────────────────────────────────────
app.use(helmet());
app.use(cors());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Small body limit: the largest legitimate payload (a ticket) is well below it
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

// ── Health check (DB + Redis status) ──────────────────────────────────────────
app.use('/health', healthRoutes);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api', apiRoutes);

// ── 404 catcher ───────────────────────────────────────────────────────────────
app.use(notFound);

// ── Centralised error handler (must be last) ──────────────────────────────────
app.use(errorHandler);

module.exports = app;
