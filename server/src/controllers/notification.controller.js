/**
 * notification.controller.js — HTTP translation for the notification feed.
 *
 * Same contract as every other controller: read the request, delegate to
 * notification.service, format with the Step 1 helpers. No business logic, no
 * try/catch, no role checks — `authenticate` in the route owns identity and the
 * identity is always `req.user.id`, never a body, query or param field. That is what
 * makes "user B reads user A's notifications" unexpressible rather than merely
 * rejected: there is no id a caller could supply to widen the scope.
 *
 * Query parameters are destructured individually rather than forwarded as `req.query`,
 * so an unexpected parameter cannot reach a database filter.
 *
 * THE SYNC RUNS ON LIST, NOT ON COUNT. Opening the feed derives the caller's
 * notifications from real state first, then reads them back; the unread-count poll
 * only counts existing rows, so a UI can poll it cheaply without triggering derivation.
 */

import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import { buildPagination, sendSuccess } from '../utils/apiResponse.js';
import {
  syncNotificationsForUser,
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
} from '../services/notification.service.js';

/**
 * GET /api/v1/notifications — the caller's feed, newest event first.
 *
 * Derives fresh notifications from real state, then returns the page. `unreadOnly=true`
 * narrows to unread rows; the response always carries the total unread count so a bell
 * badge stays correct regardless of the current filter.
 */
export const getNotifications = asyncHandler(async (req, res) => {
  await syncNotificationsForUser(req.user);

  const result = await listNotifications({
    userId: req.user.id,
    page: req.query.page,
    limit: req.query.limit,
    unreadOnly: String(req.query.unreadOnly) === 'true',
  });

  return sendSuccess(res, {
    message: 'Notifications retrieved successfully.',
    data: {
      notifications: result.notifications,
      total: result.total,
      unread: result.unread,
    },
    pagination: buildPagination({
      page: result.page,
      limit: result.limit,
      total: result.total,
    }),
  });
});

/**
 * GET /api/v1/notifications/unread-count — the number a polling UI calls.
 *
 * Count only, no derivation, so polling stays cheap.
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const unread = await unreadCount(req.user.id);

  return sendSuccess(res, {
    message: 'Unread notification count retrieved successfully.',
    data: { unread },
  });
});

/**
 * PATCH /api/v1/notifications/:id/read — mark one notification read.
 *
 * The service matches `{ _id, userId }`, so another user's id is a miss returned here
 * as a 404 "not found" — never a 403 that would confirm the row exists.
 */
export const patchRead = asyncHandler(async (req, res) => {
  const notification = await markRead(req.user.id, req.params.id);

  if (!notification) {
    throw AppError.notFound('Notification not found.');
  }

  return sendSuccess(res, {
    message: 'Notification marked as read.',
    data: { notification },
  });
});

/**
 * PATCH /api/v1/notifications/read-all — mark every unread notification read.
 */
export const patchReadAll = asyncHandler(async (req, res) => {
  const updated = await markAllRead(req.user.id);

  return sendSuccess(res, {
    message: 'All notifications marked as read.',
    data: { updated },
  });
});

export default { getNotifications, getUnreadCount, patchRead, patchReadAll };
