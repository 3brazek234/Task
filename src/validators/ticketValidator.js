'use strict';

const Joi = require('joi');

// Upper bound of a Postgres INTEGER column
const PG_INT_MAX = 2147483647;
const RANGE_MESSAGE = `"ticket_number" must be an integer between 1 and ${PG_INT_MAX}`;

const createTicketSchema = Joi.object({
  // strict(): only real JSON numbers are accepted, "123" is a type error
  ticket_number: Joi.number().strict().integer().min(1).max(PG_INT_MAX).required().messages({
    'number.base': '"ticket_number" must be an integer',
    'number.integer': '"ticket_number" must be an integer',
    'number.unsafe': RANGE_MESSAGE,
    'number.min': RANGE_MESSAGE,
    'number.max': RANGE_MESSAGE,
    'any.required': '"ticket_number" is required',
  }),
  // trim() runs before the other rules, so whitespace-only becomes "" -> string.empty
  subject: Joi.string().trim().max(255).required().messages({
    'string.base': '"subject" must be a string',
    'string.empty': '"subject" must not be empty',
    'string.max': '"subject" must be at most 255 characters',
    'any.required': '"subject" is required',
  }),
  description: Joi.string().trim().required().messages({
    'string.base': '"description" must be a string',
    'string.empty': '"description" must not be empty',
    'any.required': '"description" is required',
  }),
}).prefs({ abortEarly: false, stripUnknown: true });

module.exports = { createTicketSchema, PG_INT_MAX };
