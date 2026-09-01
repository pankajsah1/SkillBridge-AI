/**
 * Academician business logic — profile, expertise, records, dashboard, matches.
 *
 * TRD.md section 43: "Do not place all business logic inside controllers." The
 * controller above this file only translates HTTP; every rule lives here.
 *
 * OWNERSHIP IS STRUCTURAL, NOT CHECKED — the same design as
 * `studentProfile.service.js` and `portfolio.service.js`, and the reason Step 7's
 * "an academician must only be able to edit their own profile" needs no guard
 * clause anywhere below. Every function takes a `userId` the caller read from
 * `req.user.id`, which `authenticate` set from a verified token, and every query
 * filters on it. No function here accepts a profile id or a user id from a request,
 * so "academician A edits academician B's profile" is not a check that could be
 * forgotten; it is a request that cannot be expressed. You will therefore not find
 * an `if (profile.userId !== userId) throw` below — it would be dead code, and dead
 * security code is how people convince themselves a system is safe.
 *
 * A record that does not exist and a record belonging to someone else are
 * indistinguishable from the client's side: both are 404 "not in your profile". So
 * subdocument ids cannot be probed for existence.
 *
 * REFERENCE VALIDATION HAPPENS HERE, not in the validator. The validator proves a
 * skill id is well-formed; only a database read can prove it points at a real,
 * active catalogue entry. Both throw the same 400 envelope with the same field
 * name, so the client cannot tell the two layers apart.
 *
 * NOTHING IN THIS FILE RE-IMPLEMENTS SOMETHING THAT ALREADY WORKED. The ranked
 * matches come from `matching.service.js` unchanged, the live-posting counts from
 * `opportunity.service.js`, the application counts from `application.service.js`,
 * and the completion arithmetic from the model. What is genuinely new is the
 * dashboard composition and the Phase 7 expertise explanation — and the latter is a
 * projection of the existing matcher's output, not a second algorithm.
 */

import AppError from '../utils/AppError.js';
import AcademicianProfile from '../models/AcademicianProfile.js';
import Skill from '../models/Skill.js';
import { SKILL_SOURCES } from '../constants/skills.js';
import { ACADEMICIAN_LIMITS } from '../constants/academicians.js';
import {
  AUDIENCES,
  isCollaborationType,
  isProgrammeType,
} from '../constants/opportunities.js';
import { isTerminalStatus } from '../constants/applications.js';
import {
  ACHIEVEMENT_FIELDS,
  EDITABLE_ACADEMICIAN_FIELDS,
  EDUCATION_FIELDS,
  EXPERIENCE_FIELDS,
} from '../validators/academician.validator.js';
import { countOpenByType } from './opportunity.service.js';
import { countMyApplications } from './application.service.js';
import { getMatchForAcademician, getMatchesForAcademician } from './matching.service.js';

/**
 * Populates the catalogue reference so a profile response carries skill names, not
 * bare ids — otherwise the client would have to fetch the whole catalogue to render
 * a tag. Same select list the student services use, so both sides of the portal
 * hand the frontend an identically-shaped skill.
 */
const POPULATE_REFS = [{ path: 'skills.skillId', select: 'name slug category tags' }];

const findOwnProfile = (userId) =>
  AcademicianProfile.findOne({ userId }).populate(POPULATE_REFS);

/**
 * Loads the caller's profile or throws 404 naming the fix.
 *
 * "Create your profile first" rather than a bare not-found, because for a
 * newly-registered academician this is a normal state and not an error.
 */
const requireOwnProfile = async (userId) => {
  const profile = await findOwnProfile(userId);

  if (!profile) {
    throw AppError.notFound(
      'You have not created your academician profile yet. Create it to get started.',
    );
  }

  return profile;
};

/**
 * Saves, recomputing completion first so the stored percentage can never be stale,
 * then re-reads with refs populated.
 *
 * `recomputeCompletion()` is a plain method rather than a hook: hooks that quietly
 * rewrite a field make a document's state depend on how it was saved. Calling it
 * from the one place that saves is explicit and has the same effect.
 */
