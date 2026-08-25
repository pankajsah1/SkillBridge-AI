/**
 * Application workflow.
 *
 * THE CREATION ORDER IS THE SPEC, IN ORDER. TRD section 45 lays out six gates —
 * does the opportunity exist, is it active, has the deadline passed, has this
 * student already applied, calculate the match score, create — and this file runs
 * them in exactly that sequence. The order is not cosmetic: scoring before the
 * duplicate check would run the whole matching engine to produce a number for a
 * row that is about to be refused, and every one of those gates returns a
 * different message, so reordering them changes what the student is told.
 *
 * OWNERSHIP IS ENFORCED HERE, NOT IN THE ROUTER. `allowRoles(ROLES.INDUSTRY)`
 * proves the caller is *an* employer; only a query can prove they own the
 * posting whose applicants they are asking for. Every recruiter-facing function
 * below therefore loads the opportunity and checks `isOwnedBy` before it reads a
 * single application. This is the same rule opportunity.service.js follows, for
 * the same reason.
 *
 * THE SCORE IS WRITTEN ONCE. `matchScoreAtApplication` comes from the matching
 * engine at creation time and is never touched again — see the comment on the
 * model. Nothing in this file recomputes a match for an existing application.
 */

import mongoose from 'mongoose';

import Application from '../models/Application.js';
import Opportunity from '../models/Opportunity.js';
import AppError from '../utils/AppError.js';
import {
  APPLICATION_PAGE,
  APPLICATION_STATUSES,
  canTransition,
  isTerminalStatus,
  statusLabel,
} from '../constants/applications.js';
import { AVAILABILITY, availabilityFor } from '../constants/opportunities.js';
import { getMatchForStudent } from './matching.service.js';

/** Mongo's duplicate-key error. The unique index on the model raises it. */
const DUPLICATE_KEY = 11000;

/**
 * Paging, clamped.
 *
 * Local rather than shared with opportunity.service.js on purpose: the two read
 * their bounds from different constants blocks, and importing one service into
 * another to save four lines would couple applications to opportunity paging
 * forever.
 */
const resolvePaging = ({ page, limit } = {}) => {
  const resolvedPage = Math.max(1, Number(page) || 1);
  const requested = Number(limit) || APPLICATION_PAGE.defaultLimit;
  const resolvedLimit = Math.min(Math.max(1, requested), APPLICATION_PAGE.maxLimit);

  return { page: resolvedPage, limit: resolvedLimit, skip: (resolvedPage - 1) * resolvedLimit };
};

/** What a student needs to recognise the posting they applied to. */
const STUDENT_POPULATE = [
  {
    path: 'opportunityId',
    select: 'title type location workMode deadline status industryId',
    populate: { path: 'industryId', select: 'name' },
  },
];

/**
 * What a recruiter needs to identify an applicant.
 *
 * `select` is a whitelist, not a convenience. `password` is `select: false` on
 * the User model so it could not arrive anyway, but naming the two fields we
 * want means a field added to User next month does not silently become visible
 * to every employer.
 */
const RECRUITER_POPULATE = [{ path: 'studentId', select: 'name email' }];

/**
 * Loads a posting and refuses it if it cannot be applied to.
 *
 * This is gates 1-3 of TRD section 45 in one place, because they are one
 * question asked three ways and splitting them would let a caller run two of
 * the three. A draft answers 404 rather than "this is a draft": drafts are
 * invisible to everyone but their owner everywhere else in this API, and
 * confirming one exists here would leak an unpublished posting.
 */
const loadApplicablePosting = async (opportunityId) => {
  const opportunity = await Opportunity.findById(opportunityId);

  if (!opportunity) {
    throw AppError.notFound('That opportunity could not be found.');
  }

  const availability = availabilityFor(opportunity);

  if (availability === AVAILABILITY.DRAFT) {
    throw AppError.notFound('That opportunity could not be found.');
  }

  if (availability === AVAILABILITY.CLOSED) {
    throw AppError.badRequest('This opportunity has been closed and is no longer accepting applications.');
  }

  if (availability === AVAILABILITY.EXPIRED) {
    throw AppError.badRequest('The deadline for this opportunity has passed.');
  }

  return opportunity;
};

/**
 * The fit score to store, or null.
 *
 * WRAPPED, BECAUSE A SCORING FAILURE MUST NOT COST A STUDENT AN APPLICATION.
 * The score is metadata a recruiter finds useful; applying is the thing the
 * student actually came to do. If the matching engine throws, the application is
 * still created and the score is recorded as "not scored", which is honest.
 */
