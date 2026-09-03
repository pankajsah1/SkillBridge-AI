/**
 * Learning programme business logic.
 *
 * TRD.md section 43: "Do not place all business logic inside controllers." The
 * controller above this file only translates HTTP; every rule lives here.
 *
 * OWNERSHIP IS STRUCTURAL, NOT CHECKED — the same design as
 * opportunity.service.js and studentProfile.service.js. Every owner-scoped read and
 * write filters on an `ownerId` the caller obtained from `req.user.id`, which
 * `authenticate` set from a verified token. `publisherId` is never taken from a
 * request body and no function here accepts an owner id from the client, so
 * "publisher B edits publisher A's programme" is not a check that could be
 * forgotten; it is a request that cannot be expressed.
 *
 * REFERENCE VALIDATION HAPPENS HERE. The validator proves a skill id is
 * well-formed; only a database read can prove it points at a real, active catalogue
 * entry. Both throw the same 400 envelope with the same field names, so the client
 * cannot tell the two layers apart and does not need to.
 *
 * EXPIRY IS DERIVED, NEVER STORED. There is no cron job and no `ended` status. A
 * passed end date is a fact about the clock, computed on read by the model's
 * `availability` virtual and expressed in queries as a date comparison — with the
 * one difference from Opportunity that matters here: a NULL end date means evergreen,
 * not expired, because a self-paced course genuinely never ends.
 *
 * NOTHING IN THIS FILE WRITES TO StudentProfile. Publishing, editing and archiving a
 * programme cannot move a skill score, by construction: this module imports no
 * profile model. `applySkillScoresToProfile` in assessment.service.js remains the
 * only writer of a measured skill level anywhere in the codebase.
 */

import AppError from '../utils/AppError.js';
import LearningEnrollment from '../models/LearningEnrollment.js';
import LearningProgram from '../models/LearningProgram.js';
import Skill from '../models/Skill.js';
import {
  LEARNING_PAGE,
  LEARNING_PROGRAM_STATUSES,
  LEARNING_PROGRAM_STATUS_TRANSITIONS,
  ENROLLMENT_STATUSES,
  canTransitionProgram,
  programAvailabilityFor,
  PROGRAM_AVAILABILITY,
} from '../constants/learning.js';
import {
  EDITABLE_LEARNING_PROGRAM_FIELDS,
  normalisePrerequisites,
  normaliseSkillIds,
  parseDateInput,
} from '../validators/learning.validator.js';

/**
 * Populates the publisher and the skill catalogue entries so a response carries
 * names, not bare ids — otherwise the client would have to fetch the whole
 * catalogue to render a tag, or keep a copy of it.
 *
 * `select: 'name'` on the publisher is doing real work: it keeps the publisher's
 * email out of the populated document entirely, so `toPublicObject()` could not leak
 * it even if it tried. A browse list is the easiest surface in the app to scrape.
 */
export const POPULATE_REFS = [
  { path: 'publisherId', select: 'name' },
  { path: 'targetSkills', select: 'name slug category' },
];

/**
 * Normalises an end date to the last millisecond of its calendar day.
 *
 * Same reasoning as `endOfDay` in opportunity.service.js: a date input submits
 * "2026-08-25", and stored as midnight a programme ending *today* would read as
 * ended from 00:00 onwards. Pushing it to 23:59:59.999 makes "it ends today" mean
 * what everyone assumes, and it means every read is a plain `endDate >= now`
 * comparison with no end-of-day arithmetic sprinkled through the query builder, the
 * virtual and the client.
 *
 * Goes through the validator's `parseDateInput` rather than `new Date(value)`, so a
 * date-only string lands on the day the publisher picked in every timezone, not just
 * in ones ahead of UTC.
 */
const endOfDay = (value) => {
  const parsed = parseDateInput(value);
  if (!parsed) return null;

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 23, 59, 59, 999);
};

