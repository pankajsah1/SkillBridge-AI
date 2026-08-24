/**
 * Auth request validation.
 *
 * Hand-rolled rather than pulling in Zod/Joi. TRD.md section 3.1 suggests
 * "Zod or Yup" and section 41 suggests "zod / joi", but the instruction for
 * this step asked for a lightweight approach with no unnecessary new
 * dependencies, and these rules are simple enough that a schema library would
 * be more machinery than the problem needs. If validation grows across many
 * resources later, this is the file to replace with Zod.
 *
 * Each validator is a pure function returning an array of
 * `{ field, message }` — no Express types involved — which makes them directly
 * unit-testable. Thin middleware wrappers at the bottom adapt them to Express.
 *
 * Backend validation is the security boundary. The frontend validates the same
 * rules purely to give faster feedback; it is never trusted.
 */

import AppError from '../utils/AppError.js';
import { PUBLIC_REGISTRATION_ROLES, isValidRole } from '../constants/roles.js';

/** Mirrors the model's pattern. Catches typos, not deliverability. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NAME_MIN = 2;
const NAME_MAX = 100;

/**
 * Password rules. No doc specifies these — TRD.md section 47 says only
 * "Password length" with no number. Chosen: at least 8 characters with a
 * letter and a digit. Long enough to resist trivial guessing, simple enough
 * that demo users are not fighting the form.
 */
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

/** Validates `name`, pushing into the shared error list. */
const checkName = (name, errors) => {
  if (!isNonEmptyString(name)) {
    errors.push({ field: 'name', message: 'Name is required.' });
    return;
  }

  const trimmed = name.trim();
  if (trimmed.length < NAME_MIN) {
    errors.push({ field: 'name', message: `Name must be at least ${NAME_MIN} characters.` });
  } else if (trimmed.length > NAME_MAX) {
    errors.push({ field: 'name', message: `Name cannot exceed ${NAME_MAX} characters.` });
  }
};

const checkEmail = (email, errors) => {
  if (!isNonEmptyString(email)) {
    errors.push({ field: 'email', message: 'Email address is required.' });
    return;
  }

  if (!EMAIL_PATTERN.test(email.trim())) {
    errors.push({ field: 'email', message: 'Please enter a valid email address.' });
  }
};

const checkPassword = (password, errors) => {
  if (!isNonEmptyString(password)) {
    errors.push({ field: 'password', message: 'Password is required.' });
    return;
  }

  // Not trimmed: spaces are legitimate password characters.
  if (password.length < PASSWORD_MIN) {
    errors.push({
      field: 'password',
      message: `Password must be at least ${PASSWORD_MIN} characters.`,
    });
    return;
  }

  if (password.length > PASSWORD_MAX) {
    errors.push({
      field: 'password',
      message: `Password cannot exceed ${PASSWORD_MAX} characters.`,
    });
    return;
  }

  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must include at least one letter and one number.',
    });
  }
};

/**
 * Validates the registration role.
 *
 * Two distinct failures, deliberately given different messages: a role that
 * does not exist is a client bug, whereas ADMIN is a real role being requested
 * where it is not allowed. The second is the security-relevant case — it is
 * what stops anyone from self-registering as an administrator.
 */
const checkRegistrationRole = (role, errors) => {
  if (!isNonEmptyString(role)) {
    errors.push({ field: 'role', message: 'Please select a role.' });
    return;
  }

  if (!isValidRole(role)) {
    errors.push({ field: 'role', message: 'Please select a valid role.' });
    return;
  }

  if (!PUBLIC_REGISTRATION_ROLES.includes(role)) {
    errors.push({
      field: 'role',
      message: 'This role cannot be selected during registration.',
    });
  }
};

/** Pure validator for POST /auth/register. Returns `{ field, message }[]`. */
export const validateRegisterInput = (body = {}) => {
  const errors = [];
  checkName(body.name, errors);
  checkEmail(body.email, errors);
  checkPassword(body.password, errors);
  checkRegistrationRole(body.role, errors);
  return errors;
};

/**
 * Pure validator for POST /auth/login.
 *
 * Only checks that the fields are present — no format or strength rules. If a
 * stored password predates a rule change, the user must still be able to log
 * in, and telling an attacker "that is not a valid email format" leaks nothing
 * useful but does slow down nobody.
 */
export const validateLoginInput = (body = {}) => {
  const errors = [];

  if (!isNonEmptyString(body.email)) {
    errors.push({ field: 'email', message: 'Email address is required.' });
  }
  if (!isNonEmptyString(body.password)) {
    errors.push({ field: 'password', message: 'Password is required.' });
  }

  return errors;
};

/**
 * Turns a pure validator into Express middleware.
 * Throws the standard 400 envelope with field-level detail on failure.
 */
const toMiddleware = (validator) => (req, _res, next) => {
  const errors = validator(req.body);

  if (errors.length > 0) {
    return next(AppError.badRequest('Validation failed', errors));
  }

  return next();
};

export const validateRegister = toMiddleware(validateRegisterInput);
export const validateLogin = toMiddleware(validateLoginInput);

export const PASSWORD_RULES = Object.freeze({
  min: PASSWORD_MIN,
  max: PASSWORD_MAX,
  requiresLetterAndNumber: true,
});
