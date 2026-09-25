/**
 * Notification endpoint client.
 *
 * A thin wrapper over `/notifications`. The server derives the feed from real state on
 * every list call, scopes every row to the signed-in account, and owns read/unread
 * state — this module sends no identity and computes nothing, the same as every other
 * owner-scoped read in this client.
 */

import axiosInstance from './axiosInstance.js';

/**
 * GET /notifications — the caller's feed, newest event first.
 *
 * @param {object} [params] `{ page, limit, unreadOnly }`
 * @returns {Promise<{ notifications: object[], total: number, unread: number, pagination: object }>}
 */
export const fetchNotifications = async ({ page, limit, unreadOnly } = {}) => {
  const response = await axiosInstance.get('/notifications', {
    params: { page, limit, unreadOnly: unreadOnly ? 'true' : undefined },
  });
  return { ...response.data.data, pagination: response.data.pagination };
};

/**
 * GET /notifications/unread-count — the number the bell badge polls. Count only.
 *
 * @returns {Promise<number>}
 */
export const fetchUnreadCount = async () => {
  const response = await axiosInstance.get('/notifications/unread-count');
  return response.data.data.unread;
};

/**
 * PATCH /notifications/:id/read — mark one notification read.
 *
 * @returns {Promise<object>} the updated notification view
 */
export const markNotificationRead = async (id) => {
  const response = await axiosInstance.patch(`/notifications/${id}/read`);
  return response.data.data.notification;
};

/**
 * PATCH /notifications/read-all — mark every unread notification read.
 *
 * @returns {Promise<number>} how many were updated
 */
export const markAllNotificationsRead = async () => {
  const response = await axiosInstance.patch('/notifications/read-all');
  return response.data.data.updated;
};

export default {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
};
