/**
 * Health endpoint client.
 *
 * Shows the pattern every later API module follows: unwrap the server's
 * `{ success, message, data }` envelope and return just `data`.
 */

import axiosInstance from './axiosInstance.js';

/**
 * GET /health
 * @returns {Promise<{status: string, environment: string, apiVersion: string,
 *   database: string, databaseConnected: boolean, uptimeSeconds: number,
 *   timestamp: string}>}
 */
export const fetchHealth = async () => {
  const response = await axiosInstance.get('/health');
  return response.data.data;
};

export default fetchHealth;
