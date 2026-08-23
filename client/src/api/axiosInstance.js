/**
 * Shared axios instance.
 *
 * Every API module imports this rather than calling axios directly, so base
 * URL, timeout and error normalisation are defined exactly once.
 */

import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const axiosInstance = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  // Allows cookie-based auth later without another CORS change.
  withCredentials: true,
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

    return Promise.reject({
      status,
      message: data?.message || 'Request failed',
      errors: data?.errors || [],
      isNetworkError: false,
    });
  },
);

export default axiosInstance;
