/**
 * Notification routes — `${API_PREFIX}/notifications`.
 *
 * The user's own alert feed: list (derives, then reads), unread count (cheap poll),
 * and the two read-state mutations.
 *
 * MIDDLEWARE ORDER IS THE AUTHORIZATION DESIGN, exactly as coach.routes.js:
 * `authenticate -> validateObjectIdParam -> controller`.
 *
 *   authenticate  first, so an anonymous request is 401 not 403.
 *   validate      next, so the controller only sees a well-formed request.
 *
 * NO `allowRoles` HERE — notifications belong to EVERY signed-in role. There is no
 * role that lacks a feed, so the only gate is authentication; the service scopes
 * every query to `req.user.id`, which is the isolation boundary (§10).
 *
 * OWNERSHIP IS NOT IN THIS FILE. Every query is scoped to `req.user.id` inside the
 * service, so there is no id a caller could supply to see or flip someone else's
 * notification. The `:id` param is validated as an ObjectId before the controller
 * runs, so a malformed id is a 400, and a well-formed foreign id is a 404.
 *
 * ROUTE ORDER: the two fixed paths (`/unread-count`, `/read-all`) are declared before
 * the `/:id/read` param route so neither is ever swallowed by the param segment.
 */

import { Router } from 'express';

import { authenticate } from '../middleware/authMiddleware.js';
import {
  getNotifications,
  getUnreadCount,
  patchRead,
  patchReadAll,
} from '../controllers/notification.controller.js';
import { validateNotificationQuery } from '../validators/notification.validator.js';
import { validateObjectIdParam } from '../validators/studentProfile.validator.js';

const notificationRoutes = Router();

notificationRoutes.use(authenticate);

/* The feed. Derives fresh notifications from real state, then returns a page. */
notificationRoutes.get('/', validateNotificationQuery, getNotifications);

/* The cheap poll — count only, no derivation. */
notificationRoutes.get('/unread-count', getUnreadCount);

/* Mark every unread notification read. Fixed path, declared before `/:id/read`. */
notificationRoutes.patch('/read-all', patchReadAll);

/* Mark one notification read — foreign or missing id is a 404, never a 403. */
notificationRoutes.patch('/:id/read', validateObjectIdParam('id'), patchRead);

export default notificationRoutes;