const scoreAtApplication = async ({ studentId, opportunityId }) => {
  try {
    const { match } = await getMatchForStudent({ studentId, opportunityId });
    return typeof match?.matchScore === 'number' ? match.matchScore : null;
  } catch {
    return null;
  }
};

/**
 * POST /applications — gates 1-6 of TRD section 45, in order.
 *
 * @param {{studentId: string, opportunityId: string, coverNote?: string}} input
 * @returns {Promise<object>} the new application, as the student sees it
 */
export const createApplication = async ({ studentId, opportunityId, coverNote = '' } = {}) => {
  /* Gates 1-3: exists, active, deadline not passed. */
  await loadApplicablePosting(opportunityId);

  /* Gate 4: already applied. The friendly half of the duplicate rule — the
     unique index below is the half that cannot be raced. */
  const existing = await Application.findOne({ studentId, opportunityId });

  if (existing) {
    throw AppError.conflict('You have already applied to this opportunity.');
  }

  /* Gate 5: score, once, now. */
  const matchScoreAtApplication = await scoreAtApplication({ studentId, opportunityId });

  /* Gate 6: create. */
  const now = new Date();

  try {
    const created = await Application.create({
      studentId,
      opportunityId,
      matchScoreAtApplication,
      coverNote: typeof coverNote === 'string' ? coverNote.trim() : '',
      status: APPLICATION_STATUSES.APPLIED,
      statusHistory: Application.initialHistory(now),
      appliedAt: now,
    });

    await created.populate(STUDENT_POPULATE);
    return created.toStudentView();
  } catch (error) {
    /* Two submits in the same instant: the loser lands here, and gets told the
       same thing the check above would have told them. */
    if (error?.code === DUPLICATE_KEY) {
      throw AppError.conflict('You have already applied to this opportunity.');
    }

    throw error;
  }
};

/**
 * GET /applications/me — this student's applications, newest first.
 *
 * `opportunityId` narrows it to one row or none, which is how the apply button
 * asks "have I already applied to this?" without an endpoint of its own.
 *
 * @param {{studentId: string, opportunityId?: string, status?: string, page?: number, limit?: number}} input
 * @returns {Promise<{applications: Array<object>, page: number, limit: number, total: number}>}
 */
export const listMyApplications = async ({
  studentId,
  opportunityId,
  status,
  page,
  limit,
} = {}) => {
  const paging = resolvePaging({ page, limit });

  const filter = { studentId };
  if (opportunityId) filter.opportunityId = opportunityId;
  if (status) filter.status = status;

  const [docs, total] = await Promise.all([
    Application.find(filter)
      .sort({ appliedAt: -1 })
      .skip(paging.skip)
      .limit(paging.limit)
      .populate(STUDENT_POPULATE),
    Application.countDocuments(filter),
  ]);

  return {
    applications: docs.map((doc) => doc.toStudentView()),
    page: paging.page,
    limit: paging.limit,
    total,
  };
};

/**
 * GET /applications/:id — one application, scoped to its owner.
 *
 * A student asking for someone else's application gets 404, not 403. 403 would
 * confirm the row exists and belongs to a named other person, which is a fact
 * about a stranger's job search that this endpoint has no business confirming.
 *
 * @returns {Promise<object>}
 */
export const getApplicationForStudent = async ({ studentId, applicationId } = {}) => {
  const application = await Application.findById(applicationId).populate(STUDENT_POPULATE);

  if (!application || !application.isOwnedBy(studentId)) {
    throw AppError.notFound('That application could not be found.');
  }

  return application.toStudentView();
};

/**
 * Confirms this employer owns this posting, and returns it.
 *
 * 403 rather than 404 here: unlike a student's application, a published posting
 * is already public to every signed-in user, so refusing by name leaks nothing
 * and "that isn't yours" is more useful than pretending it does not exist.
 */
const loadOwnedPosting = async ({ opportunityId, ownerId }) => {
  const opportunity = await Opportunity.findById(opportunityId);

  if (!opportunity) {
    throw AppError.notFound('That opportunity could not be found.');
  }

  if (!opportunity.isOwnedBy(ownerId)) {
    throw AppError.forbidden('You can only view applications for your own opportunities.');
  }

  return opportunity;
};

