'use strict';

const db = require('../config/database');

const PG_UNIQUE_VIOLATION = '23505';

const RETURNED_COLUMNS = [
  'id',
  'ticket_number',
  'subject',
  'description',
  'created_at',
  'updated_at',
];

/**
 * Creates a new ticket.
 *
 * Uniqueness is enforced by the DB constraint alone: a pre-SELECT would cost
 * an extra round-trip and still could not prevent two concurrent inserts.
 *
 * @param {{ ticket_number: number, subject: string, description: string }} data
 * @returns {Promise<object>} The created ticket row
 * @throws {Error & { status: 409 }} if ticket_number already exists
 */
async function createTicket({ ticket_number, subject, description }) {
  try {
    // Explicit column list: never pass the raw body to insert() (mass assignment)
    const [ticket] = await db('tickets')
      .insert({ ticket_number, subject, description })
      .returning(RETURNED_COLUMNS);
    return ticket;
  } catch (dbErr) {
    if (dbErr.code === PG_UNIQUE_VIOLATION) {
      const message = `Ticket number ${ticket_number} already exists`;
      const err = new Error(message);
      err.status = 409;
      err.details = [{ field: 'ticket_number', message }];
      throw err;
    }
    throw dbErr;
  }
}

module.exports = { createTicket };