const persist = async (profile) => {
  profile.recomputeCompletion();
  await profile.save();

  // save() leaves freshly-written subdocument refs as bare ids, so the response
  // would be missing skill names without this second read.
  return findOwnProfile(profile.userId);
};

/**
 * Copies only whitelisted fields from a request body onto the profile.
 *
 * `EDITABLE_ACADEMICIAN_FIELDS` lives in the validator, so the fields that get
 * validated and the fields that get written are the same list by construction. A
 * caller cannot set `userId`, `institutionId` or `profileCompletion` because those
 * names are simply not in it.
 */
const ARRAY_FIELDS = new Set(['expertiseAreas', 'researchInterests']);

const applyEditableFields = (profile, body) => {
  EDITABLE_ACADEMICIAN_FIELDS.forEach((field) => {
    if (!(field in body)) return;

    const value = body[field];

    if (ARRAY_FIELDS.has(field)) {
      profile[field] = Array.isArray(value)
        ? value.map((entry) => String(entry).trim()).filter(Boolean)
        : [];
      return;
    }

    /**
     * `designation` is the one field where `null` is a real value rather than an
     * omission — it is how an academician clears a rank they set by mistake, and
     * the model's enum accepts null for exactly that reason. Everything else
     * treats null as an empty string, matching the schema defaults.
     */
    if (field === 'designation') {
      profile.designation = value === '' || value === null ? null : value;
      return;
    }

    profile[field] = typeof value === 'string' ? value.trim() : value;
  });
};

/**
 * Locates one subdocument in one of the record arrays.
 *
 * `profile` was already fetched by owner, so anything found here belongs to the
 * caller by construction. The 404 message says "in your profile": true whether the
 * id never existed or belongs to another academician, and it leaks nothing either
 * way.
 */
const requireEntry = (profile, arrayName, entryId, label) => {
  const entry = profile[arrayName].id(entryId);

  if (!entry) {
    throw AppError.notFound(`That ${label} is not in your profile.`);
  }

  return entry;
};

/**
 * Copies whitelisted fields from a body onto a subdocument.
 *
 * The whitelist is the security boundary — `verified` and `source` appear in no
 * caller's field list, so no request can set them.
 *
 * `''`/`null` becomes `null` for dates and years so a client can clear a value it
 * set by mistake; an empty string would otherwise cast to `Invalid Date` or, worse
 * for a year, to `0`.
 */
const applyFields = (entry, body, fields, { dateFields = [], numberFields = [] } = {}) => {
  for (const field of fields) {
    if (body[field] === undefined) continue;

    const value = body[field];
    const isBlank = value === '' || value === null;

    if (dateFields.includes(field)) {
      entry[field] = isBlank ? null : new Date(value);
      continue;
    }

    if (numberFields.includes(field)) {
      entry[field] = isBlank ? null : Number(value);
      continue;
    }

    entry[field] = typeof value === 'string' ? value.trim() : value;
  }
};

const assertRoom = (profile, arrayName, max, label) => {
  if (profile[arrayName].length >= max) {
    throw AppError.badRequest(
      `You already have ${max} ${label}. Remove one before adding another.`,
    );
  }
};

/** The response every profile-mutating endpoint returns: the profile and its score. */
const profileResponse = (profile) => ({
  profile: profile.toProfileObject(),
  completion: profile.computeCompletionBreakdown(),
});

/* ------------------------------------------------------------------ profile */

/**
 * GET /academicians/profile
 *
 * Returns null rather than throwing when no profile exists. The distinction matters
 * to the client: "you have no profile yet" drives a create form, while a 404 reads
 * as a failure. The controller sends 200 with `profile: null`.
 */
export const getOwnProfile = async (userId) => {
  const profile = await findOwnProfile(userId);
  return profile ? profileResponse(profile) : { profile: null, completion: null };
};

/**
 * POST /academicians/profile
 *
 * One profile per academician. The pre-check buys a friendly 409; the unique index
 * on `userId` is the real guarantee, and `errorMiddleware` maps its duplicate-key
 * error (11000) to a 409 too, so two simultaneous requests still produce the right
 * status rather than a 500.
 */
