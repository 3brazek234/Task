'use strict';

/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable('tickets', (table) => {
    table.increments('id').primary();
    table.integer('ticket_number').notNullable().unique();
    table.string('subject', 255).notNullable();
    table.text('description').notNullable();
    table.timestamps(true, true); // created_at, updated_at
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('tickets');
};
