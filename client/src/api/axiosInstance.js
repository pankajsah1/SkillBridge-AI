/**
 * Shared axios instance.
 *
 * Every API module imports this rather than calling axios directly, so base
 * URL, timeout and error normalisation are defined exactly once.
 */

import axios from 'axios';

import { getToken } from '../utils/tokenStorage.js';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const axiosInstance = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  // Allows cookie-based auth later without another CORS change.
  withCredentials: true,
});

/**
 * Endpoints where a 401 is a normal answer rather than an expired session.
 *
 * Without this, a failed login attempt would trigger the global
 * session-expired handler and wipe state mid-form — confusing, and it would
 * hide the real "Invalid email or password." message.
 */
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register'];

const isAuthEndpoint = (url = '') => AUTH_ENDPOINTS.some((path) => url.includes(path));

/**
 * Called when a request fails with 401 outside the auth endpoints, i.e. the
 * stored token is missing, invalid, or expired. AuthContext registers a handler
 * that clears state and sends the user to the login page.
 *
 * Registered via a setter rather than importing AuthContext, which would create
 * a circular dependency (context -> api -> context).
 */
let unauthorizedHandler = null;

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
};

/**
 * Attaches the bearer token to every outgoing request.
 *
 * Reading storage per request (rather than caching at module load) means the
 * very first request after login is already authenticated, with no ordering
 * bug between "token saved" and "instance configured".
 */
axiosInstance.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/**
 * Normalises failures into a predictable shape so components never have to dig
 * through `error.response.data.message` themselves.
 *
 * Rejects with: { status, message, errors, isNetworkError }
 */
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // No response at all — server down, wrong port, CORS, or timeout.
    if (!error.response) {
      return Promise.reject({
        status: 0,
        message:
          'Cannot reach the API. Check that the server is running and VITE_API_URL is correct.',
        errors: [],
        isNetworkError: true,
      });
    }

    const { status, data } = error.response;

    // Expired or rejected session on a protected call — clear auth state once, centrally.
    if (status === 401 && !isAuthEndpoint(error.config?.url) && unauthorizedHandler) {
      unauthorizedHandler();
    }

    return Promise.reject({
      status,
      message: data?.message || 'Request failed',
      errors: data?.errors || [],
      isNetworkError: false,
    });
  },
);

export default axiosInstance;
