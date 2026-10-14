'use strict';

const { createTicket } = require('../services/ticketService');

/**
 * POST /api/tickets
 * Creates a new support ticket.
 */
async function postTicket(req, res, next) {
  try {
    const ticket = await createTicket(req.body);
    return res.status(201).json(ticket);
  } catch (err) {
    return next(err);
  }
}

module.exports = { postTicket };
