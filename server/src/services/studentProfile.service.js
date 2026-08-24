/**
 * Student profile business logic.
 *
 * TRD.md section 43: "Do not place all business logic inside controllers." The
 * controllers below this file only translate HTTP; every rule lives here.
 *
 * OWNERSHIP IS STRUCTURAL, NOT CHECKED. Every function takes a `userId` that the
 * caller obtained from `req.user.id` — which authenticate set from a verified
 * token — and every query filters on it. There is no code path that accepts a
 * profile id from the URL or body, so "student A edits student B's profile" is
 * not a check that could be forgotten; it is a request that cannot be expressed.
 * That is what his section 9 and RULES.md section 13.3 ask for.
 *
 * REFERENCE VALIDATION HAPPENS HERE. The validator proves an id is well-formed;
 * only a database read can prove it points at a real, active skill or role. Both
 * throw the same 400 envelope with the same field names, so the client cannot
 * tell the two layers apart and does not need to.
 */

import AppError from '../utils/AppError.js';
import StudentProfile from '../models/StudentProfile.js';
import Skill from '../models/Skill.js';
import CareerRole from '../models/CareerRole.js';
import { SKILL_SOURCES } from '../constants/skills.js';
import { EDITABLE_PROFILE_FIELDS } from '../validators/studentProfile.validator.js';

/**
 * Populates the catalogue references so a profile response carries skill names
 * and role titles, not bare ids.
 *
 * Without this the frontend would have to fetch the whole skill catalogue just
 * to render "React — Advanced", or worse, store a copy of it. Selecting only the
 * display fields keeps the payload small.
 */
const POPULATE_REFS = [
  { path: 'skills.skillId', select: 'name slug category tags' },
  { path: 'targetRoles.roleId', select: 'title slug category' },
];

const findOwnProfile = (userId) => StudentProfile.findOne({ userId }).populate(POPULATE_REFS);

/**
 * Loads the caller's profile or throws 404.
 *
 * The 404 message names the fix ("create your profile first") because this is a
 * normal state for a new student, not an error — his section 7 and DESIGN.md
 * section 33 both want empty states to guide toward an action.
 */
const requireOwnProfile = async (userId) => {
  const profile = await findOwnProfile(userId);

  if (!profile) {
    throw AppError.notFound(
      'You have not created your student profile yet. Create it to get started.',
    );
  }

  return profile;
};

/** Saves, recomputing completion first so the stored number can never be stale. */
const persist = async (profile) => {
  profile.recomputeCompletion();
  await profile.save();

  // Re-populate: save() leaves the freshly-written subdocuments as bare ids.
  return findOwnProfile(profile.userId);
};

/**
 * Copies only whitelisted fields from a request body onto a profile document.
 *
 * EDITABLE_PROFILE_FIELDS is the whitelist and it lives in the validator, so the
 * fields that are validated and the fields that are written are the same list by
 * construction. A caller cannot set userId, profileCompletion or readinessScore
 * because those names are simply not in it.
 *
 * `'' -> null` for the numeric fields: a cleared HTML number input submits an
 * empty string, and Mongoose would cast that to 0, silently turning "I removed
 * my CGPA" into "my CGPA is 0".
 */
const NUMERIC_FIELDS = new Set(['graduationYear', 'currentYear', 'cgpa']);

const applyEditableFields = (profile, body) => {
  EDITABLE_PROFILE_FIELDS.forEach((field) => {
    if (!(field in body)) return;

    const value = body[field];

    if (NUMERIC_FIELDS.has(field)) {
      profile[field] = value === '' || value === null || value === undefined ? null : Number(value);
      return;
    }

    if (field === 'interests') {
      profile.interests = Array.isArray(value) ? value.map((item) => item.trim()) : [];
      return;
    }

    profile[field] = typeof value === 'string' ? value.trim() : value;
  });
};

/* ------------------------------------------------------------------ profile */

/**
 * GET /students/profile
 *
 * Returns null rather than throwing when no profile exists. The distinction
 * matters to the client: "you have no profile yet" drives a create form, while a
 * 404 would look like a failure. The controller sends 200 with `profile: null`.
 */
export const getOwnProfile = async (userId) => {
  const profile = await findOwnProfile(userId);
  return profile ? profile.toProfileObject() : null;
};

/**
 * POST /students/profile
 *
 * One profile per student. The pre-check gives a friendly 409; the unique index
 * on userId is the real guarantee, and errorMiddleware maps its duplicate-key
 * error (code 11000) to a 409 too, so a race between two simultaneous requests
 * still produces the correct status.
 */
