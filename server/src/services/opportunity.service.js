/**
 * Opportunity business logic.
 *
 * TRD.md section 43: "Do not place all business logic inside controllers." The
 * controllers above this file only translate HTTP; every rule lives here.
 *
 * OWNERSHIP IS STRUCTURAL, NOT CHECKED — the same design as
 * studentProfile.service.js. Every owner-scoped read and write filters on an
 * `ownerId` the caller obtained from `req.user.id`, which authenticate set from a
 * verified token. `industryId` is never taken from a request body, and no
 * function accepts an owner id from the client, so "industry B edits industry A's
 * posting" is not a check that could be forgotten; it is a request that cannot be
 * expressed. That is what his section 3 asks for.
 *
 * REFERENCE VALIDATION HAPPENS HERE. The validator proves a skill id is
 * well-formed; only a database read can prove it points at a real, active
 * catalogue entry. Both throw the same 400 envelope with the same field names, so
 * the client cannot tell the two layers apart and does not need to.
 *
 * EXPIRY IS DERIVED, NEVER STORED. There is no cron job and no `expired` status.
 * A passed deadline is a fact about the clock, so it is computed on read by the
 * model's `availability` virtual and expressed in queries as a deadline
 * comparison. Nothing can drift out of date because nothing is written down.
 */

import AppError from '../utils/AppError.js';
import Opportunity from '../models/Opportunity.js';
import Skill from '../models/Skill.js';
import {
  OPPORTUNITY_PAGE,
  OPPORTUNITY_STATUSES,
  STATUS_TRANSITIONS,
  canTransition,
  hasMeaningfulDuration,
} from '../constants/opportunities.js';
import {
  EDITABLE_OPPORTUNITY_FIELDS,
  normaliseSkillList,
} from '../validators/opportunity.validator.js';

/**
 * Populates the owner and both skill lists so a response carries names, not bare
 * ids — otherwise the client would have to fetch the whole catalogue just to
 * render a tag, or keep a copy of it.
 *
 * `select: 'name'` on the owner is doing real work: it is what keeps the
 * industry's email out of the populated document entirely, so
 * `toPublicObject()` could not leak it even if it tried.
 */
export const POPULATE_REFS = [
  { path: 'industryId', select: 'name' },
  { path: 'requiredSkills.skillId', select: 'name slug category' },
  { path: 'preferredSkills.skillId', select: 'name slug category' },
];

/**
 * Normalises a deadline to the last millisecond of its calendar day.
 *
 * WHY THIS MATTERS. A date input submits "2026-08-25", which parses to midnight.
 * Stored as-is, an opportunity whose deadline is *today* would read as expired
 * from 00:00 onwards — the deadline would effectively be yesterday. Pushing it to
 * 23:59:59.999 makes "the deadline is today" mean what everyone assumes it means,
 * and it means every read is a plain `deadline >= now` comparison with no
 * end-of-day arithmetic sprinkled through the query builder, the virtual and the
 * client. One normalisation at the write boundary instead of three special cases.
 *
 * Uses the UTC date parts because that is what "2026-08-25" parses to, then
 * rebuilds in server-local time so the stored instant falls on the day the
 * employer picked.
 */
const endOfDay = (value) => {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return parsed;

  return new Date(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
    23,
    59,
    59,
    999,
  );
};

/** Escapes a user's search text so "C++" cannot break the query or write a regex. */
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Clamps page/limit into a sane window. TRD.md section 49 requires pagination on lists. */
const resolvePaging = ({ page, limit } = {}) => {
  const resolvedPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const requested = Number.parseInt(limit, 10) || OPPORTUNITY_PAGE.defaultLimit;
  const resolvedLimit = Math.min(Math.max(1, requested), OPPORTUNITY_PAGE.maxLimit);

  return { page: resolvedPage, limit: resolvedLimit, skip: (resolvedPage - 1) * resolvedLimit };
};

/**
 * Proves every referenced skill exists and is still active, in ONE query for both
 * arrays.
 *
 * One query rather than two so a create either validates completely or writes
 * nothing — a payload with one bad id must not leave a half-built document. The
 * `isActive` filter matters for the same reason it does in setCareerGoals: a
 * retired skill must not become newly selectable, even though opportunities that
 * already reference it keep working.
 *
 * Errors name the exact array index, so the form can highlight the offending row
 * rather than saying "something is wrong somewhere".
 */
