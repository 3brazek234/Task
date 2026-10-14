'use strict';

/**
 * Tests for POST /api/tickets
 *
 * Strategy:
 *  - Real PostgreSQL test DB
 *  - Truncate tickets table before each test for isolation
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateTables, db } = require('./helpers/dbHelper');
const { PG_INT_MAX } = require('../src/validators/ticketValidator');

const VALID_TICKET = {
  ticket_number: 1001,
  subject: 'Unable to login',
  description: 'I cannot log in to the application since this morning.',
};

const post = (body) => request(app).post('/api/tickets').send(body);
const hasFieldError = (res, field) => res.body.error.details.some((d) => d.field === field);

beforeEach(async () => {
  await truncateTables('tickets');
});

// ── 1. Success ────────────────────────────────────────────────────────────────
describe('POST /api/tickets – success', () => {
  it('returns 201 with the created ticket', async () => {
    const res = await post(VALID_TICKET);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject(VALID_TICKET);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('created_at');
  });

  it('persists the ticket in the database', async () => {
    await post(VALID_TICKET);

    const row = await db('tickets').where({ ticket_number: VALID_TICKET.ticket_number }).first();
    expect(row).toBeDefined();
    expect(row.subject).toBe(VALID_TICKET.subject);
  });

  it(`accepts the upper bound ticket_number ${PG_INT_MAX}`, async () => {
    const res = await post({ ...VALID_TICKET, ticket_number: PG_INT_MAX });
    expect(res.status).toBe(201);
    expect(res.body.ticket_number).toBe(PG_INT_MAX);
  });

  it('trims subject and description before saving', async () => {
    const res = await post({
      ...VALID_TICKET,
      subject: '   Unable to login  ',
      description: '\n  Details here \t',
    });

    expect(res.status).toBe(201);
    expect(res.body.subject).toBe('Unable to login');
    expect(res.body.description).toBe('Details here');
  });

  it('ignores unknown fields (including id / timestamps)', async () => {
    const res = await post({
      ...VALID_TICKET,
      id: 999,
      created_at: '2000-01-01T00:00:00.000Z',
      priority: 'high',
    });

    expect(res.status).toBe(201);
    expect(res.body.id).not.toBe(999);
    expect(res.body.created_at).not.toBe('2000-01-01T00:00:00.000Z');
    expect(res.body).not.toHaveProperty('priority');
  });
});

// ── 2. Missing fields → 400 ───────────────────────────────────────────────────
describe('POST /api/tickets – missing fields (400)', () => {
  it('returns 400 when ticket_number is missing', async () => {
    const { ticket_number: _tn, ...body } = VALID_TICKET;
    const res = await post(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(hasFieldError(res, 'ticket_number')).toBe(true);
  });

  it('returns 400 when subject is missing', async () => {
    const { subject: _s, ...body } = VALID_TICKET;
    const res = await post(body);

    expect(res.status).toBe(400);
    expect(hasFieldError(res, 'subject')).toBe(true);
  });

  it('returns 400 when description is missing', async () => {
    const { description: _d, ...body } = VALID_TICKET;
    const res = await post(body);

    expect(res.status).toBe(400);
    expect(hasFieldError(res, 'description')).toBe(true);
  });

  it('returns 400 with all field errors when body is empty', async () => {
    const res = await post({});

    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['ticket_number', 'subject', 'description']));
  });

  it.each([
    ['subject', '   '],
    ['description', '\n\t  '],
  ])('returns 400 when %s is whitespace-only', async (field, value) => {
    const res = await post({ ...VALID_TICKET, [field]: value });

    expect(res.status).toBe(400);
    expect(hasFieldError(res, field)).toBe(true);
  });
});

// ── 3. Wrong types / out of range → 400 ───────────────────────────────────────
describe('POST /api/tickets – wrong types (400)', () => {
  it.each([
    ['a non-numeric string', 'not-a-number'],
    ['a numeric string', '123'],
    ['a float (non-integer)', 10.5],
    ['zero', 0],
    ['negative', -1],
    ['oversized (INT max + 1)', PG_INT_MAX + 1],
    ['an unsafe integer', 1e20],
    ['a boolean', true],
    ['null', null],
  ])('returns 400 when ticket_number is %s', async (_label, value) => {
    const res = await post({ ...VALID_TICKET, ticket_number: value });

    expect(res.status).toBe(400);
    expect(hasFieldError(res, 'ticket_number')).toBe(true);
  });

  it('returns 400 when subject exceeds 255 characters', async () => {
    const res = await post({ ...VALID_TICKET, subject: 'A'.repeat(256) });

    expect(res.status).toBe(400);
    expect(hasFieldError(res, 'subject')).toBe(true);
  });

  it('returns 400 when subject / description are not strings', async () => {
    const res = await post({ ...VALID_TICKET, subject: 123, description: { text: 'x' } });

    expect(res.status).toBe(400);
    expect(hasFieldError(res, 'subject')).toBe(true);
    expect(hasFieldError(res, 'description')).toBe(true);
  });

  it('returns 413 when the body exceeds 10kb', async () => {
    const res = await post({ ...VALID_TICKET, description: 'x'.repeat(11 * 1024) });

    expect(res.status).toBe(413);
    expect(res.body.error.message).toEqual(expect.any(String));
  });
});

// ── 4. Duplicate ticket_number → 409 ─────────────────────────────────────────
describe('POST /api/tickets – duplicate (409)', () => {
  it('returns 409 when ticket_number already exists', async () => {
    await post(VALID_TICKET);

    const res = await post({ ...VALID_TICKET, subject: 'Different subject' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/already exists/i);
  });

  it('returns a consistent error format on 409', async () => {
    await post(VALID_TICKET);
    const res = await post(VALID_TICKET);

    expect(res.body).toMatchObject({
      error: {
        message: expect.any(String),
        details: expect.any(Array),
      },
    });
  });

  it('concurrent duplicate POSTs → exactly one 201 and one 409', async () => {
    const responses = await Promise.all([post(VALID_TICKET), post(VALID_TICKET)]);

    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);

    const [{ count }] = await db('tickets')
      .where({ ticket_number: VALID_TICKET.ticket_number })
      .count();
    expect(Number(count)).toBe(1);
  });
});
