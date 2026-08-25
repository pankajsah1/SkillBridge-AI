/**
 * Application input validation.
 *
 * Same shape as every validator in this project: pure functions that take a
 * plain object and return `[{ field, message }]`, plus the two adapters that
 * turn one into Express middleware. Keeping them pure is what lets the
 * verification script exercise them without an HTTP server.
 *
 * THERE IS NO `status` FIELD ON CREATE, AND THAT IS THE POINT. A student who
 * could post `{ status: 'selected' }` would have selected themselves. The create
 * validator rejects the key outright rather than silently dropping it, because a
 * silent drop looks like success to whoever sent it.
 */

import AppError from '../utils/AppError.js';
import {
  APPLICATION_LIMITS,
  APPLICATION_STATUS_VALUES,
  isValidApplicationStatus,
} from '../constants/applications.js';

const isDefined = (value) => value !== undefined && value !== null;

/** Mongo ObjectId, as a 24-character hex string. */
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const isObjectId = (value) => typeof value === 'string' && OBJECT_ID.test(value.trim());

/**
 * POST /applications
 *
 * `opportunityId` is the only required field. A cover note is optional because
 * requiring one would turn "apply" into "write an essay", and the postings this
 * portal carries are internships.
 */
export const validateCreateApplicationInput = (body = {}) => {
  const errors = [];

  if (!isDefined(body.opportunityId) || String(body.opportunityId).trim() === '') {
    errors.push({ field: 'opportunityId', message: 'Choose an opportunity to apply to' });
  } else if (!isObjectId(body.opportunityId)) {
    errors.push({ field: 'opportunityId', message: 'That opportunity id is not valid' });
  }

  if (isDefined(body.coverNote)) {
    if (typeof body.coverNote !== 'string') {
      errors.push({ field: 'coverNote', message: 'Your cover note must be text' });
    } else if (body.coverNote.trim().length > APPLICATION_LIMITS.coverNoteMax) {
      errors.push({
        field: 'coverNote',
        message: `Keep your cover note under ${APPLICATION_LIMITS.coverNoteMax} characters`,
      });
    }
  }

  /* Refused, not ignored — see the note at the top of this file. */
  if (isDefined(body.status)) {
    errors.push({ field: 'status', message: 'An application cannot be created with a status' });
  }

  if (isDefined(body.matchScoreAtApplication)) {
    errors.push({
      field: 'matchScoreAtApplication',
      message: 'The match score is calculated by the portal, not submitted',
    });
  }

  return errors;
};

/**
 * PATCH /applications/:id/status
 *
 * Validates only the *shape* of the request. Whether `applied -> selected` is a
 * legal move, and whether this recruiter owns the posting, are both decided in
 * the service — a validator that knew the current status would have to load the
 * document, and then two layers would be reading the same row.
 */
export const validateStatusUpdateInput = (body = {}) => {
  const errors = [];

  if (!isDefined(body.status) || String(body.status).trim() === '') {
    errors.push({ field: 'status', message: 'Choose a status' });
  } else if (!isValidApplicationStatus(body.status)) {
    errors.push({
      field: 'status',
      message: `Status must be one of: ${APPLICATION_STATUS_VALUES.join(', ')}`,
    });
  }

  if (isDefined(body.note)) {
    if (typeof body.note !== 'string') {
      errors.push({ field: 'note', message: 'Your note must be text' });
    } else if (body.note.trim().length > APPLICATION_LIMITS.statusNoteMax) {
      errors.push({
        field: 'note',
        message: `Keep your note under ${APPLICATION_LIMITS.statusNoteMax} characters`,
      });
    }
  }

  return errors;
};

/**
 * GET /applications/me?status=&opportunityId=
 *
 * Both filters are optional. `opportunityId` is how the apply button on an
 * opportunity page asks "have I already applied to this one?" without needing an
 * endpoint of its own.
 */
export const validateApplicationQueryInput = (query = {}) => {
  const errors = [];

  if (isDefined(query.opportunityId) && query.opportunityId !== '') {
    if (!isObjectId(query.opportunityId)) {
      errors.push({ field: 'opportunityId', message: 'That opportunity id is not valid' });
    }
  }

  if (isDefined(query.status) && query.status !== '') {
    if (!isValidApplicationStatus(query.status)) {
      errors.push({
        field: 'status',
        message: `Status must be one of: ${APPLICATION_STATUS_VALUES.join(', ')}`,
      });
    }
  }

  return errors;
};

/** Identical adapters to every earlier step, so the 400 shape cannot drift. */
const toMiddleware = (validator) => (req, _res, next) => {
  const errors = validator(req.body);

  if (errors.length > 0) {
    return next(AppError.badRequest('Validation failed', errors));
  }

  return next();
};

const toQueryMiddleware = (validator) => (req, _res, next) => {
  const errors = validator(req.query);

  if (errors.length > 0) {
    return next(AppError.badRequest('Validation failed', errors));
  }

  return next();
};

export const validateCreateApplication = toMiddleware(validateCreateApplicationInput);
export const validateStatusUpdate = toMiddleware(validateStatusUpdateInput);
export const validateApplicationQuery = toQueryMiddleware(validateApplicationQueryInput);

export default {
  validateCreateApplication,
  validateStatusUpdate,
  validateApplicationQuery,
};
