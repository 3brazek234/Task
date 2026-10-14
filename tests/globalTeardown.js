'use strict';

/**
 * Jest globalTeardown – runs once in the main process after all test suites.
 *
 * We roll back all migrations so the test DB is clean for the next run.
 */
module.exports = async function () {
  require('dotenv').config();
  process.env.NODE_ENV = 'test';

  const knex = require('knex');
  const knexConfig = require('../knexfile');
  const db = knex(knexConfig.test);

  try {
    await db.migrate.rollback(undefined, true);
    console.log('[globalTeardown] Migrations rolled back');
  } finally {
    await db.destroy();
  }
};
