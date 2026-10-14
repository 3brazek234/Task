'use strict';

/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable('products', (table) => {
    table.increments('id').primary();
    table.string('product_code', 100).notNullable().unique();
    table.string('product_title', 255).notNullable();
    table.decimal('product_price', 10, 2).notNullable();
    table.timestamps(true, true); // created_at, updated_at
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('products');
};
