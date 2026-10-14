'use strict';

/**
 * Returns an Express middleware that validates req.body against a Joi schema.
 * On failure → 400 with per-field error details.
 *
 * @param {import('joi').Schema} schema
 */
function validate(schema) {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,   // collect ALL errors, not just the first
      stripUnknown: true,  // drop unexpected fields
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.context?.key || null,
        message: d.message,
      }));

      return next({
        status: 400,
        message: 'Validation failed',
        details,
      });
    }

    req.body = value; // replace body with the sanitised/coerced value
    return next();
  };
}

module.exports = validate;
