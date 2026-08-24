/**
 * Authentication business logic.
 *
 * TRD.md section 43 is explicit that controllers must not hold business logic,
 * so the rules live here and the controller only translates HTTP.
 */

import AppError from '../utils/AppError.js';
import { signToken } from '../utils/jwt.js';
import User from '../models/User.js';

/** Builds the `{ user, token }` payload both register and login return. */
const issueSession = (user) => ({
  user: user.toSafeObject(),
  token: signToken({ userId: user._id.toString(), role: user.role }),
});

/**
 * Registers a new user and immediately signs them in.
 *
 * Follows TRD.md section 6.1: validate -> check existing email -> hash ->
 * create -> generate JWT -> return user + token. Validation already happened in
 * middleware; hashing happens in the model's pre-save hook.
 */
export const registerUser = async ({ name, email, password, role }) => {
  const normalisedEmail = email.trim().toLowerCase();

  /**
   * Pre-check for a friendly 409. The unique index is still the real guarantee
   * — two simultaneous requests can both pass this check, and the loser hits a
   * duplicate-key error. errorMiddleware already maps code 11000 to a 409, so
   * that race produces the correct status either way.
   */
  const existing = await User.findOne({ email: normalisedEmail });
  if (existing) {
    throw AppError.conflict('An account with this email address already exists.', [
      { field: 'email', message: 'This email address is already registered.' },
    ]);
  }

  const user = await User.create({
    name: name.trim(),
    email: normalisedEmail,
    password, // hashed by the pre-save hook
    role,
  });

  return issueSession(user);
};

/**
 * Authenticates an email/password pair.
 *
 * Both "no such user" and "wrong password" return the same message. Different
 * messages would turn this endpoint into an account enumerator: an attacker
 * could learn which email addresses are registered without ever guessing a
 * password. RULES.md and the step requirements both call for not leaking this.
 */
export const loginUser = async ({ email, password }) => {
  const normalisedEmail = email.trim().toLowerCase();

  // `.select('+password')` opts back into the field the schema hides.
  const user = await User.findOne({ email: normalisedEmail }).select('+password');

  const invalidCredentials = () =>
    AppError.unauthorized('Invalid email or password.');

  if (!user) {
    throw invalidCredentials();
  }

  const passwordMatches = await user.comparePassword(password);
  if (!passwordMatches) {
    throw invalidCredentials();
  }

  /**
   * Checked after the password, on purpose. Confirming "this account is
   * deactivated" to someone who has not proven the password would reveal that
   * the account exists.
   */
  if (!user.isActive) {
    throw AppError.forbidden(
      'This account has been deactivated. Please contact support.',
    );
  }

  return issueSession(user);
};

/**
 * Loads the current user for GET /auth/me.
 *
 * authenticate has already verified the token and attached req.user, so this
 * exists for handlers that want a guaranteed-fresh read.
 */
export const getAuthenticatedUser = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw AppError.unauthorized('This account no longer exists.');
  }

  return user.toSafeObject();
};

export default { registerUser, loginUser, getAuthenticatedUser };