const assertSkillsExist = async ({ requiredSkills = [], preferredSkills = [] }) => {
  const lists = [
    { field: 'requiredSkills', entries: requiredSkills },
    { field: 'preferredSkills', entries: preferredSkills },
  ];

  const ids = lists.flatMap(({ entries }) => entries.map((entry) => String(entry.skillId)));
  if (ids.length === 0) return;

  const found = await Skill.find({ _id: { $in: ids }, isActive: true }).select('_id');
  const foundIds = new Set(found.map((skill) => skill._id.toString()));

  const errors = lists.flatMap(({ field, entries }) =>
    entries
      .map((entry, index) => ({ index, id: String(entry.skillId) }))
      .filter((entry) => !foundIds.has(entry.id))
      .map((entry) => ({
        field: `${field}[${entry.index}].skillId`,
        message: 'This skill does not exist or is no longer available.',
      })),
  );

  if (errors.length > 0) {
    throw AppError.badRequest('One or more selected skills could not be found.', errors);
  }
};

/**
 * The last line of defence on the required/preferred split, run against the
 * MERGED document rather than the request.
 *
 * The validator can only compare what arrived in one payload. A PATCH sending
 * only `preferredSkills` could still collide with the stored `requiredSkills`,
 * and that is exactly the case this catches. The model repeats the check a third
 * time as a schema-level backstop; this layer exists because it is the one that
 * can name the field in a 400.
 */
const assertNoSkillOverlap = (doc) => {
  const requiredIds = (doc.requiredSkills ?? []).map((entry) => String(entry.skillId?._id ?? entry.skillId));
  const preferredIds = (doc.preferredSkills ?? []).map((entry) => String(entry.skillId?._id ?? entry.skillId));

  const overlap = preferredIds.filter((id) => requiredIds.includes(id));

  if (overlap.length > 0) {
    throw AppError.badRequest('A skill cannot be both required and preferred.', [
      {
        field: 'preferredSkills',
        message: 'This skill is already listed as required. Remove it from one of the two lists.',
      },
    ]);
  }
};

/**
 * Copies only whitelisted fields onto a document.
 *
 * EDITABLE_OPPORTUNITY_FIELDS is the whitelist and it lives in the validator, so
 * the fields that are validated and the fields that are written are the same list
 * by construction. `industryId` is not in it, which is what makes ownership
 * unforgeable rather than merely guarded.
 *
 * `status` is excluded here and handled separately: a status change is a
 * transition with rules, not a field assignment.
 */
const applyWritableFields = (doc, body) => {
  EDITABLE_OPPORTUNITY_FIELDS.filter((field) => field !== 'status' && field in body).forEach(
    (field) => {
      const value = body[field];

      if (field === 'requiredSkills') {
        doc.requiredSkills = normaliseSkillList(value);
        return;
      }

      if (field === 'preferredSkills') {
        doc.preferredSkills = normaliseSkillList(value);
        return;
      }

      if (field === 'deadline') {
        doc.deadline = endOfDay(value);
        return;
      }

      if (field === 'eligibility') {
        // Merge rather than replace: a client sending only `notes` should not
        // silently wipe the branches it never mentioned.
        const current = doc.eligibility ?? {};
        doc.eligibility = {
          branches: value.branches ?? current.branches ?? [],
          minGraduationYear:
            value.minGraduationYear === '' || value.minGraduationYear === null
              ? null
              : value.minGraduationYear ?? current.minGraduationYear ?? null,
          maxGraduationYear:
            value.maxGraduationYear === '' || value.maxGraduationYear === null
              ? null
              : value.maxGraduationYear ?? current.maxGraduationYear ?? null,
          notes: value.notes ?? current.notes ?? '',
        };
        return;
      }

      if (field === 'durationMonths' || field === 'openings') {
        // A cleared HTML number input submits '', which Mongoose would cast to 0
        // — silently turning "I removed the duration" into "zero months".
        doc[field] = value === '' || value === null ? null : Number(value);
        return;
      }

      doc[field] = value;
    },
  );
};

/**
 * Keeps `durationMonths` coherent with `type`.
 *
 * A permanent job has no duration, so the two together are contradictory. The
 * handling splits by intent rather than rejecting both cases:
 *
 *   - both sent in the same request  -> 400. The client is confused and the
 *     message can say exactly why.
 *   - type changed, stale duration left on the stored document -> cleared. The
 *     employer cannot see a duration field for a job, so a 400 here would be an
 *     unfixable dead end; clearing it is the only sane repair.
 */