/** A start date normalised to the first millisecond of its day, for symmetry. */
const startOfDay = (value) => {
  const parsed = parseDateInput(value);
  if (!parsed) return null;

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

/** Escapes a user's search text so "C++" cannot break the query or write a regex. */
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Clamps page/limit into a sane window. TRD.md section 49 requires pagination on lists. */
const resolvePaging = ({ page, limit } = {}) => {
  const resolvedPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const requested = Number.parseInt(limit, 10) || LEARNING_PAGE.defaultLimit;
  const resolvedLimit = Math.min(Math.max(1, requested), LEARNING_PAGE.maxLimit);

  return { page: resolvedPage, limit: resolvedLimit, skip: (resolvedPage - 1) * resolvedLimit };
};

/**
 * Proves every referenced skill exists and is still active, in ONE query.
 *
 * THE SHARED CATALOGUE IS THE WHOLE FEATURE, so this is the check that keeps it
 * shared: a programme pointing at an id no catalogue entry has could never be
 * recommended, and it would render as a blank tag. The `isActive` filter matters for
 * the same reason it does in `setCareerGoals` — a retired skill must not become newly
 * selectable, even though programmes that already reference it keep working.
 *
 * Errors name the exact array index, so the form can highlight the offending row
 * rather than saying "something is wrong somewhere".
 */
const assertSkillsExist = async (skillIds = []) => {
  const ids = skillIds.map((id) => String(id));
  if (ids.length === 0) return;

  const found = await Skill.find({ _id: { $in: ids }, isActive: true }).select('_id');
  const foundIds = new Set(found.map((skill) => skill._id.toString()));

  const errors = ids
    .map((id, index) => ({ id, index }))
    .filter((entry) => !foundIds.has(entry.id))
    .map((entry) => ({
      field: `targetSkills[${entry.index}]`,
      message: 'This skill does not exist or is no longer available.',
    }));

  if (errors.length > 0) {
    throw AppError.badRequest('One or more selected skills could not be found.', errors);
  }
};

/**
 * Copies only whitelisted fields onto a document.
 *
 * EDITABLE_LEARNING_PROGRAM_FIELDS is the whitelist and it lives in the validator, so
 * the fields that are validated and the fields that are written are the same list by
 * construction. `publisherId` is not in it, which is what makes ownership unforgeable
 * rather than merely guarded.
 *
 * `status` is excluded here and handled separately: a status change is a transition
 * with rules, not a field assignment.
 */
const applyWritableFields = (doc, body) => {
  EDITABLE_LEARNING_PROGRAM_FIELDS.filter((field) => field !== 'status' && field in body).forEach(
    (field) => {
      const value = body[field];

      if (field === 'targetSkills') {
        doc.targetSkills = normaliseSkillIds(value);
        return;
      }

      if (field === 'prerequisites') {
        doc.prerequisites = normalisePrerequisites(value);
        return;
      }

      if (field === 'startDate') {
        doc.startDate = startOfDay(value);
        return;
      }

      if (field === 'endDate') {
        doc.endDate = endOfDay(value);
        return;
      }

      /**
       * An empty string is a real value for the three optional text fields: it is
       * what "I removed the instructor" looks like. `durationHours` is different —
       * `''` from an emptied number input means "no fixed duration", which the schema
       * spells `null`.
       */
      if (field === 'durationHours') {
        doc.durationHours = value === '' || value === null ? null : Number(value);
        return;
      }

      doc[field] = value;
    },
  );
};

/**
 * Applies a status change, or rejects an illegal one.
 *
 * The legal edges live in LEARNING_PROGRAM_STATUS_TRANSITIONS, so this function does
 * not decide policy — it enforces it. PATCHing the status a document already has is a
 * no-op rather than an error, because an idempotent request should not fail: the demo
 * seed relies on exactly that.
 *
 * UN-ARCHIVING NEEDS A LIVE END DATE, for the same reason reopening an opportunity
 * needs a live deadline. Setting `archived -> published` on a programme whose end date
 * has passed produces a "published" programme every reader still sees as `ended` and
 * nobody can enrol in. Rejecting with a message that names the fix is more honest than
 * accepting a change that does nothing visible. A programme with no end date is
 * evergreen and always passes this.
 */
const applyStatusChange = (doc, body, now) => {
  if (!('status' in body)) return;

  const from = doc.status;
  const to = body.status;

  if (from === to) return;

  if (!canTransitionProgram(from, to)) {
    const allowed = LEARNING_PROGRAM_STATUS_TRANSITIONS[from] ?? [];

    throw AppError.badRequest('That status change is not allowed.', [
      {
        field: 'status',
        message: allowed.length
          ? `A ${from} program can only become ${allowed.join(' or ')}.`
          : `A ${from} program cannot change status.`,
      },
    ]);
  }

  if (to === LEARNING_PROGRAM_STATUSES.PUBLISHED) {
    const endDate = 'endDate' in body ? endOfDay(body.endDate) : doc.endDate;

    if (endDate && endDate.getTime() < now.getTime()) {
      throw AppError.badRequest('This program has already ended.', [
        {
          field: 'endDate',
          message: 'Choose a new end date, or clear it, before publishing this program again.',
        },
      ]);
    }
  }

  doc.status = to;
};

/** Re-reads with populated references — save() leaves fresh ids bare. */
const reload = (id) => LearningProgram.findById(id).populate(POPULATE_REFS);

/* ----------------------------------------------------------- publisher writes */

/**
 * POST /learning/programs
 *
 * `publisherId` comes from the authenticated caller and from nowhere else. There is
 * no parameter through which a different owner could be supplied.
 */
export const createLearningProgram = async (ownerId, body = {}) => {
  const targetSkills = normaliseSkillIds(body.targetSkills ?? []);

  await assertSkillsExist(targetSkills);

  const program = new LearningProgram({ publisherId: ownerId });

  applyWritableFields(program, { ...body, targetSkills: body.targetSkills ?? [] });

  if (body.status) program.status = body.status;

  await program.save();

  return (await reload(program._id)).toPublicObject();
};

/**
 * Loads a programme the caller owns, or throws.
 *
 * Scoped by owner in the query itself, so the safe path never depends on a comparison
 * further down. The second query runs only on the failure path and exists purely so
 * the message can be accurate:
 *
 *   - someone else's PUBLISHED or ARCHIVED programme -> 403. Its existence is not a
 *     secret; students browse it. "This belongs to another organisation" is the truth
 *     and is more useful than a misleading "not found".
 *   - someone else's DRAFT, or nothing at all -> 404. An unpublished programme must not
 *     be discoverable by probing ids, so it is indistinguishable from absent.
 */
const requireOwnProgram = async (ownerId, id) => {
  const owned = await LearningProgram.findOne({ _id: id, publisherId: ownerId }).populate(
    POPULATE_REFS,
  );

  if (owned) return owned;

  const foreign = await LearningProgram.findById(id).select('status');

  if (foreign && foreign.status !== LEARNING_PROGRAM_STATUSES.DRAFT) {
    throw AppError.forbidden(
      'This program was published by another organisation, so you cannot change it.',
    );
  }

  throw AppError.notFound('That learning program could not be found.');
};

/**
 * PATCH /learning/programs/:id
 *
 * Partial by design: absent fields are left alone. Every reference and rule is
 * re-checked against the merged result, not against the patch, because a patch that is
 * individually valid can still produce an invalid document — a new `startDate` that
 * crosses the stored `endDate` is the obvious case, and the model's `coherentDates`
 * hook is what catches it.
 */
export const updateLearningProgram = async (ownerId, id, body = {}, now = new Date()) => {
  const program = await requireOwnProgram(ownerId, id);

  if ('targetSkills' in body) {
    await assertSkillsExist(normaliseSkillIds(body.targetSkills ?? []));
  }

  applyWritableFields(program, body);
  applyStatusChange(program, body, now);

  await program.save();

  return (await reload(program._id)).toPublicObject();
};

/**
 * DELETE /learning/programs/:id
 *
 * REFUSED ONCE ANYONE HAS ENROLLED, and this is a deliberate departure from
 * `deleteOpportunity`, which hard-deletes. That comment says a hard delete is safe
 * "precisely because nothing references an opportunity yet"; here something does. An
 * enrolment is a learner's record of what they studied and finished — the evidence the
 * whole reassessment loop hangs off — and deleting the programme would strand it, so a
 * completed course would render as a blank row in My Learning forever.
 *
 * Archiving is offered instead: it hides the programme from browse and from
 * recommendations while leaving every enrolment readable. The message says so, because
 * a refusal that does not name the alternative is just an obstacle.
 */
export const deleteLearningProgram = async (ownerId, id) => {
  const program = await requireOwnProgram(ownerId, id);

  const enrollments = await LearningEnrollment.countDocuments({ programId: program._id });

  if (enrollments > 0) {
    throw AppError.badRequest('This program already has learners enrolled.', [
      {
        field: 'status',
        message: `${enrollments} ${
          enrollments === 1 ? 'learner has' : 'learners have'
        } enrolled, so this program cannot be deleted. Archive it instead to take it off the hub.`,
      },
    ]);
  }

  await program.deleteOne();

  return { id: String(id) };
};

/* ------------------------------------------------------------ publisher reads */

/**
 * Enrolment and completion counts for a set of programmes, in ONE aggregate.
 *
 * COMPUTED, NEVER STORED — the model's header says why: a counter field on the
 * programme would be a second answer that drifts the first time a write fails half
 * way. Grouping by `{programId, status}` gives the per-programme breakdown and the
 * totals from the same pass, which is what the management list and its summary card
 * both need.
 *
 * AGGREGATE COUNTS, NOT LEARNERS. Nothing here reads a name, an email or an
 * individual progress figure: "is this programme working?" is a fair question for a
 * publisher, "who is behind on it?" is private student information, and the standing
 * rule against accessing that without authorisation covers industry users too.
 */
const countEnrollmentsFor = async (programIds = []) => {
  const byProgram = new Map();
  const totals = { total: 0, enrolled: 0, inProgress: 0, completed: 0 };

  if (programIds.length === 0) return { byProgram, totals };

  const rows = await LearningEnrollment.aggregate([
    { $match: { programId: { $in: programIds } } },
    { $group: { _id: { programId: '$programId', status: '$status' }, count: { $sum: 1 } } },
  ]);

  const bucketFor = (status) => {
    if (status === ENROLLMENT_STATUSES.IN_PROGRESS) return 'inProgress';
    if (status === ENROLLMENT_STATUSES.COMPLETED) return 'completed';
    return 'enrolled';
  };

  rows.forEach((row) => {
    const key = String(row._id.programId);
    const bucket = bucketFor(row._id.status);
    const entry = byProgram.get(key) ?? { total: 0, enrolled: 0, inProgress: 0, completed: 0 };

    entry.total += row.count;
    entry[bucket] += row.count;
    byProgram.set(key, entry);

    totals.total += row.count;
    totals[bucket] += row.count;
  });

  return { byProgram, totals };
};

/**
 * Counts for the publisher's dashboard card.
 *
 * "Open" means genuinely open — published AND not past its end date — because a
 * publisher reading "4 open" wants to know how many programmes learners can actually
 * join, not how many have a status field that says so. Ended is counted separately for
 * the same reason. A null end date counts as open, which is what evergreen means.
 *
 * Five counts rather than an aggregation pipeline, the same judgement `summariseOwned`
 * makes in opportunity.service.js: at hackathon scale these are indexed counts, and a
 * `$facet` would be harder to read and to test offline for no measurable gain.
 */
const summariseOwned = async (ownerId, now = new Date()) => {
  const base = { publisherId: ownerId };
  const live = [{ endDate: null }, { endDate: { $gte: now } }];

  const [total, open, ended, drafts, archived, owned] = await Promise.all([
    LearningProgram.countDocuments(base),
    LearningProgram.countDocuments({
      ...base,
      status: LEARNING_PROGRAM_STATUSES.PUBLISHED,
      $or: live,
    }),
    LearningProgram.countDocuments({
      ...base,
      status: LEARNING_PROGRAM_STATUSES.PUBLISHED,
      endDate: { $ne: null, $lt: now },
    }),
    LearningProgram.countDocuments({ ...base, status: LEARNING_PROGRAM_STATUSES.DRAFT }),
    LearningProgram.countDocuments({ ...base, status: LEARNING_PROGRAM_STATUSES.ARCHIVED }),
    LearningProgram.find(base).select('_id'),
  ]);

  const { byProgram, totals } = await countEnrollmentsFor(owned.map((doc) => doc._id));

  return {
    summary: {
      total,
      open,
      ended,
      drafts,
      archived,
      enrollments: totals.total,
      completions: totals.completed,
    },
    byProgram,
  };
};

/**
 * GET /industry/learning-programs — the caller's own programmes.
 *
 * Includes drafts, archived and ended programmes: this is a management view, and an
 * owner who cannot see what they archived cannot restore it. The optional `status`,
 * `type` and `search` filters narrow it.
 *
 * The summary is computed by the DATABASE over the whole collection, not by counting
 * the current page — counting a paginated array would report "3 programmes" on page one
 * of thirty, and the dashboard number would silently depend on the page size.
 *
 * Each row carries its own `enrollment` counts, which is the "enrollment/completion
 * counts" the brief asks the owner surface for, and the only learner information a
 * publisher gets anywhere in this feature.
 */
export const listOwnedPrograms = async (ownerId, query = {}, now = new Date()) => {
  const { page, limit, skip } = resolvePaging(query);

  const filter = { publisherId: ownerId };

  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;
  if (query.level) filter.level = query.level;
  if (query.deliveryMode) filter.deliveryMode = query.deliveryMode;

  if (query.search) {
    filter.title = new RegExp(escapeRegex(query.search), 'i');
  }

  const [docs, total, counts] = await Promise.all([
    LearningProgram.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(POPULATE_REFS),
    LearningProgram.countDocuments(filter),
    summariseOwned(ownerId, now),
  ]);

  const empty = { total: 0, enrolled: 0, inProgress: 0, completed: 0 };

  return {
    programs: docs.map((doc) => ({
      ...doc.toPublicObject(),
      enrollment: counts.byProgram.get(String(doc._id)) ?? empty,
    })),
    total,
    page,
    limit,
    summary: counts.summary,
  };
};

/* --------------------------------------------------------------- learner reads */

/**
 * Builds the browse filter.
 *
 * THE AVAILABILITY RULE, enforced here rather than in the client: `status: published`
 * and an end date that has not passed. A learner is never shown something they could
 * not enrol in.
 *
 * THE NULL END DATE IS THE DIFFERENCE FROM OPPORTUNITY BROWSE, and it is the whole
 * reason this filter could not be reused from there. `deadline: {$gte: now}` on a null
 * field matches nothing, so borrowing that clause would hide every self-paced course —
 * which is most of them. `{$or: [{endDate: null}, {endDate: {$gte: now}}]}` is the same
 * rule `programAvailabilityFor` applies on read, expressed as a query.
 *
 * EVERY CLAUSE GOES UNDER `$and`, including the availability pair. Three separate
 * conditions here want `$or` — availability, the skill filter and the search — and a
 * second `$or` key silently overwrites the first, which is the bug that makes combined
 * filters quietly wrong. Composing from one list makes that impossible rather than
 * merely avoided.
 *
 * `search` is a case-insensitive regex across title, description, provider and
 * instructor rather than a `$text` index, because `$text` only matches whole words: a
 * student typing "front" would get nothing for "Frontend", which is not what a search
 * box may do. Honest about its scale rather than dressed up as search infrastructure.
 */
const buildProgramDiscoveryFilter = (
  { type, level, deliveryMode, skills, search } = {},
  now = new Date(),
) => {
  const filter = { status: LEARNING_PROGRAM_STATUSES.PUBLISHED };
  const clauses = [{ $or: [{ endDate: null }, { endDate: { $gte: now } }] }];

  if (type) filter.type = type;
  if (level) filter.level = level;
  if (deliveryMode) filter.deliveryMode = deliveryMode;

  if (skills) {
    const ids = String(skills)
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    /**
     * `$in` rather than `$all` because a student filtering by "React, Node" is asking
     * "what can I learn from these?", not "what teaches all of these at once?" — and
     * `$all` would return almost nothing.
     */
    if (ids.length > 0) clauses.push({ targetSkills: { $in: ids } });
  }

  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');

    clauses.push({
      $or: [
        { title: pattern },
        { description: pattern },
        { provider: pattern },
        { instructor: pattern },
      ],
    });
  }

  filter.$and = clauses;

  return filter;
};

