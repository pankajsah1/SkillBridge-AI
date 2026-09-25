/**
 * Notification — one user-scoped, actionable alert derived from real platform state.
 *
 * NOTIFICATIONS ARE MATERIALISED, NOT INSTRUMENTED (Step 10 §7). Nothing in the
 * existing mutation paths was touched to "emit" a notification. Instead the service
 * DERIVES the notifications that should exist from state the platform already stores
 * — an application's `statusHistory`, a completed `LearningEnrollment`, an
 * application arriving on a posting — and upserts them idempotently. That choice is
 * why Step 10 could add this without editing application, learning or matching code,
 * and why re-running the derivation never duplicates a row or resets its read state.
 *
 * `dedupeKey` IS THE IDEMPOTENCY GUARANTEE, AND IT IS AN INDEX, NOT AN `if`. Every
 * derived notification has a deterministic key — e.g. `app-status:{id}:{status}` —
 * and the unique compound index on `{ userId, dedupeKey }` makes "the same event
 * cannot become two rows" true at the database, not merely usually-true in the
 * service. The sync upserts with `$setOnInsert`, so a row's `read` flag is written
 * once at creation and never overwritten by a later sync.
 *
 * `userId` IS THE ISOLATION BOUNDARY. Every query in the service filters on it, and
 * mark-as-read matches `{ _id, userId }` so one user can never read or flip another
 * user's notification — a foreign id is a 404, the same "does not exist for you"
 * answer an application gets, never a 403 that would confirm the row exists.
 *
 * NO auto `timestamps`. `createdAt` is set explicitly to the EVENT time (the moment
 * the status changed, not the moment the sync ran), so the feed orders by when
 * things actually happened. A sync that runs days late still files each row under
 * its real date.
 */

import mongoose from 'mongoose';

import {
  NOTIFICATION_TYPE_VALUES,
  NOTIFICATION_LIMITS,
} from '../constants/notifications.js';

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'A notification must belong to a user'],
    index: true,
  },

  type: {
    type: String,
    enum: { values: NOTIFICATION_TYPE_VALUES, message: '{VALUE} is not a valid notification type' },
    required: [true, 'A notification must have a type'],
  },

  title: {
    type: String,
    required: [true, 'A notification must have a title'],
    trim: true,
    maxlength: [NOTIFICATION_LIMITS.titleMax, 'Notification title is too long'],
  },

  body: {
    type: String,
    trim: true,
    maxlength: [NOTIFICATION_LIMITS.bodyMax, 'Notification body is too long'],
    default: '',
  },

  /** A relative client path the notification links to, e.g. `/applications/:id`. */
  link: {
    type: String,
    trim: true,
    maxlength: [NOTIFICATION_LIMITS.linkMax, 'Notification link is too long'],
    default: '',
  },

  /** Deterministic per-event key. Unique per user — see the index below. */
  dedupeKey: {
    type: String,
    required: [true, 'A notification must have a dedupe key'],
    trim: true,
    maxlength: [NOTIFICATION_LIMITS.dedupeKeyMax, 'Notification dedupe key is too long'],
  },

  read: { type: Boolean, default: false },
  readAt: { type: Date, default: null },

  /** Small structured payload for the client (ids, counts). Never sensitive data. */
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },

  /** EVENT time, not insert time. Set explicitly by the sync. */
  createdAt: { type: Date, default: Date.now },
});

/**
 * ONE ROW PER EVENT PER USER — enforced by the database, so a re-run of the
 * derivation is a no-op rather than a duplicate.
 */
notificationSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true });

/** The feed query, and the unread-count query, both served by this index. */
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

/** What the client sees. Explicit fields — no id/version leakage, no spread. */
notificationSchema.methods.toView = function toView() {
  return {
    id: this._id.toString(),
    type: this.type,
    title: this.title,
    body: this.body,
    link: this.link,
    read: this.read,
    readAt: this.readAt,
    createdAt: this.createdAt,
    meta: this.meta ?? {},
  };
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
