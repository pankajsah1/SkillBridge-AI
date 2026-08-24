/**
 * Application error class.
 *
 * Any error created through AppError is treated as "operational" — an expected
 * failure we can safely describe to the client (bad input, missing record,
 * insufficient permissions). Anything else that reaches the error middleware is
 * treated as an unexpected bug and reported as a generic 500.
 */

class AppError extends Error {
  /**
   * @param {string} message  Human-readable, safe to send to the client.
   * @param {number} statusCode  HTTP status code.
   * @param {Array<{field: string, message: string}>} [errors]  Field-level details.
   */
  constructor(message, statusCode = 500, errors = []) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  // ---- Convenience constructors for the statuses this API actually uses ----

  /** 400 — malformed request or failed validation. */
  static badRequest(message = 'Bad request', errors = []) {
    return new AppError(message, 400, errors);
  }

  /** 401 — not authenticated (missing or invalid credentials). */
  static unauthorized(message = 'Authentication required') {
    return new AppError(message, 401);
  }

  /** 403 — authenticated but not allowed (RBAC denial). */
  static forbidden(message = 'You do not have permission to perform this action') {
    return new AppError(message, 403);
  }

  /** 404 — resource does not exist. */
  static notFound(message = 'Resource not found') {
    return new AppError(message, 404);
  }

  /**
   * 409 — conflicts with current state, e.g. a duplicate email or application.
   *
   * Takes field errors because a conflict usually points at one specific input,
   * and the form needs to show the message beside that input rather than only as
   * a banner. 401 and 403 deliberately do not, since naming a field there would
   * disclose which half of a credential was wrong.
   */
  static conflict(message = 'Resource already exists', errors = []) {
    return new AppError(message, 409, errors);
  }

  /** 422 — syntactically valid but semantically unprocessable. */
  static unprocessable(message = 'Unprocessable request', errors = []) {
    return new AppError(message, 422, errors);
  }

  /** 500 — unexpected server failure. */
  static internal(message = 'Something went wrong') {
    return new AppError(message, 500);
  }
}

export default AppError;
export { AppError };
