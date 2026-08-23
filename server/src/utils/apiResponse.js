/**
 * Standard API response envelope.
 *
 * Every successful response looks like:
 *   { "success": true, "message": "...", "data": ... }
 *
 * Paginated responses add a sibling `pagination` block:
 *   { "success": true, "message": "...", "data": [...], "pagination": {...} }
 *
 * Failures are produced by the error middleware and look like:
 *   { "success": false, "message": "...", "errors": [...] }
 *
 * Keeping this in one place means the client can rely on a single shape.
 */

/**
 * Sends a success response.
 *
 * @param {import('express').Response} res
 * @param {object}  options
 * @param {number} [options.statusCode=200]
 * @param {string} [options.message='Success']
 * @param {*}      [options.data=null]
 * @param {object} [options.pagination]  Result of buildPagination().
 */
export const sendSuccess = (
  res,
  { statusCode = 200, message = 'Success', data = null, pagination } = {},
) => {
  const body = { success: true, message, data };

  if (pagination) body.pagination = pagination;

  return res.status(statusCode).json(body);
};

/** 201 helper for resource creation. */
export const sendCreated = (res, { message = 'Created successfully', data = null } = {}) =>
  sendSuccess(res, { statusCode: 201, message, data });

/** 204 helper — no body by definition. */
export const sendNoContent = (res) => res.status(204).send();

/**
 * Builds the pagination block used by list endpoints.
 *
 * @param {object} options
 * @param {number} options.page   1-based current page.
 * @param {number} options.limit  Items per page.
 * @param {number} options.total  Total matching documents.
 */
export const buildPagination = ({ page = 1, limit = 10, total = 0 } = {}) => {
  const currentPage = Math.max(1, Number(page) || 1);
  const perPage = Math.max(1, Number(limit) || 10);
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return {
    page: currentPage,
    limit: perPage,
    total,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
};

/**
 * Sends a failure response. Normally you should `throw` an AppError and let the
 * error middleware format it — this is exported for the few places that need to
 * respond directly.
 */
export const sendError = (
  res,
  { statusCode = 500, message = 'Something went wrong', errors = [] } = {},
) => {
  const body = { success: false, message };

  if (errors.length > 0) body.errors = errors;

  return res.status(statusCode).json(body);
};

export default sendSuccess;
