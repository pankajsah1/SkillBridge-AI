/**
 * Auth endpoint client.
 *
 * Follows the health.api.js pattern: unwrap the server's
 * `{ success, message, data }` envelope and return just `data`, so components
 * never touch axios response internals.
 *
 * Errors are left to propagate — axiosInstance has already normalised them into
 * `{ status, message, errors, isNetworkError }`.
 */

import axiosInstance from './axiosInstance.js';

/**
 * POST /auth/register
 * @param {{name: string, email: string, password: string, role: string}} payload
 * @returns {Promise<{user: object, token: string}>}
 */
export const register = async (payload) => {
  const response = await axiosInstance.post('/auth/register', payload);
  return response.data.data;
};

/**
 * POST /auth/login
 * @param {{email: string, password: string}} credentials
 * @returns {Promise<{user: object, token: string}>}
 */
export const login = async (credentials) => {
  const response = await axiosInstance.post('/auth/login', credentials);
  return response.data.data;
};

/**
 * GET /auth/me — requires a valid token, which the request interceptor attaches.
 * @returns {Promise<object>} the safe user object
 */
export const fetchCurrentUser = async () => {
  const response = await axiosInstance.get('/auth/me');
  return response.data.data.user;
};

/**
 * POST /auth/logout
 *
 * The session actually ends when the client discards its token; this call is the
 * server-side acknowledgement. Failures are deliberately swallowed by the
 * caller — a network error must never trap someone in a logged-in state.
 */
export const logout = async () => {
  const response = await axiosInstance.post('/auth/logout');
  return response.data;
};

export default { register, login, fetchCurrentUser, logout };
