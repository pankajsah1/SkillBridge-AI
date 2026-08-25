/**
 * Career readiness and skill gap analysis.
 *
 * THE WHOLE THING IS SUBTRACTION. For each skill a role requires:
 *
 *     gap = requiredLevel - studentLevel        (floored at zero)
 *
 * Both numbers are on the same 0-100 scale — CareerRole.requiredLevel says so
 * explicitly, and StudentProfile.skills[].level uses the same scale — which is
 * what makes the subtraction mean anything. No model, no AI, no magic constant:
 * a student can recompute every number on the page by hand, and a judge asking
 * "why 68%?" gets an arithmetic answer rather than a shrug.
 *
 * READINESS IS WEIGHTED ATTAINMENT, CAPPED PER SKILL:
 *
 *     attainment_i  = min(studentLevel_i / requiredLevel_i, 1)
 *     readiness     = round(100 * Σ(weight_i × attainment_i) / Σ(weight_i))
 *
 * Three deliberate properties:
 *
 *   - CAPPED AT 1 PER SKILL. Being 95 where 60 is asked does not buy credit for
 *     the skill you have never touched. Without the cap one spike would hide
 *     every hole, which is the opposite of what a readiness score is for.
 *   - WEIGHTED BY importanceWeight. The role data already carries weights that
 *     sum to 100 (PRD section 6.3), so a core skill counts more than a marginal
 *     one. Ignoring them would make Git worth as much as the language the job
 *     is written in.
 *   - A MISSING SKILL IS A ZERO, NOT AN OMISSION. Dropping unmeasured skills
 *     from the denominator would let a student with one skill score 100%
 *     readiness, which is the single most misleading thing this file could do.
 *
 * `calculateReadiness` is pure and takes plain objects, so the arithmetic can be
 * checked without a database — which is exactly how it is checked.
 */

import CareerRole from '../models/CareerRole.js';
import StudentProfile from '../models/StudentProfile.js';
import AppError from '../utils/AppError.js';
import { SKILL_SOURCES } from '../constants/skills.js';

/** A skill at or above the level the role asks for is a strength, not a gap. */
const MET = 0;

/**
 * Bands for how urgent a gap is. Presentation-oriented, but computed here so the
 * API is the single source of the label and two clients cannot disagree.
 *
 * The thresholds are the distance still to cover, in the same 0-100 points.
 */
const gapSeverity = (gap) => {
  if (gap <= MET) return 'met';
  if (gap <= 15) return 'minor';
  if (gap <= 35) return 'moderate';
  return 'major';
};

/**
 * The readiness maths, with no database in sight.
 *
 * @param {{requiredSkills: Array<{skillId: string, skillName?: string,
 *          skillCategory?: string, requiredLevel: number,
 *          importanceWeight: number}>,
 *         studentSkills: Array<{skillId: string, level: number,
 *          verified?: boolean, source?: string}>}} input
 * @returns {{readinessScore: number, strongSkills: Array<object>,
 *            skillGaps: Array<object>, requiredSkillCount: number,
 *            measuredSkillCount: number, assessedSkillCount: number,
 *            totalGap: number}}
 */