const reconcileDuration = (doc, body, { typeChanged }) => {
  if (hasMeaningfulDuration(doc.type)) return;

  const sentDuration = 'durationMonths' in body && body.durationMonths !== '' && body.durationMonths !== null;

  if (sentDuration && 'type' in body) {
    throw AppError.badRequest('That opportunity type does not have a duration.', [
      {
        field: 'durationMonths',
        message: 'Only internships, apprenticeships and projects have a duration.',
      },
    ]);
  }

  if (typeChanged || sentDuration) {
    doc.durationMonths = null;
  }
};

/**
 * Applies a status change, or rejects an illegal one.
 *
 * The legal edges live in STATUS_TRANSITIONS, so this function does not decide
 * policy — it enforces it. PATCHing the status a document already has is a no-op
 * rather than an error, because an idempotent request should not fail.
 *
 * REOPENING NEEDS A LIVE DEADLINE. Setting `closed -> active` on a posting whose
 * deadline has passed would produce an "active" opportunity that every reader
 * still sees as expired, and no student would ever be shown it. Rejecting with a
 * message that names the fix is more honest than accepting a change that does
 * nothing visible.
 */
const applyStatusChange = (doc, body, now) => {
  if (!('status' in body)) return;

  const from = doc.status;
  const to = body.status;

  if (from === to) return;

  if (!canTransition(from, to)) {
    const allowed = STATUS_TRANSITIONS[from] ?? [];
    throw AppError.badRequest('That status change is not allowed.', [
      {
        field: 'status',
        message: allowed.length
          ? `A ${from} opportunity can only become ${allowed.join(' or ')}.`
          : `A ${from} opportunity cannot change status.`,
      },
    ]);
  }

  if (to === OPPORTUNITY_STATUSES.ACTIVE) {
    const deadline = 'deadline' in body ? endOfDay(body.deadline) : doc.deadline;

    if (!(deadline instanceof Date) || Number.isNaN(deadline.getTime()) || deadline < now) {
      throw AppError.badRequest('The deadline has already passed.', [
        {
          field: 'deadline',
          message: 'Choose a new deadline before reopening this opportunity.',
        },
      ]);
    }
  }

  doc.status = to;
};

/** Re-reads with populated references — save() leaves fresh subdocuments as bare ids. */
const reload = (id) => Opportunity.findById(id).populate(POPULATE_REFS);

/* ------------------------------------------------------------ industry writes */

/**
 * POST /opportunities
 *
 * `industryId` comes from the authenticated caller and from nowhere else. There
 * is no parameter through which a different owner could be supplied.
 */
export const createOpportunity = async (ownerId, body = {}) => {
  const requiredSkills = normaliseSkillList(body.requiredSkills ?? []);
  const preferredSkills = normaliseSkillList(body.preferredSkills ?? []);

  await assertSkillsExist({ requiredSkills, preferredSkills });

  const opportunity = new Opportunity({ industryId: ownerId });

  applyWritableFields(opportunity, {
    ...body,
    requiredSkills: body.requiredSkills ?? [],
    preferredSkills: body.preferredSkills ?? [],
  });

  reconcileDuration(opportunity, body, { typeChanged: true });
  assertNoSkillOverlap(opportunity);

  if (body.status) opportunity.status = body.status;

  await opportunity.save();

  return (await reload(opportunity._id)).toPublicObject();
};

/**
 * Loads an opportunity the caller owns, or throws.
 *
 * Scoped by owner in the query itself, so the safe path never depends on a
 * comparison further down. The second query runs only on the failure path and
 * exists purely so the message can be accurate:
 *
 *   - someone else's PUBLISHED posting -> 403. Its existence is not a secret;
 *     students browse it. "This belongs to another organisation" is the truth and
 *     is more useful than a misleading "not found".
 *   - someone else's DRAFT, or nothing at all -> 404. An unpublished posting must
 *     not be discoverable by probing ids, so it is indistinguishable from absent.
 */
const requireOwnOpportunity = async (ownerId, id) => {
  const owned = await Opportunity.findOne({ _id: id, industryId: ownerId }).populate(POPULATE_REFS);
  if (owned) return owned;

  const foreign = await Opportunity.findById(id).select('status');

  if (foreign && foreign.status !== OPPORTUNITY_STATUSES.DRAFT) {
    throw AppError.forbidden(
      'This opportunity was posted by another organisation, so you cannot change it.',
    );
  }

  throw AppError.notFound('That opportunity could not be found.');
};