/**
 * GET /opportunities/:id/applications — the applicant list for one posting.
 *
 * Ordered by the snapshot score, best first, with un-scored applications last
 * rather than first — a null score is "we do not know", and unknown should not
 * outrank a measured 40%.
 *
 * @param {{opportunityId: string, ownerId: string, status?: string, page?: number, limit?: number}} input
 * @returns {Promise<{applications: Array<object>, opportunity: object, statusCounts: object, page: number, limit: number, total: number}>}
 */
export const listApplicationsForOpportunity = async ({
  opportunityId,
  ownerId,
  status,
  page,
  limit,
} = {}) => {
  const opportunity = await loadOwnedPosting({ opportunityId, ownerId });
  const paging = resolvePaging({ page, limit });

  const filter = { opportunityId };
  if (status) filter.status = status;

  const [docs, total, grouped] = await Promise.all([
    Application.find(filter)
      .sort({ matchScoreAtApplication: -1, appliedAt: 1 })
      .skip(paging.skip)
      .limit(paging.limit)
      .populate(RECRUITER_POPULATE),
    Application.countDocuments(filter),
    /* Counts are over every application for the posting, not the filtered page —
       the tabs need to say how many are in each status, including the ones the
       current filter is hiding. */
    Application.aggregate([
      { $match: { opportunityId: new mongoose.Types.ObjectId(String(opportunityId)) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const statusCounts = grouped.reduce(
    (counts, row) => ({ ...counts, [row._id]: row.count }),
    {},
  );

  return {
    applications: docs.map((doc) => doc.toRecruiterView()),
    opportunity: {
      id: opportunity._id.toString(),
      title: opportunity.title,
      type: opportunity.type,
      status: opportunity.status,
      deadline: opportunity.deadline,
      openings: opportunity.openings,
    },
    statusCounts,
    page: paging.page,
    limit: paging.limit,
    total,
  };
};

/**
 * PATCH /applications/:id/status — move an application along.
 *
 * Three refusals, each with its own message, because they are three different
 * mistakes: you do not own this posting (403), this application is already
 * finished (400), and that move is not allowed from where it is (400). A single
 * generic "invalid status change" would leave a recruiter guessing which.
 *
 * Re-setting the current status is a no-op rather than an error — a double-click
 * on "Shortlist" is not worth a red banner — and it appends nothing to the
 * history, so the timeline never shows the same step twice.
 *
 * @param {{applicationId: string, ownerId: string, status: string, note?: string}} input
 * @returns {Promise<object>} the updated application, as the recruiter sees it
 */
export const updateApplicationStatus = async ({
  applicationId,
  ownerId,
  status,
  note = '',
} = {}) => {
  const application = await Application.findById(applicationId).populate(RECRUITER_POPULATE);

  if (!application) {
    throw AppError.notFound('That application could not be found.');
  }

  /* Ownership of an application is ownership of the posting it is for. */
  await loadOwnedPosting({ opportunityId: application.opportunityId, ownerId });

  if (application.status === status) {
    return application.toRecruiterView();
  }

  if (isTerminalStatus(application.status)) {
    throw AppError.badRequest(
      `This application is already marked "${statusLabel(application.status)}" and cannot be changed.`,
    );
  }

  if (!canTransition(application.status, status)) {
    throw AppError.badRequest(
      `An application cannot move from "${statusLabel(application.status)}" to "${statusLabel(status)}".`,
    );
  }

  application.status = status;
  application.statusHistory.push({
    status,
    changedAt: new Date(),
    note: typeof note === 'string' ? note.trim() : '',
  });

  await application.save();

  return application.toRecruiterView();
};

/**
 * How many applications a student has, by status.
 *
 * Used by the dashboard card, which wants "2 shortlisted" without pulling the
 * whole list. Phase 8's analytics reads the same shape one level up.
 *
 * @returns {Promise<{total: number, byStatus: object}>}
 */
export const countMyApplications = async (studentId) => {
  const grouped = await Application.aggregate([
    { $match: { studentId: new mongoose.Types.ObjectId(String(studentId)) } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const byStatus = grouped.reduce((counts, row) => ({ ...counts, [row._id]: row.count }), {});
  const total = grouped.reduce((sum, row) => sum + row.count, 0);

  return { total, byStatus };
};

export default {
  createApplication,
  listMyApplications,
  getApplicationForStudent,
  listApplicationsForOpportunity,
  updateApplicationStatus,
  countMyApplications,
};
