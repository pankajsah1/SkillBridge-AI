/**
 * Notification request validation.
 *
 * Same shape as learning.validator.js: pure functions returning `{ field, message }[]`
 * with thin Express adapters, so the rules stay unit-testable offline and the 400
 * envelope is byte-identical to every earlier step's.
 *
 * ONLY THE LIST QUERY IS VALIDATED HERE. Mark-as-read takes an ObjectId param, which
 * `validateObjectIdParam` already checks in the route, and mark-all-read takes no
 * input at all. There is no notification-creation endpoint to validate — notifications
 * are derived server-side from real state, never posted by a client.
 */

import AppError from '../utils/AppError.js';
import { NOTIFICATION_PAGE } from '../constants/notifications.js';

const isDefined = (value) => value !== undefined && value !== null;

/** An optional positive integer within a ceiling — page and limit both use it. */
const checkOptionalInteger = (value, { field, min, max, label }, errors) => {
  if (!isDefined(value) || value === '') return;

  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    errors.push({ field, message: `${label} must be an integer between ${min} and ${max}.` });
  }
};

export const validateNotificationQueryInput = (query = {}) => {
  const errors = [];

  checkOptionalInteger(query.page, { field: 'page', min: 1, max: 100000, label: 'Page' }, errors);
  checkOptionalInteger(
    query.limit,
    { field: 'limit', min: 1, max: NOTIFICATION_PAGE.maxLimit, label: 'Limit' },
    errors,
  );

  if (isDefined(query.unreadOnly) && !['true', 'false', ''].includes(String(query.unreadOnly))) {
    errors.push({ field: 'unreadOnly', message: 'unreadOnly must be true or false.' });
  }

  return errors;
};

const toQueryMiddleware = (validator) => (req, _res, next) => {
  const errors = validator(req.query);
  if (errors.length > 0) {
    return next(AppError.badRequest('Validation failed', errors));
  }
  return next();
};

export const validateNotificationQuery = toQueryMiddleware(validateNotificationQueryInput);

export default { validateNotificationQuery, validateNotificationQueryInput };