export const createOwnProfile = async (userId, body = {}) => {
  const existing = await StudentProfile.findOne({ userId });

  if (existing) {
    throw AppError.conflict('You already have a student profile.', [
      { field: 'profile', message: 'A profile already exists for this account.' },
    ]);
  }

  const profile = new StudentProfile({ userId });
  applyEditableFields(profile, body);

  return (await persist(profile)).toProfileObject();
};

/** PATCH /students/profile — partial update of the caller's own profile. */
export const updateOwnProfile = async (userId, body = {}) => {
  const profile = await requireOwnProfile(userId);
  applyEditableFields(profile, body);

  return (await persist(profile)).toProfileObject();
};

/* ------------------------------------------------------------- career goals */

/**
 * PUT /students/profile/career-goals — replaces the whole selection.
 *
 * Validates every id against the CareerRole collection in ONE query before
 * writing anything, so a payload with one bad id changes nothing rather than
 * applying half of itself. `isActive: true` is part of the filter: a retired
 * role must not become newly selectable, even though profiles that already
 * reference it keep working.
 */
export const setCareerGoals = async (userId, goals = []) => {
  const profile = await requireOwnProfile(userId);

  if (goals.length > 0) {
    const ids = goals.map((goal) => goal.roleId);
    const found = await CareerRole.find({ _id: { $in: ids }, isActive: true }).select('_id');
    const foundIds = new Set(found.map((role) => role._id.toString()));

    const invalid = goals
      .map((goal, index) => ({ ...goal, index }))
      .filter((goal) => !foundIds.has(goal.roleId));

    if (invalid.length > 0) {
      throw AppError.badRequest(
        'One or more selected career goals could not be found.',
        invalid.map((goal) => ({
          field: `roleIds[${goal.index}]`,
          message: 'This career role does not exist or is no longer available.',
        })),
      );
    }
  }

  profile.targetRoles = goals.map((goal) => ({
    roleId: goal.roleId,
    priority: goal.priority,
  }));

  return (await persist(profile)).toProfileObject();
};

/* -------------------------------------------------------------------- skills */

/**
 * POST /students/profile/skills
 *
 * Adds one skill. A skill the student already has is a 409, not a silent
 * overwrite — his section 6 asks for "no duplicate skill entries for one
 * student", and the message points at the update endpoint so the client knows
 * what to do instead.
 *
 * `source` is forced to MANUAL and `verified` to false. These are not accepted
 * from the request under any circumstances: letting a client set
 * `source: 'assessment'` or `verified: true` would let a student mark their own
 * skills as verified, which is precisely the claim the assessment engine will
 * later exist to make honestly.
 */
export const addSkill = async (userId, { skillId, level }) => {
  const profile = await requireOwnProfile(userId);

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
    throw AppError.conflict(`${skill.name} is already in your skills.`, [
      { field: 'skillId', message: 'Update the existing entry to change its level.' },
    ]);
  }

  profile.skills.push({
    skillId: skill._id,
    level: Number(level),
    verified: false,
    source: SKILL_SOURCES.MANUAL,
  });

  return (await persist(profile)).toProfileObject();
};

/**
 * PATCH /students/profile/skills/:skillId — changes the proficiency level.
 *
 * Only `level` is mutable. Re-asserting MANUAL/false matters for a case that
 * will exist later: once the assessment engine has written a verified score, a
 * student editing the number by hand makes it self-reported again. Saying so in
 * the data is more honest than leaving a stale `verified: true` behind.
 */
export const updateSkillLevel = async (userId, skillId, { level }) => {
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

  return (await persist(profile)).toProfileObject();
};

/**
 * DELETE /students/profile/skills/:skillId
 *
 * 404 when the skill is not listed rather than a silent success. "Remove
 * something that is not there" is usually a stale client, and telling it so is
 * more useful than pretending the request did something.
 */
export const removeSkill = async (userId, skillId) => {
  const profile = await requireOwnProfile(userId);

  const before = profile.skills.length;
  profile.skills = profile.skills.filter(
    (item) => String(item.skillId?._id ?? item.skillId) !== String(skillId),
  );

  if (profile.skills.length === before) {
    throw AppError.notFound('That skill is not in your profile.');
  }

  return (await persist(profile)).toProfileObject();
};

/** GET /students/profile/skills — just the skills, for the skills screen. */
export const getOwnSkills = async (userId) => {
  const profile = await requireOwnProfile(userId);
  return profile.toProfileObject().skills;
};

export default {
  getOwnProfile,
  createOwnProfile,
  updateOwnProfile,
  setCareerGoals,
  addSkill,
  updateSkillLevel,
  removeSkill,
  getOwnSkills,
};
