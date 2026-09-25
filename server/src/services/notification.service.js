/**
 * notification.service.js — derive, list, and read user-scoped notifications.
 *
 * THE DESIGN IN ONE SENTENCE (Step 10 §7): notifications are MATERIALISED from state
 * the platform already stores, not emitted by instrumenting mutations — so this
 * feature was added without touching application, learning, matching or analytics
 * code, and re-deriving is always idempotent.
 *
 * `syncNotificationsForUser` reads the caller's own real state — their application
 * status history, their completed enrolments, the applications on their postings, or
 * their institution's priority actions — turns each into a notification "spec" with a
 * deterministic `dedupeKey`, and upserts them with `$setOnInsert`. The unique index
 * on `{ userId, dedupeKey }` makes duplication impossible and `$setOnInsert` means a
 * row's `read` flag, written once at creation, survives every later sync.
 *
 * EVERYTHING IS SCOPED TO ONE USER. Every query filters on the authenticated id, and
 * mark-as-read matches `{ _id, userId }`, so cross-user access is unexpressible
 * rather than merely rejected (§10 notification isolation).
 *
 * THE SYNC RUNS ON LIST, NOT ON COUNT. `unreadCount` — the value a UI polls — only
 * counts existing rows and never triggers derivation, so polling stays cheap (§15).
 * Derivation happens when a user actually opens their feed.
 */

import mongoose from 'mongoose';

import Notification from '../models/Notification.js';
import Application from '../models/Application.js';
import LearningEnrollment from '../models/LearningEnrollment.js';
import Opportunity from '../models/Opportunity.js';
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_PAGE,
} from '../constants/notifications.js';
import {
  APPLICATION_STATUSES,
  statusLabel,
} from '../constants/applications.js';
import { ENROLLMENT_STATUSES } from '../constants/learning.js';
import ROLES, { isApplicantRole } from '../constants/roles.js';
import { getInstitutionIntelligence } from './institutionIntelligence.service.js';

/** Never derive more than this many rows in one sync — a hard bound on cost. */
const SYNC_CAP = 100;

const resolvePaging = ({ page, limit } = {}) => {
  const resolvedPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const requested = Number.parseInt(limit, 10) || NOTIFICATION_PAGE.defaultLimit;
  const resolvedLimit = Math.min(Math.max(1, requested), NOTIFICATION_PAGE.maxLimit);
  return { page: resolvedPage, limit: resolvedLimit, skip: (resolvedPage - 1) * resolvedLimit };
};

/* --------------------------------------------------------- spec builders */

const titleOf = (opp) => opp?.title ?? 'an opportunity';

/**
 * Applicant specs (STUDENT, ACADEMICIAN): every status their applications have
 * reached beyond "applied", plus every programme they have completed.
 */
const applicantSpecs = async (userId) => {
  const [applications, completed] = await Promise.all([
    Application.find({ studentId: userId })
      .select('opportunityId status statusHistory appliedAt')
      .populate('opportunityId', 'title'),
    LearningEnrollment.find({ learnerId: userId, status: ENROLLMENT_STATUSES.COMPLETED })
      .select('programId completedAt updatedAt')
      .populate('programId', 'title'),
  ]);

  const specs = [];

  for (const app of applications) {
    const oppTitle = titleOf(app.opportunityId);
    const seen = new Set();
    for (const entry of app.statusHistory ?? []) {
      if (entry.status === APPLICATION_STATUSES.APPLIED) continue;
      if (seen.has(entry.status)) continue;
      seen.add(entry.status);
      specs.push({
        dedupeKey: `app-status:${app._id}:${entry.status}`,
        type: NOTIFICATION_TYPES.APPLICATION_STATUS,
        title: `Application update: ${oppTitle}`,
        body: `Your application for "${oppTitle}" is now "${statusLabel(entry.status)}".`,
        link: `/applications/${app._id}`,
        createdAt: entry.changedAt ?? app.appliedAt ?? new Date(),
        meta: { applicationId: app._id.toString(), status: entry.status },
      });
    }
  }

  for (const enr of completed) {
    const progTitle = enr.programId?.title ?? 'a learning programme';
    specs.push({
      dedupeKey: `learning-complete:${enr._id}`,
      type: NOTIFICATION_TYPES.LEARNING_COMPLETED,
      title: `Programme completed: ${progTitle}`,
      body: `You completed "${progTitle}". Reassess the skills it covered — reassessment is what turns learning into a higher readiness score.`,
      link: `/learning/enrollments/${enr._id}`,
      createdAt: enr.completedAt ?? enr.updatedAt ?? new Date(),
      meta: { enrollmentId: enr._id.toString() },
    });
  }

  return specs;
};