/**
 * GET /learning/programs — the Learning Hub list.
 *
 * ONE ENDPOINT FOR EVERY SIGNED-IN READER. A student and an academician see the same
 * programmes: unlike an opportunity, a course has no audience to be aimed at, and
 * splitting this in two would be the duplicate API the standing rules forbid.
 *
 * Sorted newest first rather than by end date, for the reason the model's index
 * comment gives: most programmes have no end date at all, so sorting by it would order
 * the list by which ones happen to have dates.
 *
 * NO PERSONALISED RANKING HERE. Recommendations are a separate endpoint with a separate
 * service, because they need the reader's skill gaps and they carry reasons; a score
 * quietly folded into browse would be a second recommendation engine in disguise.
 */
export const listPublishedPrograms = async (query = {}, now = new Date()) => {
  const { page, limit, skip } = resolvePaging(query);
  const filter = buildProgramDiscoveryFilter(query, now);

  const [docs, total] = await Promise.all([
    LearningProgram.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(POPULATE_REFS),
    LearningProgram.countDocuments(filter),
  ]);

  return {
    programs: docs.map((doc) => doc.toPublicObject()),
    total,
    page,
    limit,
  };
};

/**
 * Published, still-open programmes that teach any of `skillIds`.
 *
 * THE QUERY THE RECOMMENDATION SERVICE RUNS, and it lives here rather than there for
 * the reason `countOpenByType` gives in opportunity.service.js: this module owns
 * LearningProgram reads, so "a live programme" has one definition. If the availability
 * rule ever changed, the hub and the recommendations would change together instead of
 * disagreeing.
 *
 * Unpaginated on purpose — the caller ranks and truncates, and it cannot rank what it
 * has not seen. Bounded in practice by the number of published programmes teaching a
 * handful of gap skills.
 */
