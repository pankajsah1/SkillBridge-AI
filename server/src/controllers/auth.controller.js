/**
 * Auth controller — HTTP translation only.
 *
 * Reads the request, delegates to the service, formats the response with the
 * Step 1 helpers. No business logic and no try/catch: asyncHandler forwards
 * rejections to errorMiddleware, which owns every error response shape.
 */

import asyncHandler from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import {
  getAuthenticatedUser,
  loginUser,
  registerUser,
} from '../services/auth.service.js';

/**
 * POST /api/v1/auth/register
 *
 * 201 with `{ user, token }`. Only the four fields are passed through —
 * spreading req.body would let a caller set isActive or role freely.
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  const result = await registerUser({ name, email, password, role });

  return sendCreated(res, {
    message: 'Account created successfully.',
    data: result,
  });
});

/** POST /api/v1/auth/login -> 200 with `{ user, token }`. */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const result = await loginUser({ email, password });

  return sendSuccess(res, {
    message: 'Logged in successfully.',
    data: result,
  });
});

/** GET /api/v1/auth/me -> 200 with the authenticated user. Requires a JWT. */
export const getMe = asyncHandler(async (req, res) => {
  const user = await getAuthenticatedUser(req.user.id);

  return sendSuccess(res, {
    message: 'Authenticated user retrieved successfully.',
    data: { user },
  });
});

/**
 * POST /api/v1/auth/logout
 *
 * Listed in TRD.md section 27, so it exists — but be clear about what it does.
 * Our JWTs are stateless: nothing on the server tracks issued tokens, so the
 * server cannot truly revoke one. The client discarding its stored token is
 * what ends the session; this endpoint is the acknowledgement, and a hook for
 * real invalidation (a token blocklist or per-user token version) if that is
 * ever needed.
 *
 * Requires authentication so it cannot be used to probe anything.
 */
export const logout = asyncHandler(async (_req, res) =>
  sendSuccess(res, {
    message: 'Logged out successfully.',
    data: null,
  }),
);

export default { register, login, getMe, logout };
