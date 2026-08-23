/**
 * Centralised error handling.
 *
 * `notFoundHandler` catches requests that matched no route.
 * `errorHandler` is the single place where any thrown error becomes a response.
 *
 * Both must be registered LAST in app.js, after all routes.
 */

import AppError from '../utils/AppError.js';
import { isDevelopment } from '../config/env.js';

/** Converts an unmatched request into a 404 AppError. */
export const notFoundHandler = (req, _res, next) => {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

/**
 * Translates known error shapes into clean, predictable API responses.
 * Anything unrecognised is logged in full and reported as a generic 500 so we
 * never leak internals to the client.
 */
// eslint-disable-next-line no-unused-vars -- Express requires the 4-arg signature.
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let errors = err.errors || [];

  // --- Mongoose: schema validation failed ---
  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((detail) => ({
      field: detail.path,
      message: detail.message,
    }));
  }

  // --- Mongoose: malformed ObjectId or wrong type ---
  else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for '${err.path}'`;
    errors = [{ field: err.path, message: `'${err.value}' is not a valid ${err.kind}` }];
  }

  // --- MongoDB: unique index violation ---
  else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    message = `A record with this ${field} already exists`;
    errors = [{ field, message: 'Must be unique' }];
  }

  // --- Body parser: malformed JSON ---
  else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Request body contains invalid JSON';
  }

  // Unexpected (non-operational) errors: log everything, reveal nothing.
  if (!err.isOperational && statusCode === 500) {
    console.error('[error] Unhandled exception:', err);
    message = isDevelopment ? err.message : 'Something went wrong';
  } else {
    console.warn(`[error] ${statusCode} ${req.method} ${req.originalUrl} — ${message}`);
  }

  const body = { success: false, message };

  if (errors.length > 0) body.errors = errors;
  if (isDevelopment && err.stack) body.stack = err.stack;

  return res.status(statusCode).json(body);
};

export default errorHandler;
