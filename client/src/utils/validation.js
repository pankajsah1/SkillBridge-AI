/**
 * Client-side form validation.
 *
 * This is a UX convenience only: it catches obvious mistakes before a network
 * round trip and puts the message next to the field. It is NOT a security
 * control. Anyone can skip it entirely by calling the API directly, which is
 * why server/src/validators/auth.validator.js re-checks every rule.
 *
 * Rules are kept deliberately identical to the server's so the two never
 * disagree in front of the user. If you change one, change both.
 */

import { ROLES } from '../constants/roles.js';

export const NAME_MIN = 2;
export const NAME_MAX = 100;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/**
 * Same pattern as the server. Deliberately permissive — the only reliable proof
 * that an address works is sending mail to it, so this catches typos rather
 * than trying to enforce RFC 5322.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Shown under the password field so the rule is stated before it is enforced. */
export const PASSWORD_HINT = `At least ${PASSWORD_MIN} characters, including a letter and a number.`;

const validateName = (value) => {
  const name = (value || '').trim();

  if (!name) return 'Name is required.';
  if (name.length < NAME_MIN) return `Name must be at least ${NAME_MIN} characters.`;
  if (name.length > NAME_MAX) return `Name must be at most ${NAME_MAX} characters.`;

  return null;
};

const validateEmail = (value) => {
  const email = (value || '').trim();

  if (!email) return 'Email is required.';
  if (!EMAIL_PATTERN.test(email)) return 'Enter a valid email address.';

  return null;
};

/**
 * Never trims the password — leading and trailing spaces are legitimate
 * characters, and silently stripping them here would make a password that works
 * on one form fail on another.
 */
const validatePassword = (value) => {
  const password = value || '';

  if (!password) return 'Password is required.';
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Password must be at most ${PASSWORD_MAX} characters.`;
  if (!/[a-zA-Z]/.test(password)) return 'Password must include at least one letter.';
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.';

  return null;
};

const validateRegistrationRole = (value) => {
  if (!value) return 'Select the role that describes you.';

  // The form only offers four roles, so this only fires if the DOM is tampered
  // with. The server rejects it regardless — that is the real barrier.
  if (value === ROLES.ADMIN) return 'This role cannot be selected during registration.';
  if (!Object.values(ROLES).includes(value)) return 'Select a valid role.';

  return null;
};

/**
 * @returns {Record<string, string>} field name -> message. Empty object = valid.
 */
export const validateRegisterForm = ({ name, email, password, confirmPassword, role }) => {
  const errors = {};

  const nameError = validateName(name);
  if (nameError) errors.name = nameError;

  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;

  const passwordError = validatePassword(password);
  if (passwordError) errors.password = passwordError;

  const roleError = validateRegistrationRole(role);
  if (roleError) errors.role = roleError;

  // Frontend-only field: the API takes a single password, so there is nothing
  // for the server to mirror here.
  if (!confirmPassword) {
    errors.confirmPassword = 'Confirm your password.';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
};

/**
 * Login checks presence and email shape only.
 *
 * It must NOT apply the password strength rules: telling someone their entered
 * password "is too short" during login leaks that it cannot be the stored one,
 * and it would lock out any account created before a rule changed.
 */
export const validateLoginForm = ({ email, password }) => {
  const errors = {};

  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;

  if (!password) errors.password = 'Password is required.';

  return errors;
};

/** True when validate*Form returned no messages. */
export const isValid = (errors) => Object.keys(errors).length === 0;

/**
 * Maps the server's `errors: [{ field, message }]` array onto the same shape the
 * local validators produce, so backend and frontend messages render identically.
 */
export const mapServerErrors = (serverErrors = []) =>
  serverErrors.reduce((accumulator, item) => {
    if (item?.field && item?.message && !accumulator[item.field]) {
      accumulator[item.field] = item.message;
    }
    return accumulator;
  }, {});

export default { validateRegisterForm, validateLoginForm, isValid, mapServerErrors };