/** GET /opportunities/:id for an owner — see getOpportunityForViewer, which
 * already returns an owner their own drafts. Kept out of the public surface
 * deliberately: two endpoints returning the same document would be the duplicate
 * API his standing rules forbid.
 */

/**
 * PATCH /opportunities/:id
 *
 * Partial by design: absent fields are left alone. Every reference and rule is
 * re-checked against the merged result, not against the patch, because a patch
 * that is individually valid can still produce an invalid document.
 */
export const updateOpportunity = async (ownerId, id, body = {}, now = new Date()) => {
  const opportunity = await requireOwnOpportunity(ownerId, id);
  const typeChanged = 'type' in body && body.type !== opportunity.type;

  if ('requiredSkills' in body || 'preferredSkills' in body) {
    await assertSkillsExist({
      requiredSkills: normaliseSkillList(body.requiredSkills ?? []),
      preferredSkills: normaliseSkillList(body.preferredSkills ?? []),
    });
  }

  applyWritableFields(opportunity, body);
  reconcileDuration(opportunity, body, { typeChanged });
  assertNoSkillOverlap(opportunity);
  applyStatusChange(opportunity, body, now);

  await opportunity.save();

  return (await reload(opportunity._id)).toPublicObject();
};

/**
 * DELETE /opportunities/:id
 *
 * A hard delete, which TRD.md section 31 defines. Safe in this phase precisely
 * because nothing references an opportunity yet. Once applications exist, Step 5
 * will need to reconsider this — deleting a posting people applied to would strand
 * their applications — which is why closing is offered as the softer alternative
 * and the response says so.
 */
export const deleteOpportunity = async (ownerId, id) => {
  const opportunity = await requireOwnOpportunity(ownerId, id);
  await opportunity.deleteOne();

  return { id: String(id) };
};

/* ------------------------------------------------------------- industry reads */

/**
 * Total / active / expired / closed / draft counts for the industry dashboard.
 *
 * "Active" here means genuinely open — status active AND deadline still in the
 * future — because an employer reading "4 active" wants to know how many postings
 * are actually collecting interest, not how many have a status field that says so.
 * Expired is counted separately for the same reason.
 *
 * Five counts rather than an aggregation pipeline: at hackathon scale these are
 * indexed counts, and a `$facet` pipeline would be harder to read and to test
 * offline for no measurable gain.
 */
const summariseOwned = async (ownerId, now = new Date()) => {
  const base = { industryId: ownerId };

  const [total, active, expired, closed, drafts] = await Promise.all([
    Opportunity.countDocuments(base),
    Opportunity.countDocuments({
      ...base,
      status: OPPORTUNITY_STATUSES.ACTIVE,
      deadline: { $gte: now },
    }),
    Opportunity.countDocuments({
      ...base,
      status: OPPORTUNITY_STATUSES.ACTIVE,
      deadline: { $lt: now },
    }),
    Opportunity.countDocuments({ ...base, status: OPPORTUNITY_STATUSES.CLOSED }),
    Opportunity.countDocuments({ ...base, status: OPPORTUNITY_STATUSES.DRAFT }),
  ]);

  return { total, active, expired, closed, drafts };
};

/**
 * GET /industry/opportunities — the caller's own postings.
 *
 * Includes drafts, closed and expired postings: this is a management view, and an
 * owner who cannot see what they closed cannot reopen it. The optional `status`
 * filter narrows it.
 *
 * The summary is computed by the DATABASE over the whole collection, not by
 * counting the current page. Counting a paginated array would report "3
 * opportunities" on page one of thirty, and the dashboard number would silently
 * depend on the page size.
 */
export const listOwnedOpportunities = async (ownerId, query = {}, now = new Date()) => {
  const { page, limit, skip } = resolvePaging(query);

  const filter = { industryId: ownerId };
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;

  if (query.search) {
    filter.title = new RegExp(escapeRegex(query.search), 'i');
  }

  const [docs, total, summary] = await Promise.all([
    Opportunity.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate(POPULATE_REFS),
    Opportunity.countDocuments(filter),
    summariseOwned(ownerId, now),
  ]);

  return {
    opportunities: docs.map((doc) => doc.toPublicObject()),
    total,
    page,
    limit,
    summary,
  };
};

/* -------------------------------------------------------------- student reads */