export const createOwnProfile = async (userId, body = {}) => {
  const existing = await AcademicianProfile.findOne({ userId });

  if (existing) {
    throw AppError.conflict('You already have an academician profile.', [
      { field: 'profile', message: 'A profile already exists for this account.' },
    ]);
  }

  const profile = new AcademicianProfile({ userId });
  applyEditableFields(profile, body);

  return profileResponse(await persist(profile));
};

/** PATCH /academicians/profile — partial update of the caller's own profile. */
export const updateOwnProfile = async (userId, body = {}) => {
  const profile = await requireOwnProfile(userId);
  applyEditableFields(profile, body);

  return profileResponse(await persist(profile));
};

/**
 * GET /academicians/profile/completion
 *
 * Its own endpoint because the completion panel refreshes after every edit and does
 * not need the whole profile payload to do it.
 *
 * An academician with no profile gets an honest zero rather than a 404: no profile
 * really is 0% complete, and the missing-section list is exactly the advice a
 * first-time visitor needs. Built from an unsaved document so the arithmetic is the
 * same table, not a hardcoded stand-in.
 */
export const getOwnCompletion = async (userId) => {
  const profile = await AcademicianProfile.findOne({ userId });

  if (!profile) {
    return new AcademicianProfile({ userId }).computeCompletionBreakdown();
  }

  return profile.computeCompletionBreakdown();
};

/* ---------------------------------------------------------------- expertise */

/**
 * POST /academicians/profile/skills
 *
 * Adds one catalogue-backed skill. A skill already listed is a 409 rather than a
 * silent overwrite, with the message pointing at the update endpoint — the same
 * contract `studentProfile.service.js` offers, because the frontend treats both
 * identically.
 *
 * `source` is forced to MANUAL and `verified` to false, and neither is ever accepted
 * from the request. Letting a client send `verified: true` would let an academician
 * mark their own expertise as verified, which is precisely the claim an institution
 * or an assessment exists to make honestly.
 */
export const addExpertise = async (userId, { skillId, level }) => {
  const profile = await requireOwnProfile(userId);
  assertRoom(profile, 'skills', ACADEMICIAN_LIMITS.maxSkills, 'skills');

  const skill = await Skill.findOne({ _id: skillId, isActive: true });
  if (!skill) {
    throw AppError.badRequest('That skill could not be found.', [
      { field: 'skillId', message: 'This skill does not exist or is no longer available.' },
    ]);
  }

  const alreadyListed = profile.skills.some(
    (entry) => String(entry.skillId?._id ?? entry.skillId) === String(skill._id),
  );

  if (alreadyListed) {
    throw AppError.conflict(`${skill.name} is already in your expertise.`, [
      { field: 'skillId', message: 'Update the existing entry to change its level.' },
    ]);
  }

  profile.skills.push({
    skillId: skill._id,
    level: Number(level),
    verified: false,
    source: SKILL_SOURCES.MANUAL,
  });

  return profileResponse(await persist(profile));
};

/**
 * PATCH /academicians/profile/skills/:skillId — changes the proficiency level.
 *
 * Only `level` is mutable, and `verified`/`source` are re-asserted rather than left
 * alone: once anything has verified a level, editing the number by hand makes it
 * self-reported again, and saying so in the data is more honest than leaving a stale
 * `verified: true` behind.
 */
export const updateExpertiseLevel = async (userId, skillId, { level }) => {
  const profile = await requireOwnProfile(userId);

  const entry = profile.skills.find(
    (item) => String(item.skillId?._id ?? item.skillId) === String(skillId),
  );

  if (!entry) {
    throw AppError.notFound('That skill is not in your profile.');
  }

  entry.level = Number(level);
  entry.verified = false;
  entry.source = SKILL_SOURCES.MANUAL;

  return profileResponse(await persist(profile));
};

/**
 * DELETE /academicians/profile/skills/:skillId
 *
 * 404 when the skill is not listed rather than a silent success — "remove something
 * that is not there" usually means a stale client, and telling it so is more useful
 * than pretending the request did something.
 */
