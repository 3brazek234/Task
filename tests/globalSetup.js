'use strict';

/**
 * Jest globalSetup – runs once in the main process before all test suites.
 *
 * We run migrations here so they happen exactly once regardless of
 * how many test files there are.
 */
module.exports = async function () {
  // dotenv must be loaded manually here since globalSetup
  // runs in a separate VM context.
  require('dotenv').config();
  process.env.NODE_ENV = 'test';

  // We need a temporary Knex instance just for migrations.
  const knex = require('knex');
  const knexConfig = require('../knexfile');
  const db = knex(knexConfig.test);

  try {
    await db.migrate.latest();
    console.log('[globalSetup] Migrations complete');
  } finally {
    await db.destroy();
  }
};
