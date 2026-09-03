/**
 * Learning recommendations — what to study next, and why.
 *
 * DETERMINISTIC. The priority score is arithmetic over three inputs the portal
 * already has, in the order PHASES.md asks for:
 *
 *     priority = 55 × gapShare + 30 × importanceShare + 15 × demandShare
 *
 *   1. GAP SIZE (55) — how far below the required level the student is, as a
 *      share of the requirement. A 30-point hole in a skill needing 40 is worse
 *      than a 30-point hole in one needing 90, and dividing by the requirement
 *      is what says so.
 *   2. CAREER-ROLE IMPORTANCE (30) — the role's own `importanceWeight`,
 *      normalised against the heaviest skill in that role.
 *   3. OPPORTUNITY DEMAND (15) — how many live postings ask for this skill,
 *      against the most-demanded skill in the set. Real counted data, not a
 *      guess; when nothing is posted this term is simply zero for everyone,
 *      which changes the ranking not at all.
 *
 * The weights are ordered, not arbitrary: gap dominates, importance breaks its
 * ties, demand breaks importance's. No AI touches this number — an LLM may only
 * ever rewrite the sentence, and there is a written reason with or without one.
 *
 * NO LearningProgram COLLECTION. TRD.md section 18 sketches one, but nothing
 * seeds it, and an empty collection recommends nothing — the demo would show an
 * empty state and the feature would be invisible. So a programme is DERIVED from
 * the skill and the level the student needs to reach: "Docker Fundamentals" for
 * a beginner, "Docker in Practice" at intermediate, "Advanced Docker" above
 * that. Those titles are honest — they name what to learn, not a course someone
 * has to have published — and when a real catalogue arrives it slots in behind
 * the same `recommendations` shape.
 */

import Opportunity from '../models/Opportunity.js';
import { AUDIENCES, OPPORTUNITY_STATUSES, audienceQuery } from '../constants/opportunities.js';
import { getReadinessForStudent } from './readiness.service.js';

/** How many recommendations to return. PHASES.md asks for "top 3-5". */
export const RECOMMENDATION_LIMIT = 5;

/** Weights, in the priority order the brief specifies. They sum to 100. */
const WEIGHT_GAP = 55;
const WEIGHT_IMPORTANCE = 30;
const WEIGHT_DEMAND = 15;

/**
 * Bands for the priority label. Three, because a student can act on "do this
 * first / do this next / do this eventually" and cannot act on a 0-100 score.
 *
 * EXPORTED so `learningRecommendation.service.js` can label a *programme* on the
 * same scale a skill is labelled on. A programme's score is the highest score
 * among the gaps it covers, and if that service invented its own thresholds a
 * course could read "medium priority" on the hub while the very gap it closes
 * reads "high" on the readiness page. Same function, one scale, no drift. This
 * export is the only change Step 8 makes to this file — the arithmetic above is
 * untouched.
 */
export const priorityBand = (score) => {
  if (score >= 55) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
};

/**
 * The programme to point a student at, derived from where they are now.
 *
 * A student at 5 in a skill and a student at 65 both have a gap, but sending
 * them to the same place would waste one of them. The break points are the
 * app's existing proficiency bands, so "Fundamentals" means the same thing here
 * as BEGINNER/BASIC does everywhere else.
 */
const programmeFor = ({ skillName, studentLevel }) => {
  if (studentLevel < 40) {
    return {
      title: `${skillName} Fundamentals`,
      type: 'course',
      level: 'beginner',
      focus: 'Start from the basics and build a working foundation.',
    };
  }
  if (studentLevel < 70) {
    return {
      title: `${skillName} in Practice`,
      type: 'workshop',
      level: 'intermediate',
      focus: 'Apply what you know on realistic problems rather than exercises.',
    };
  }
  return {
    title: `Advanced ${skillName}`,
    type: 'certification',
    level: 'advanced',
    focus: 'Close the last stretch and get the level formally recognised.',
  };
};

/**
 * The sentence under each recommendation.
 *
 * Built from whichever inputs are actually true of this skill, so it never
 * claims demand that does not exist. This is the deterministic fallback the
 * brief requires: it is not a placeholder for an AI string, it is the shipped
 * behaviour, and an AI rewrite would only ever replace it.
 */
const explain = ({ row, roleTitle, demandCount, isTopWeighted }) => {
  const reasons = [];

  if (row.severity === 'major') reasons.push('Large gap');
  else if (row.severity === 'moderate') reasons.push('Moderate gap');
  else reasons.push('Small gap to close');

  if (isTopWeighted) reasons.push(`core skill for ${roleTitle}`);
  else if (row.importanceWeight >= 15) reasons.push(`important for ${roleTitle}`);
  else reasons.push(`part of the ${roleTitle} requirement`);

  if (demandCount > 0) {
    reasons.push(
      `asked for by ${demandCount} open ${demandCount === 1 ? 'opportunity' : 'opportunities'}`,
    );
  }

  // "Large gap + core skill for Backend Developer" — the format his brief shows.
  return reasons.join(' + ');
};

/**
 * Counts live postings per skill.
 *
 * Only ACTIVE postings whose deadline has not passed, because a closed role is
 * not demand. Required and preferred both count: a preferred skill is still a
 * signal about what the market wants, and treating it as zero would understate
 * skills that appear as "nice to have" everywhere.
 *
 * STUDENT POSTINGS ONLY (Step 7). This number becomes "learn Docker — 12 open
 * postings want it" on a student's recommendation list, so the postings counted
 * have to be ones that student could actually apply to. Counting faculty
 * development programmes here would inflate demand for skills no student can act
 * on, which is worse than an under-count: it would send them to the wrong course.
 *
 * A failure here is swallowed by the caller — demand is the lowest-weighted of
 * the three inputs and the other two are enough to rank on.
 *
 * @returns {Promise<Map<string, number>>} skillId -> number of open postings
 */