export const removeExpertise = async (userId, skillId) => {
  const profile = await requireOwnProfile(userId);

  const before = profile.skills.length;
  profile.skills = profile.skills.filter(
    (item) => String(item.skillId?._id ?? item.skillId) !== String(skillId),
  );

  if (profile.skills.length === before) {
    throw AppError.notFound('That skill is not in your profile.');
  }

  return profileResponse(await persist(profile));
};

/* ---------------------------------------------------------------- education */

export const addEducation = async (userId, data = {}) => {
  const profile = await requireOwnProfile(userId);
  assertRoom(profile, 'education', ACADEMICIAN_LIMITS.maxEducation, 'qualifications');

  // push({}) then apply, so the whitelist is the only path onto the subdocument and
  // a stray body field cannot ride along in an object spread. Pushing an EMPTY
  // object matters: seeding it with placeholder text would mean a field the
  // validator somehow let through gets stored as the word "placeholder" instead of
  // failing loudly at save.
  profile.education.push({});
  const entry = profile.education[profile.education.length - 1];
  applyFields(entry, data, EDUCATION_FIELDS, { numberFields: ['year'] });

  return profileResponse(await persist(profile));
};

export const updateEducation = async (userId, entryId, data = {}) => {
  const profile = await requireOwnProfile(userId);
  const entry = requireEntry(profile, 'education', entryId, 'qualification');

  applyFields(entry, data, EDUCATION_FIELDS, { numberFields: ['year'] });

  return profileResponse(await persist(profile));
};

export const removeEducation = async (userId, entryId) => {
  const profile = await requireOwnProfile(userId);
  requireEntry(profile, 'education', entryId, 'qualification').deleteOne();

  return profileResponse(await persist(profile));
};

/* --------------------------------------------------------------- experience */

export const addExperience = async (userId, data = {}) => {
  const profile = await requireOwnProfile(userId);
  assertRoom(profile, 'experiences', ACADEMICIAN_LIMITS.maxExperiences, 'positions');

  profile.experiences.push({});
  const entry = profile.experiences[profile.experiences.length - 1];
  applyFields(entry, data, EXPERIENCE_FIELDS, { dateFields: ['startDate', 'endDate'] });

  return profileResponse(await persist(profile));
};

export const updateExperience = async (userId, entryId, data = {}) => {
  const profile = await requireOwnProfile(userId);
  const entry = requireEntry(profile, 'experiences', entryId, 'position');

  applyFields(entry, data, EXPERIENCE_FIELDS, { dateFields: ['startDate', 'endDate'] });

  return profileResponse(await persist(profile));
};

export const removeExperience = async (userId, entryId) => {
  const profile = await requireOwnProfile(userId);
  requireEntry(profile, 'experiences', entryId, 'position').deleteOne();

  return profileResponse(await persist(profile));
};

/* -------------------------------------------------------------- achievement */

export const addAchievement = async (userId, data = {}) => {
  const profile = await requireOwnProfile(userId);
  assertRoom(profile, 'achievements', ACADEMICIAN_LIMITS.maxAchievements, 'achievements');

  profile.achievements.push({});
  const entry = profile.achievements[profile.achievements.length - 1];
  applyFields(entry, data, ACHIEVEMENT_FIELDS, { numberFields: ['year'] });

  return profileResponse(await persist(profile));
};

export const updateAchievement = async (userId, entryId, data = {}) => {
  const profile = await requireOwnProfile(userId);
  const entry = requireEntry(profile, 'achievements', entryId, 'achievement');

  applyFields(entry, data, ACHIEVEMENT_FIELDS, { numberFields: ['year'] });

  return profileResponse(await persist(profile));
};

export const removeAchievement = async (userId, entryId) => {
  const profile = await requireOwnProfile(userId);
  requireEntry(profile, 'achievements', entryId, 'achievement').deleteOne();

  return profileResponse(await persist(profile));
};

/* ------------------------------------------------------- expertise matching */