/** Industry specs: applications that have arrived on the recruiter's own postings. */
const industrySpecs = async (userId) => {
  const postings = await Opportunity.find({ industryId: userId }).select('_id title');
  if (postings.length === 0) return [];

  const titleById = new Map(postings.map((p) => [p._id.toString(), p.title]));

  const applications = await Application.find({
    opportunityId: { $in: postings.map((p) => p._id) },
  })
    .select('opportunityId appliedAt')
    .sort({ appliedAt: -1 })
    .limit(SYNC_CAP);

  return applications.map((app) => {
    const oppTitle = titleById.get(app.opportunityId.toString()) ?? 'your posting';
    return {
      dedupeKey: `app-received:${app._id}`,
      type: NOTIFICATION_TYPES.APPLICATION_RECEIVED,
      title: `New application: ${oppTitle}`,
      body: `A candidate applied to "${oppTitle}". Review them on your applicant list, ranked by match score.`,
      link: '/industry/applications',
      createdAt: app.appliedAt ?? new Date(),
      meta: { applicationId: app._id.toString() },
    };
  });
};

/**
 * Institution specs: the CRITICAL and HIGH priority actions the intelligence layer
 * already computes. Reused verbatim (§4) — this does not recompute a gap, it files
 * the ones the analytics service found as notifications.
 */
const institutionSpecs = async (userId, now) => {
  const intelligence = await getInstitutionIntelligence(userId);
  return (intelligence.actions ?? [])
    .filter((a) => a.priority === 'CRITICAL' || a.priority === 'HIGH')
    .map((a) => ({
      dedupeKey: `inst-action:${a.key}`,
      type: NOTIFICATION_TYPES.INSTITUTION_ACTION,
      title: a.title,
      body: a.detail,
      link: '/institution/intelligence',
      createdAt: now,
      meta: a.metric ?? {},
    }));
};

/**
 * Derives and upserts the caller's notifications. Idempotent: `$setOnInsert` writes
 * each row's content and read state exactly once, so a second run inserts nothing and
 * disturbs no read flags. Returns the number newly created.
 */
export const syncNotificationsForUser = async (user, now = new Date()) => {
  if (!user?.id || !user?.role) return 0;

  let specs = [];
  if (isApplicantRole(user.role)) specs = await applicantSpecs(user.id);
  else if (user.role === ROLES.INDUSTRY) specs = await industrySpecs(user.id);
  else if (user.role === ROLES.INSTITUTION) specs = await institutionSpecs(user.id, now);

  if (specs.length === 0) return 0;

  const bounded = specs.slice(0, SYNC_CAP);

  const ops = bounded.map((spec) => ({
    updateOne: {
      filter: { userId: user.id, dedupeKey: spec.dedupeKey },
      update: {
        $setOnInsert: {
          userId: new mongoose.Types.ObjectId(String(user.id)),
          type: spec.type,
          title: spec.title,
          body: spec.body,
          link: spec.link,
          meta: spec.meta ?? {},
          read: false,
          readAt: null,
          createdAt: spec.createdAt ?? now,
        },
      },
      upsert: true,
    },
  }));

  const result = await Notification.bulkWrite(ops, { ordered: false });
  return result.upsertedCount ?? 0;
};

/* ------------------------------------------------------------ read side */

/**
 * The caller's notifications, newest event first. Scoped to `userId` — there is no
 * parameter that could widen it to another user.
 */
export const listNotifications = async ({ userId, page, limit, unreadOnly = false } = {}) => {
  const paging = resolvePaging({ page, limit });
  const filter = { userId };
  if (unreadOnly) filter.read = false;

  const [docs, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId, read: false }),
  ]);

  return {
    notifications: docs.map((doc) => doc.toView()),
    total,
    unread,
    page: paging.page,
    limit: paging.limit,
  };
};

/** Unread count only — cheap, and what a polling UI calls. No derivation. */
export const unreadCount = async (userId) =>
  Notification.countDocuments({ userId, read: false });

/**
 * Mark one notification read. The filter carries `userId`, so another user's id is a
 * miss, not a match — returned as "not found" by the caller, never a 403 that would
 * confirm the row exists.
 */
export const markRead = async (userId, notificationId) => {
  const doc = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { read: true, readAt: new Date() } },
    { new: true },
  );
  return doc ? doc.toView() : null;
};

/** Mark every unread notification for this user read. Returns the number updated. */
export const markAllRead = async (userId) => {
  const result = await Notification.updateMany(
    { userId, read: false },
    { $set: { read: true, readAt: new Date() } },
  );
  return result.modifiedCount ?? 0;
};

export default {
  syncNotificationsForUser,
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
};

/* Exported for the offline verifier: the pure spec-shaping helpers above are not
 * exported individually because each needs a live query; the sync/list/read surface
 * is the tested boundary, driven against an in-memory store in verify-step10. */