export const listProgramsForSkills = async (skillIds = [], now = new Date()) => {
  const ids = skillIds.map((id) => String(id)).filter(Boolean);
  if (ids.length === 0) return [];

  const filter = buildProgramDiscoveryFilter({ skills: ids.join(',') }, now);

  return LearningProgram.find(filter).sort({ createdAt: -1 }).populate(POPULATE_REFS);
};

/**
 * GET /learning/programs/:id — one programme, for any signed-in reader.
 *
 * AN ENDED OR ARCHIVED PROGRAMME IS RETURNED, NOT HIDDEN. Browse excludes them, but a
 * learner following a bookmark or a link from My Learning deserves "this ended on 12
 * August" over a bare 404 that reads as if the page never existed — and someone who
 * completed it must still be able to open what they finished. The `availability` field
 * carries that fact, so the page can say so plainly.
 *
 * A DRAFT IS 404 FOR EVERYONE BUT ITS OWNER. An unpublished programme is not merely
 * hidden from the list; it must be undiscoverable by trying ids, which is why absence
 * and no-permission are deliberately indistinguishable here.
 */
export const getProgramForViewer = async (id, viewerId) => {
  const program = await LearningProgram.findById(id).populate(POPULATE_REFS);

  if (!program) {
    throw AppError.notFound('That learning program could not be found.');
  }

  if (program.status === LEARNING_PROGRAM_STATUSES.DRAFT && !program.isOwnedBy(viewerId)) {
    throw AppError.notFound('That learning program could not be found.');
  }

  return program.toPublicObject();
};