/**
 * Builds the student browse filter.
 *
 * THE AVAILABILITY RULE, and it is enforced here rather than in the client: only
 * `status: active` with a deadline that has not passed. A student is never shown
 * something they could not act on, per his section 5. Because the deadline is
 * stored as end-of-day, `$gte: now` includes a posting closing today — which is
 * exactly what "the deadline is today" should mean.
 *
 * `search` is a case-insensitive regex across title, description and location
 * rather than a `$text` index, because `$text` only matches whole words: a
 * student typing "front" would get nothing for "Frontend Developer", which is not
 * what a search box may do. Honest about its scale rather than dressed up as
 * search infrastructure.
 */
const buildDiscoveryFilter = ({ type, workMode, location, skills, search } = {}, now) => {
  const filter = {
    status: OPPORTUNITY_STATUSES.ACTIVE,
    deadline: { $gte: now },
  };

  if (type) filter.type = type;
  if (workMode) filter.workMode = workMode;

  if (location) {
    // Substring, so "bengaluru" finds "Bengaluru, India" without a city collection.
    filter.location = new RegExp(escapeRegex(location), 'i');
  }

  if (skills) {
    const ids = String(skills).split(',').map((id) => id.trim()).filter(Boolean);

    if (ids.length > 0) {
      /**
       * Matches an opportunity that wants ANY of the selected skills, in either
       * list. `$in` rather than `$all` because a student filtering by "React,
       * Node" is asking "what can I do with these?", not "what needs all of
       * these at once?" — and `$all` would return almost nothing.
       */
      filter.$or = [
        { 'requiredSkills.skillId': { $in: ids } },
        { 'preferredSkills.skillId': { $in: ids } },
      ];
    }
  }

  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    const searchClause = [{ title: pattern }, { description: pattern }, { location: pattern }];

    /**
     * When a skill filter is already using `$or`, both conditions have to be
     * ANDed explicitly — a second `$or` key would overwrite the first, silently
     * dropping the skill filter. This is the bug that makes combined filters
     * quietly wrong, so the two are nested under `$and` instead.
     */
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchClause }];
      delete filter.$or;
    } else {
      filter.$or = searchClause;
    }
  }

  return filter;
};

/**
 * GET /opportunities — student discovery.
 *
 * Sorted by deadline ascending: the most urgent thing a student could act on
 * comes first, which is more useful than newest-first for a list whose entries
 * all expire. `createdAt` breaks ties so the order is stable across pages.
 *
 * No match score, no personalised ranking, no recommendation logic — his section
 * 5 defers all three, and a "score" computed here would have to be thrown away
 * when the real matching engine arrives.
 */
export const listOpenOpportunities = async (query = {}, now = new Date()) => {
  const { page, limit, skip } = resolvePaging(query);
  const filter = buildDiscoveryFilter(query, now);

  const [docs, total] = await Promise.all([
    Opportunity.find(filter)
      .sort({ deadline: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(POPULATE_REFS),
    Opportunity.countDocuments(filter),
  ]);

  return {
    opportunities: docs.map((doc) => doc.toPublicObject()),
    total,
    page,
    limit,
  };
};

/**
 * GET /opportunities/:id — one opportunity, for any signed-in reader.
 *
 * A CLOSED OR EXPIRED POSTING IS RETURNED, NOT HIDDEN. The browse list excludes
 * them, but a student following a bookmark or a shared link deserves "this closed
 * on 12 August" over a bare 404 that reads as if the page never existed. The
 * `availability` field carries that fact, so the page can say so plainly.
 *
 * A DRAFT IS 404 FOR EVERYONE BUT ITS OWNER. An unpublished posting is not
 * merely hidden from the list — it must be undiscoverable by trying ids, which is
 * why absence and no-permission are deliberately indistinguishable here.
 */
export const getOpportunityForViewer = async (id, viewerId) => {
  const opportunity = await Opportunity.findById(id).populate(POPULATE_REFS);

  if (!opportunity) {
    throw AppError.notFound('That opportunity could not be found.');
  }

  if (
    opportunity.status === OPPORTUNITY_STATUSES.DRAFT &&
    !opportunity.isOwnedBy(viewerId)
  ) {
    throw AppError.notFound('That opportunity could not be found.');
  }

  return opportunity.toPublicObject();
};

export default {
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  listOwnedOpportunities,
  listOpenOpportunities,
  getOpportunityForViewer,
};
