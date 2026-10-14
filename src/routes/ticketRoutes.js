'use strict';

const { Router } = require('express');
const { postTicket } = require('../controllers/ticketController');
const validate = require('../middlewares/validate');
const { createTicketSchema } = require('../validators/ticketValidator');

const router = Router();

/**
 * POST /api/tickets
 */
router.post('/', validate(createTicketSchema), postTicket);

module.exports = router;