/**
 * Turns one match result into the Phase 7 expertise explanation.
 *
 * THIS IS A PROJECTION, NOT A SECOND MATCHING ALGORITHM — which is the whole point.
 * `calculateMatch` already returns every skill it considered, each row tagged with
 * `isPreferred` (whether the posting listed it as required or merely preferred) and
 * `isMeasured` (whether the person holds it at all). Splitting those rows three ways
 * produces exactly the two sentences the Step 7 brief asks for:
 *
 *   required + held    → "Strong expertise match: Python, Machine Learning"
 *   preferred + held   → "Additional relevant expertise: Deep Learning"
 *   required + missing → the gap list
 *
 * WHY THE SPLIT IS ON `isPreferred` AND NOT ON SOME NOTION OF TOPIC RELEVANCE. The
 * obvious-looking alternative was to call a skill "additionally relevant" when it
 * shares a category with the posting's requirements — but `SKILL_CATEGORIES` is only
 * `technical` and `soft`, so that rule would label every technical skill on the
 * platform relevant to every technical posting. It would produce confident sentences
 * that mean nothing. Reading `isPreferred` instead means the relevance claim is the
 * *employer's*, made when they wrote the posting, and this code only reports it.
 *
 * Rows are already sorted by the matcher, so the order here is the matcher's order:
 * the heaviest-weighted skills read first.
 *
 * @param {object|null} match — a `calculateMatch` result, or null
 * @returns {{strongMatch: Array<object>, additionalExpertise: Array<object>,
 *            gaps: Array<object>, highlights: string[]}|null}
 */
export const summariseExpertiseMatch = (match) => {
  if (!match) return null;

  /**
   * `studentLevel` is renamed to `level` at this boundary and nowhere else. The
   * matcher's row shape is shared with the student surface and is not being touched
   * — but "studentLevel" in an academician's API response would be a field name
   * that lies about who it describes, and the frontend would have to know why.
   */
  const project = (row) => ({
    skillId: row.skillId,
    name: row.name,
    category: row.category,
    requiredLevel: row.requiredLevel,
    level: row.studentLevel,
    attainmentPercent: row.attainmentPercent,
    isPreferred: row.isPreferred,
  });

  const matched = match.matchedSkills ?? [];
  const missing = match.missingSkills ?? [];

  const strongMatch = matched.filter((row) => !row.isPreferred).map(project);
  const additionalExpertise = matched.filter((row) => row.isPreferred).map(project);

  /**
   * Only required-and-missing skills are called gaps. A preferred skill the person
   * does not have is not a gap — the posting said it was optional, and listing it as
   * something they lack would misrepresent what the employer asked for.
   */
  const gaps = missing.filter((row) => !row.isPreferred).map(project);

  const names = (rows) => rows.map((row) => row.name).filter(Boolean);
  const highlights = [];

  if (strongMatch.length > 0) {
    highlights.push(`Strong expertise match: ${names(strongMatch).join(', ')}`);
  }

  if (additionalExpertise.length > 0) {
    highlights.push(`Additional relevant expertise: ${names(additionalExpertise).join(', ')}`);
  }

  if (gaps.length > 0) {
    highlights.push(`Expertise this opportunity also asks for: ${names(gaps).join(', ')}`);
  }

  return { strongMatch, additionalExpertise, gaps, highlights };
};

/** Attaches the expertise explanation to a `{opportunity, match}` pair. */
const withExpertise = (row) => ({
  ...row,
  expertise: summariseExpertiseMatch(row.match),
});

/**
 * GET /academicians/matches — ranked collaboration and programme matches.
 *
 * The ranking, the weights, the sort and the tie-breaks are all
 * `matching.service.js`'s, unchanged: this adds the expertise explanation and
 * nothing else. `reason: 'no-profile'` is passed through rather than turned into an
 * error, so the page can render "create your profile to see matches" instead of a
 * failure.
 */
export const getOwnMatches = async (userId, { limit } = {}) => {
  const result = await getMatchesForAcademician({ academicianId: userId, limit });

  return {
    matches: result.matches.map(withExpertise),
    consideredCount: result.consideredCount,
    reason: result.reason,
  };
};

/**
 * GET /academicians/matches/:opportunityId — one posting, explained.
 *
 * Deliberately not audience-gated, matching `getMatchForAcademician`'s own note: this
 * explains a posting the caller already has in front of them, and the gate that
 * matters is on *applying*, which `application.service.js` enforces.
 */