/**
 * Loads a programme somebody is allowed to enrol in, or throws.
 *
 * WHY THIS IS HERE AND NOT IN learningEnrollment.service.js: "can this be enrolled in"
 * is a fact about a programme, and the enrolment service asking the document directly
 * would put a second definition of availability next to the first. The reasons are
 * separated so the message is accurate — an archived programme, a draft and a finished
 * one are three different situations and "you cannot enrol" explains none of them.
 */
export const requireEnrollableProgram = async (programId, now = new Date()) => {
  const program = await LearningProgram.findById(programId).populate(POPULATE_REFS);

  if (!program || program.status === LEARNING_PROGRAM_STATUSES.DRAFT) {
    throw AppError.notFound('That learning program could not be found.');
  }

  const availability = programAvailabilityFor(
    { status: program.status, endDate: program.endDate },
    now,
  );

  if (availability === PROGRAM_AVAILABILITY.OPEN) return program;

  const message =
    availability === PROGRAM_AVAILABILITY.ENDED
      ? 'This program has already ended, so enrollment is closed.'
      : 'This program is no longer available for enrollment.';

  throw AppError.badRequest(message, [{ field: 'programId', message }]);
};

/**
 * How many published, open programmes exist per type — for the hub's filter chips and
 * the student dashboard card.
 *
 * `buildProgramDiscoveryFilter` supplies the base, so the counts and the list cannot
 * disagree about what "available" means. One aggregation rather than a count per type,
 * the same judgement `countOpenByType` makes for opportunities.
 */
export const countOpenProgramsByType = async (now = new Date()) => {
  const grouped = await LearningProgram.aggregate([
    { $match: buildProgramDiscoveryFilter({}, now) },
    { $group: { _id: '$type', count: { $sum: 1 } } },
  ]);

  const byType = grouped.reduce((counts, row) => ({ ...counts, [row._id]: row.count }), {});
  const total = grouped.reduce((sum, row) => sum + row.count, 0);

  return { total, byType };
};

export default {
  createLearningProgram,
  updateLearningProgram,
  deleteLearningProgram,
  listOwnedPrograms,
  listPublishedPrograms,
  listProgramsForSkills,
  getProgramForViewer,
  requireEnrollableProgram,
  countOpenProgramsByType,
};
