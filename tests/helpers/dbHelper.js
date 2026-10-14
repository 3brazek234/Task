'use strict';

// Import the shared knex singleton
const db = require('../../src/config/database');

/**
 * Truncates tables between tests to ensure isolation.
 * Uses RESTART IDENTITY CASCADE to reset sequences too.
 */
async function truncateTables(...tables) {
  for (const table of tables) {
    await db.raw(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
  }
}

module.exports = { truncateTables, db };
