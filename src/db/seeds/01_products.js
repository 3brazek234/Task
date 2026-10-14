'use strict';

/**
 * Idempotent seed: safe to run on every container start. Existing products
 * (matched by product_code) are left untouched; missing ones are inserted.
 *
 * @param {import('knex').Knex} knex
 */
exports.seed = async function (knex) {
  await knex('products')
    .insert([
      { product_code: 'PROD-001', product_title: 'Wireless Bluetooth Headphones', product_price: 79.99 },
      { product_code: 'PROD-002', product_title: 'Mechanical Keyboard USB-C', product_price: 149.5 },
      { product_code: 'PROD-003', product_title: 'Ergonomic Office Chair', product_price: 349.0 },
      { product_code: 'PROD-004', product_title: '27-inch 4K Monitor', product_price: 499.95 },
      { product_code: 'PROD-005', product_title: 'USB-C Hub 7-in-1', product_price: 44.99 },
      { product_code: 'PROD-006', product_title: 'Laptop Stand Aluminium', product_price: 59.99 },
      { product_code: 'PROD-007', product_title: 'Wireless Charging Pad 15W', product_price: 29.99 },
      { product_code: 'PROD-008', product_title: 'Noise Cancelling Earbuds', product_price: 199.0 },
      { product_code: 'PROD-009', product_title: 'Portable SSD 1TB', product_price: 109.99 },
      { product_code: 'PROD-010', product_title: 'Smart LED Desk Lamp', product_price: 89.95 },
      { product_code: 'PROD-011', product_title: 'Gaming Mouse 16000 DPI', product_price: 69.99 },
      { product_code: 'PROD-012', product_title: 'Webcam 4K Autofocus', product_price: 134.0 },
    ])
    .onConflict('product_code')
    .ignore();
};