export const countSkillDemand = async () => {
  const openPostings = await Opportunity.find(
    {
      audience: audienceQuery(AUDIENCES.STUDENT),
      status: OPPORTUNITY_STATUSES.ACTIVE,
      deadline: { $gte: new Date() },
    },
    'requiredSkills.skillId preferredSkills.skillId',
  ).lean();

  const counts = new Map();

  for (const posting of openPostings) {
    // A skill listed as both required and preferred on one posting is still one
    // posting — counting it twice would inflate that skill's demand.
    const ids = new Set(
      [...(posting.requiredSkills ?? []), ...(posting.preferredSkills ?? [])]
        .map((entry) => entry?.skillId)
        .filter(Boolean)
        .map(String),
    );

    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return counts;
};

/**
 * Ranks skill gaps into recommendations. Pure — no database, no clock.
 *
 * @param {{skillGaps: Array<object>, roleTitle: string,
 *          demandBySkillId?: Map<string, number>, limit?: number}} input
 * @returns {Array<object>} highest priority first
 */
export const buildRecommendations = ({
  skillGaps = [],
  roleTitle = 'your target role',
  demandBySkillId = new Map(),
  limit = RECOMMENDATION_LIMIT,
} = {}) => {
  if (skillGaps.length === 0) return [];

  // Each term is normalised against the strongest value present, so the scale is
  // the same 0-100 whatever the role looks like. Guarded against zero: a role
  // where every weight is equal must not divide by nothing.
  const heaviestWeight = Math.max(...skillGaps.map((row) => row.importanceWeight), 0);
  const highestDemand = Math.max(
    0,
    ...skillGaps.map((row) => demandBySkillId.get(String(row.skillId)) ?? 0),
  );

  const scored = skillGaps.map((row) => {
    const demandCount = demandBySkillId.get(String(row.skillId)) ?? 0;

    // How much of the requirement is still missing, 0..1. `requiredLevel` is
    // never 0 for a row that has a gap — a zero requirement is met by
    // definition — but the guard keeps this honest if that ever changes.
    const gapShare = row.requiredLevel > 0 ? row.gap / row.requiredLevel : 0;
    const importanceShare = heaviestWeight > 0 ? row.importanceWeight / heaviestWeight : 0;
    const demandShare = highestDemand > 0 ? demandCount / highestDemand : 0;

    const priorityScore = Math.round(
      WEIGHT_GAP * gapShare + WEIGHT_IMPORTANCE * importanceShare + WEIGHT_DEMAND * demandShare,
    );

    const programme = programmeFor({ skillName: row.skillName, studentLevel: row.studentLevel });

    return {
      skillId: row.skillId,
      skillName: row.skillName,
      skillCategory: row.skillCategory,

      title: programme.title,
      type: programme.type,
      level: programme.level,
      focus: programme.focus,

      priorityScore,
      priority: priorityBand(priorityScore),

      reason: explain({
        row,
        roleTitle,
        demandCount,
        isTopWeighted: heaviestWeight > 0 && row.importanceWeight === heaviestWeight,
      }),

      // The evidence behind the score, so the UI can show the arithmetic rather
      // than asking to be trusted.
      currentLevel: row.studentLevel,
      targetLevel: row.requiredLevel,
      gap: row.gap,
      importanceWeight: row.importanceWeight,
      demandCount,
    };
  });

  return scored
    .sort(
      (a, b) =>
        b.priorityScore - a.priorityScore ||
        b.gap - a.gap ||
        a.skillName.localeCompare(b.skillName),
    )
    .slice(0, limit);
};

/**
 * Recommendations for one student, against one career role.
 *
 * Reuses the readiness service rather than recomputing gaps, so a gap can never
 * read as 30 on one page and 25 on another.
 *
 * @param {{studentId: string, careerRoleId?: string, limit?: number}} input
 * @returns {Promise<{recommendations: Array<object>, careerRole: object|null,
 *                    readinessScore: number|null, reason: string|null}>}
 */
export const getRecommendationsForStudent = async ({
  studentId,
  careerRoleId,
  limit = RECOMMENDATION_LIMIT,
} = {}) => {
  const { readiness, careerRole, reason } = await getReadinessForStudent({
    studentId,
    careerRoleId,
  });

  if (!readiness) {
    return { recommendations: [], careerRole: null, readinessScore: null, reason };
  }

  // Demand is the lowest-weighted input, so a failure counting it must not cost
  // the student their recommendations.
  let demandBySkillId = new Map();
  try {
    demandBySkillId = await countSkillDemand();
  } catch {
    demandBySkillId = new Map();
  }

  const recommendations = buildRecommendations({
    skillGaps: readiness.skillGaps,
    roleTitle: careerRole?.title ?? 'your target role',
    demandBySkillId,
    limit,
  });

  return {
    recommendations,
    careerRole,
    readinessScore: readiness.readinessScore,
    reason: null,
  };
};

export default {
  buildRecommendations,
  countSkillDemand,
  getRecommendationsForStudent,
  priorityBand,
  RECOMMENDATION_LIMIT,
};