export const getOwnMatchForOpportunity = async (userId, opportunityId) => {
  const result = await getMatchForAcademician({ academicianId: userId, opportunityId });

  return {
    opportunity: result.opportunity,
    match: result.match,
    expertise: summariseExpertiseMatch(result.match),
    reason: result.reason,
  };
};

/* -------------------------------------------------------------- dashboard */

/** How many of the top matches the dashboard card previews. */
const DASHBOARD_MATCH_PREVIEW = 3;

/**
 * GET /academicians/dashboard — every card on the academician dashboard, in one
 * request.
 *
 * EVERY NUMBER HERE IS A DATABASE COUNT. Nothing is hardcoded and nothing is
 * estimated from a page of results — `countOpenByType` and `countMyApplications`
 * both count in MongoDB over the whole collection, so the figures do not silently
 * depend on a page size. Where there is genuinely nothing to report the answer is a
 * real zero with an empty list beside it, which is what lets the frontend render an
 * empty state rather than a spinner that never resolves.
 *
 * ONE ENDPOINT RATHER THAN FIVE, following `getRecruitmentSummary` for industry and
 * `analytics.service.js` for institutions: a dashboard that opens on every login
 * should not cost five round-trips.
 *
 * The four queries are independent, so they run concurrently — the slowest is the
 * ranked match list, and making the other three wait behind it would triple the
 * page's time to first paint for no reason.
 *
 * @param {string} userId — the caller, from `req.user.id`
 */
export const getDashboard = async (userId) => {
  const [profile, openCounts, applicationCounts, matchResult] = await Promise.all([
    findOwnProfile(userId),
    countOpenByType({ audience: AUDIENCES.ACADEMICIAN }),
    countMyApplications(userId),
    getMatchesForAcademician({ academicianId: userId, limit: DASHBOARD_MATCH_PREVIEW }),
  ]);

  /**
   * The collaboration/programme split is the constants' business, not this file's —
   * `isCollaborationType` and `isProgrammeType` are the single definition of which
   * type is which, and summing over the per-type counts means adding a new type in
   * one place updates both cards automatically.
   */
  const sumWhere = (predicate) =>
    Object.entries(openCounts.byType).reduce(
      (total, [type, count]) => (predicate(type) ? total + count : total),
      0,
    );

  /**
   * "Active" means still in play — anything that has not reached a terminal status.
   * Derived from `isTerminalStatus` rather than a hardcoded list, so the definition
   * cannot drift from the one the status-transition rules use.
   */
  const activeApplications = Object.entries(applicationCounts.byStatus).reduce(
    (total, [status, count]) => (isTerminalStatus(status) ? total : total + count),
    0,
  );

  return {
    profileCompletion: profile
      ? profile.computeCompletionBreakdown()
      : new AcademicianProfile({ userId }).computeCompletionBreakdown(),

    hasProfile: Boolean(profile),

    opportunities: {
      open: openCounts.total,
      collaborations: sumWhere(isCollaborationType),
      programmes: sumWhere(isProgrammeType),
      byType: openCounts.byType,
    },

    applications: {
      total: applicationCounts.total,
      active: activeApplications,
      byStatus: applicationCounts.byStatus,
    },

    matches: {
      /**
       * `consideredCount` is the number of postings *scored*, not the number
       * returned — `getMatchesForAcademician` counts before it truncates. So the card
       * can honestly say "3 of 12 considered" while only paying for three.
       */
      topMatches: matchResult.matches.map(withExpertise),
      consideredCount: matchResult.consideredCount,
      reason: matchResult.reason,
    },
  };
};

export default {
  getOwnProfile,
  createOwnProfile,
  updateOwnProfile,
  getOwnCompletion,
  addExpertise,
  updateExpertiseLevel,
  removeExpertise,
  addEducation,
  updateEducation,
  removeEducation,
  addExperience,
  updateExperience,
  removeExperience,
  addAchievement,
  updateAchievement,
  removeAchievement,
  summariseExpertiseMatch,
  getOwnMatches,
  getOwnMatchForOpportunity,
  getDashboard,
};