export const calculateReadiness = ({ requiredSkills = [], studentSkills = [] } = {}) => {
  const levelBySkillId = new Map(
    studentSkills.map((entry) => [String(entry.skillId), entry]),
  );

  const rows = requiredSkills.map((requirement) => {
    const skillId = String(requirement.skillId);
    const held = levelBySkillId.get(skillId) ?? null;

    const studentLevel = held ? Number(held.level) || 0 : 0;
    const requiredLevel = Number(requirement.requiredLevel) || 0;
    const importanceWeight = Number(requirement.importanceWeight) || 0;

    const gap = Math.max(0, requiredLevel - studentLevel);

    // A requirement of zero is already met by definition; dividing by it would
    // produce Infinity and poison the whole average.
    const attainment = requiredLevel === 0 ? 1 : Math.min(studentLevel / requiredLevel, 1);

    return {
      skillId,
      skillName: requirement.skillName ?? 'Skill',
      skillCategory: requirement.skillCategory,
      requiredLevel,
      studentLevel,
      importanceWeight,
      gap,
      severity: gapSeverity(gap),
      attainmentPercent: Math.round(attainment * 100),
      isMeasured: Boolean(held),
      isVerified: Boolean(held?.verified),
      source: held?.source ?? null,
      /**
       * How much closing this one gap would move the readiness score, in points.
       * This is what makes the gap list an ordered plan rather than a ranking:
       * a 40-point hole in a 5%-weight skill matters less than a 20-point hole
       * in a 25%-weight one, and this number says so.
       */
      readinessImpact: 0,
    };
  });

  const totalWeight = rows.reduce((sum, row) => sum + row.importanceWeight, 0);

  // Every weight zero (or no skills at all) would make the weighted mean 0/0.
  // Falling back to an unweighted mean keeps a hand-edited role usable instead
  // of reporting a confident zero.
  const weightFor = (row) => (totalWeight > 0 ? row.importanceWeight : 1);
  const weightSum = totalWeight > 0 ? totalWeight : rows.length;

  const earned = rows.reduce(
    (sum, row) => sum + weightFor(row) * (row.attainmentPercent / 100),
    0,
  );

  const readinessScore = weightSum === 0 ? 0 : Math.round((earned / weightSum) * 100);

  for (const row of rows) {
    const remaining = 1 - row.attainmentPercent / 100;
    row.readinessImpact =
      weightSum === 0 ? 0 : Math.round(((weightFor(row) * remaining) / weightSum) * 100);
  }

  const byImportance = (a, b) =>
    b.importanceWeight - a.importanceWeight || a.skillName.localeCompare(b.skillName);

  /** Biggest readiness win first — impact, then raw gap, then name. */
  const byImpact = (a, b) =>
    b.readinessImpact - a.readinessImpact ||
    b.gap - a.gap ||
    a.skillName.localeCompare(b.skillName);

  return {
    readinessScore,
    strongSkills: rows.filter((row) => row.gap <= MET).sort(byImportance),
    skillGaps: rows.filter((row) => row.gap > MET).sort(byImpact),
    requiredSkillCount: rows.length,
    measuredSkillCount: rows.filter((row) => row.isMeasured).length,
    assessedSkillCount: rows.filter((row) => row.source === SKILL_SOURCES.ASSESSMENT).length,
    totalGap: rows.reduce((sum, row) => sum + row.gap, 0),
  };
};

/**
 * Resolves which role to measure against: an explicit id, else the student's
 * primary career goal.
 *
 * Returns null rather than throwing when there is nothing to measure against —
 * "you have not chosen a career goal" is a state the UI should explain, not an
 * error to display in red.
 */
const resolveRoleId = ({ careerRoleId, profile }) => {
  if (careerRoleId) return careerRoleId;

  const goals = [...(profile?.targetRoles ?? [])].sort(
    (a, b) => (a.priority ?? 99) - (b.priority ?? 99),
  );

  return goals[0]?.roleId ?? null;
};

/**
 * Readiness for one student against one career role.
 *
 * @param {{studentId: string, careerRoleId?: string}} input
 * @returns {Promise<{readiness: object|null, careerRole: object|null,
 *                    reason: string|null}>}
 */
export const getReadinessForStudent = async ({ studentId, careerRoleId } = {}) => {
  const profile = await StudentProfile.findOne({ userId: studentId });

  if (!profile) {
    return { readiness: null, careerRole: null, reason: 'no-profile' };
  }

  const roleId = resolveRoleId({ careerRoleId, profile });
  if (!roleId) {
    return { readiness: null, careerRole: null, reason: 'no-career-goal' };
  }

  const role = await CareerRole.findById(roleId).populate('requiredSkills.skillId', 'name category');

  // An explicit id that does not exist is a client error worth reporting; a
  // stale goal pointing at a deleted role is the same 404 either way.
  if (!role) throw AppError.notFound('That career role could not be found.');

  const publicRole = role.toPublicObject();

  const readiness = calculateReadiness({
    requiredSkills: publicRole.requiredSkills,
    studentSkills: (profile.skills ?? []).map((entry) => ({
      skillId: entry.skillId,
      level: entry.level,
      verified: entry.verified,
      source: entry.source,
    })),
  });

  return {
    readiness,
    careerRole: {
      id: publicRole.id,
      title: publicRole.title,
      slug: publicRole.slug,
      category: publicRole.category,
      averageReadinessTarget: publicRole.averageReadinessTarget,
    },
    reason: null,
  };
};

export default { calculateReadiness, getReadinessForStudent };
