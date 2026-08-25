/**
 * Explainable student-opportunity matching.
 *
 * ONE MATCH SCORE, FOUR NAMED PARTS, FIXED WEIGHTS:
 *
 *     matchScore = 70 x skillShare
 *                + 15 x careerInterestShare
 *                + 10 x eligibilityShare
 *                +  5 x profileCompletenessShare
 *
 * Every share is 0..1, so the score is bounded 0..100 by construction rather than
 * by clamping. The weights live in `MATCH_WEIGHTS` and sum to 100 — that is
 * asserted by the verification script, because a weighting that quietly stops
 * summing to 100 is a scoring bug no test of the output shape would catch.
 *
 * WHY THESE FOUR. Skills dominate at 70% because they are the only part an
 * employer actually asked for. Career interest at 15% keeps a student from being
 * pushed at a role they never wanted just because the skills happen to overlap.
 * Eligibility at 10% is small on purpose: it is a hard fact, not a preference, so
 * it is reported as a *statement* ("you do not meet the stated eligibility")
 * rather than being allowed to swamp the score. Profile completeness at 5% is the
 * nudge — a thin profile scores worse because the portal genuinely knows less.
 *
 * SKILL MATCHING IS THE READINESS MATHS, REUSED DELIBERATELY:
 *
 *     attainment_i = min(studentLevel_i / requiredLevel_i, 1)
 *     skillShare   = SUM(weight_i x attainment_i) / SUM(weight_i)
 *
 * Capped per skill for the same reason readiness caps it: being 95 where 70 is
 * asked must not buy credit for the skill you have never touched. Preferred
 * skills are reported but never scored — a "nice to have" that moved the number
 * would be a requirement wearing a different label.
 *
 * NO AI ANYWHERE IN THIS FILE. The score is arithmetic and the `recommendation`
 * sentence is assembled from the same numbers, so a judge asking "why 78%?" gets
 * the four parts back, each with its own detail line.
 *
 * `calculateMatch` is pure and takes plain objects, which is how it is tested.
 */

import CareerRole from '../models/CareerRole.js';
import Opportunity from '../models/Opportunity.js';
import StudentProfile from '../models/StudentProfile.js';
import AppError from '../utils/AppError.js';
import { OPPORTUNITY_STATUSES } from '../constants/opportunities.js';
import { POPULATE_REFS } from './opportunity.service.js';

/**
 * The weighting from his brief, verbatim. Exported so the client can explain the
 * breakdown without hardcoding the same four numbers a second time.
 */
export const MATCH_WEIGHTS = {
  skills: 70,
  careerInterest: 15,
  eligibility: 10,
  profileCompleteness: 5,
};

/** Default and ceiling for the ranked list. */
export const MATCH_LIMIT = 10;

/**
 * How many live postings are scored for one ranked list.
 *
 * Matching sorts on a derived number, so it cannot be done in the database — the
 * candidates have to be loaded. This cap is what stops "show me my matches" from
 * turning into unbounded work as the seed data grows.
 */
const CANDIDATE_CAP = 100;

/** Bands for the headline verdict. Presentation, but decided here so two clients agree. */
const matchBand = (score) => {
  if (score >= 75) return 'strong';
  if (score >= 60) return 'good';
  if (score >= 40) return 'possible';
  return 'stretch';
};

/**
 * Words that say what *kind* of posting it is rather than what the work is.
 *
 * Stripped before comparing a posting title to a career goal, so "Backend
 * Developer Intern" still matches the goal "Backend Developer". Role nouns like
 * "developer" and "engineer" are deliberately kept — they are the signal.
 */
const TITLE_NOISE = new Set([
  'intern', 'internship', 'trainee', 'junior', 'entry', 'level', 'fresher',
  'remote', 'onsite', 'hybrid', 'full', 'time', 'part', 'and', 'the', 'for',
  'with', 'a', 'an', 'of', 'in', 'at', 'to', 'i', 'ii',
]);

const tokenise = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token.length > 1 && !TITLE_NOISE.has(token));

/**
 * How much of `goal` appears in `posting`, as a share of the goal's own words.
 *
 * Directional on purpose: "Backend Developer" inside "Backend Developer Intern"
 * is a full match (2 of 2 goal words found), while the reverse framing would
 * score it 2/3 and read as a partial match for no good reason.
 */
const titleOverlap = (goal, posting) => {
  const goalTokens = tokenise(goal);
  if (goalTokens.length === 0) return 0;

  const postingTokens = new Set(tokenise(posting));
  const hits = goalTokens.filter((token) => postingTokens.has(token)).length;

  return hits / goalTokens.length;
};

/**
 * The skill half of the match: weighted, capped attainment over what the posting
 * requires, plus the matched and missing lists that explain it.
 */
const scoreSkills = ({ requiredSkills = [], preferredSkills = [] }, levelBySkillId) => {
  const rowFor = (entry, isPreferred) => {
    const skillId = String(entry.skillId);
    const held = levelBySkillId.get(skillId) ?? null;

    const studentLevel = held ? Number(held.level) || 0 : 0;
    const requiredLevel = Number(entry.requiredLevel) || 0;
    const importanceWeight = Number(entry.importanceWeight) || 0;

    const gap = Math.max(0, requiredLevel - studentLevel);

    // A requirement of zero is met by definition; dividing by it would produce
    // Infinity and poison the average.
    const attainment = requiredLevel === 0 ? 1 : Math.min(studentLevel / requiredLevel, 1);

    return {
      skillId,
      name: entry.name ?? 'Skill',
      category: entry.category,
      requiredLevel,
      studentLevel,
      importanceWeight,
      gap,
      attainmentPercent: Math.round(attainment * 100),
      isMeasured: Boolean(held),
      isVerified: Boolean(held?.verified),
      isPreferred,
    };
  };

  const required = requiredSkills.map((entry) => rowFor(entry, false));
  const preferred = preferredSkills.map((entry) => rowFor(entry, true));

  const totalWeight = required.reduce((sum, row) => sum + row.importanceWeight, 0);

  // Every weight zero (or no required skills at all) would make this 0/0.
  // Falling back to an unweighted mean keeps a hand-entered posting usable.
  const weightFor = (row) => (totalWeight > 0 ? row.importanceWeight : 1);
  const weightSum = totalWeight > 0 ? totalWeight : required.length;

  const earned = required.reduce(
    (sum, row) => sum + weightFor(row) * (row.attainmentPercent / 100),
    0,
  );

  /**
   * A posting with no required skills asks nothing, so nothing is unmet. Scoring
   * it 0 would bury the most open opportunities in the list.
   */
  const share = weightSum === 0 ? 1 : earned / weightSum;

  const byImportance = (a, b) =>
    b.importanceWeight - a.importanceWeight || b.gap - a.gap || a.name.localeCompare(b.name);
  const byGap = (a, b) =>
    b.gap - a.gap || b.importanceWeight - a.importanceWeight || a.name.localeCompare(b.name);

  const all = [...required, ...preferred];

  return {
    share,
    matchedSkills: all.filter((row) => row.gap === 0).sort(byImportance),
    missingSkills: all.filter((row) => row.gap > 0).sort(byGap),
    requiredCount: required.length,
    requiredMetCount: required.filter((row) => row.gap === 0).length,
    verifiedMatchCount: required.filter((row) => row.gap === 0 && row.isVerified).length,
  };
};

/**
 * The career-interest half: does this posting look like what the student said
 * they were aiming at?
 *
 * Two independent signals, and the better one wins rather than being averaged —
 * a posting titled exactly like the student's goal should not be marked down
 * because its skill list happens to be unusual.
 */
const scoreCareerInterest = (opportunity, { titles = [], skillIds = [] } = {}) => {
  const required = (opportunity.requiredSkills ?? []).map((entry) => String(entry.skillId));

  let bestTitle = null;
  let titleShare = 0;

  for (const title of titles) {
    const overlap = titleOverlap(title, opportunity.title);
    if (overlap > titleShare) {
      titleShare = overlap;
      bestTitle = title;
    }
  }

  const interestSkills = new Set(skillIds.map(String));
  const overlapping = required.filter((skillId) => interestSkills.has(skillId));
  const skillShare = required.length === 0 ? 0 : overlapping.length / required.length;

  const share = Math.max(titleShare, skillShare);

  let detail = 'Not obviously related to the goals on your profile.';
  if (titleShare >= skillShare && titleShare > 0) {
    detail = `Lines up with your "${bestTitle}" goal.`;
  } else if (skillShare > 0) {
    detail = `Asks for ${overlapping.length} of the ${required.length} skills your career goals need.`;
  }

  return {
    share,
    detail,
    matchedGoal: titleShare > 0 ? bestTitle : null,
    goalSkillOverlap: overlapping.length,
  };
};

/**
 * The eligibility half: the employer's own stated rules, checked one at a time.
 *
 * A rule the posting does not state is not a rule — an empty `branches` array
 * means open to all branches, so it produces no check rather than a failed one.
 * A rule that cannot be checked because the profile is missing the field fails,
 * but is flagged `isUnknown` so the UI can say "add your graduation year"
 * instead of "you are not eligible".
 */
const scoreEligibility = (opportunity, student) => {
  const eligibility = opportunity.eligibility ?? {};
  const branches = eligibility.branches ?? [];
  const rules = [];

  if (branches.length > 0) {
    const studentBranch = String(student.branch ?? '').trim().toLowerCase();
    rules.push({
      key: 'branch',
      label: `Open to ${branches.join(', ')}`,
      passed:
        studentBranch.length > 0 &&
        branches.some((branch) => String(branch).trim().toLowerCase() === studentBranch),
      isUnknown: !student.branch,
    });
  }

  const graduationYear = Number(student.graduationYear) || null;

  if (eligibility.minGraduationYear != null) {
    rules.push({
      key: 'minGraduationYear',
      label: `Graduating ${eligibility.minGraduationYear} or later`,
      passed: graduationYear != null && graduationYear >= eligibility.minGraduationYear,
      isUnknown: graduationYear == null,
    });
  }

  if (eligibility.maxGraduationYear != null) {
    rules.push({
      key: 'maxGraduationYear',
      label: `Graduating ${eligibility.maxGraduationYear} or earlier`,
      passed: graduationYear != null && graduationYear <= eligibility.maxGraduationYear,
      isUnknown: graduationYear == null,
    });
  }

  const passedCount = rules.filter((rule) => rule.passed).length;

  return {
    // No stated rules means nothing excludes this student, which is full marks
    // rather than zero — the absence of a restriction is not a failure to meet one.
    share: rules.length === 0 ? 1 : passedCount / rules.length,
    rules,
    isEligible: rules.every((rule) => rule.passed),
    hasUnknowns: rules.some((rule) => rule.isUnknown),
    detail:
      rules.length === 0
        ? 'No branch or graduation-year restrictions on this posting.'
        : `You meet ${passedCount} of the ${rules.length} stated requirements.`,
  };
};

/**
 * The sentence a student actually reads.
 *
 * Built from the same numbers as the score, and eligibility overrides the band:
 * a 90% skill match that fails the employer's own stated rules must not say
 * "apply now", because the answer would be no.
 */
const buildRecommendation = ({ score, skills, eligibility }) => {
  const band = matchBand(score);
  const topMissing = skills.missingSkills.find((row) => !row.isPreferred) ?? null;

  if (!eligibility.isEligible) {
    return eligibility.hasUnknowns
      ? 'Your profile is missing the details this employer screens on — add them to know where you stand.'
      : 'You do not meet the eligibility this employer has stated, so the skill match is academic here.';
  }

  if (band === 'strong') {
    return skills.missingSkills.length === 0
      ? 'Strong match — you meet everything this posting asks for. Apply.'
      : `Strong match — apply, and mention how you are covering ${topMissing?.name ?? 'the remaining gap'}.`;
  }

  if (band === 'good') {
    return topMissing
      ? `Good match — worth applying. ${topMissing.name} is the one gap likely to come up.`
      : 'Good match — worth applying.';
  }

  if (band === 'possible') {
    return topMissing
      ? `Possible match — closing ${topMissing.name} (${topMissing.studentLevel} of ${topMissing.requiredLevel}) would move this most.`
      : 'Possible match — a fuller profile would sharpen this.';
  }

  return topMissing
    ? `A stretch for now — ${topMissing.name} is ${topMissing.gap} points short of what this role needs.`
    : 'A stretch for now — build up the skills this posting asks for first.';
};

/**
 * Short, factual reasons this posting is a match. Strings, because they are read
 * rather than computed with, and every one of them is derived from a number
 * already in the breakdown.
 */
const buildStrengths = ({ skills, career, eligibility, student }) => {
  const strengths = [];

  if (skills.requiredCount > 0 && skills.requiredMetCount > 0) {
    strengths.push(
      `${skills.requiredMetCount} of ${skills.requiredCount} required skills already at the level asked for`,
    );
  }

  const best = skills.matchedSkills.find((row) => !row.isPreferred);
  if (best) {
    strengths.push(
      `${best.name} at ${best.studentLevel} where ${best.requiredLevel} is asked for`,
    );
  }

  if (skills.verifiedMatchCount > 0) {
    strengths.push(
      `${skills.verifiedMatchCount} matched ${skills.verifiedMatchCount === 1 ? 'skill is' : 'skills are'} verified by assessment`,
    );
  }

  if (career.matchedGoal) {
    strengths.push(`Matches your "${career.matchedGoal}" career goal`);
  } else if (career.goalSkillOverlap > 0) {
    strengths.push(`Overlaps ${career.goalSkillOverlap} skills your career goals need`);
  }

  if (eligibility.rules.length > 0 && eligibility.isEligible) {
    strengths.push('You meet the eligibility this employer stated');
  }

  if (Number(student.profileCompletion) >= 80) {
    strengths.push('Your profile is complete enough for an employer to assess you');
  }

  return strengths;
};

/**
 * The whole match for one student against one opportunity. Pure.
 *
 * @param {{opportunity: object, student: {skills: Array<object>, branch?: string,
 *          graduationYear?: number, profileCompletion?: number,
 *          careerInterest?: {titles: Array<string>, skillIds: Array<string>}}}} input
 * @returns {{matchScore: number, matchedSkills: Array<object>,
 *            missingSkills: Array<object>, strengths: Array<string>,
 *            recommendation: string, recommendationLevel: string,
 *            breakdown: Array<object>, isEligible: boolean}}
 */
export const calculateMatch = ({ opportunity, student = {} } = {}) => {
  if (!opportunity) throw new Error('calculateMatch needs an opportunity');

  const levelBySkillId = new Map(
    (student.skills ?? []).map((entry) => [String(entry.skillId), entry]),
  );

  const skills = scoreSkills(opportunity, levelBySkillId);
  const career = scoreCareerInterest(opportunity, student.careerInterest);
  const eligibility = scoreEligibility(opportunity, student);

  const completion = Math.min(Math.max(Number(student.profileCompletion) || 0, 0), 100);
  const completenessShare = completion / 100;

  const parts = [
    {
      key: 'skills',
      label: 'Skill match',
      weight: MATCH_WEIGHTS.skills,
      share: skills.share,
      detail:
        skills.requiredCount === 0
          ? 'This posting lists no required skills.'
          : `${skills.requiredMetCount} of ${skills.requiredCount} required skills met, weighted by how much the role leans on each.`,
    },
    {
      key: 'careerInterest',
      label: 'Career interest',
      weight: MATCH_WEIGHTS.careerInterest,
      share: career.share,
      detail: career.detail,
    },
    {
      key: 'eligibility',
      label: 'Eligibility',
      weight: MATCH_WEIGHTS.eligibility,
      share: eligibility.share,
      detail: eligibility.detail,
    },
    {
      key: 'profileCompleteness',
      label: 'Profile completeness',
      weight: MATCH_WEIGHTS.profileCompleteness,
      share: completenessShare,
      detail: `Your profile is ${completion}% complete.`,
    },
  ];

  const breakdown = parts.map((part) => ({
    ...part,
    /** Points this part contributed, out of `weight`. Rounded for display only. */
    earned: Math.round(part.weight * part.share),
    sharePercent: Math.round(part.share * 100),
  }));

  // Summed from the unrounded shares, so the four rounded `earned` values can
  // differ from the total by a point without the total itself being wrong.
  const matchScore = Math.round(
    parts.reduce((sum, part) => sum + part.weight * part.share, 0),
  );

  return {
    matchScore,
    matchedSkills: skills.matchedSkills,
    missingSkills: skills.missingSkills,
    strengths: buildStrengths({ skills, career, eligibility, student }),
    recommendation: buildRecommendation({ score: matchScore, skills, eligibility }),
    recommendationLevel: matchBand(matchScore),
    isEligible: eligibility.isEligible,
    eligibilityRules: eligibility.rules,
    breakdown,
  };
};

/**
 * Everything about the student that matching reads, gathered once.
 *
 * Career interest needs the *skills* behind the student's target roles, not just
 * their titles, which is one extra query — done here rather than per opportunity,
 * because doing it inside the scoring loop would be one query per posting.
 *
 * @returns {Promise<object|null>} null when there is no profile yet
 */
const loadStudentContext = async (studentId) => {
  const profile = await StudentProfile.findOne({ userId: studentId });
  if (!profile) return null;

  const goals = [...(profile.targetRoles ?? [])].sort(
    (a, b) => (a.priority ?? 99) - (b.priority ?? 99),
  );

  const roleIds = goals.map((goal) => goal.roleId).filter(Boolean);

  let interestSkillIds = [];
  if (roleIds.length > 0) {
    const roles = await CareerRole.find({ _id: { $in: roleIds } })
      .select('requiredSkills.skillId')
      .lean();

    interestSkillIds = [
      ...new Set(
        roles.flatMap((role) =>
          (role.requiredSkills ?? []).map((requirement) => String(requirement.skillId)),
        ),
      ),
    ];
  }

  return {
    skills: (profile.skills ?? []).map((entry) => ({
      skillId: entry.skillId,
      level: entry.level,
      verified: entry.verified,
      source: entry.source,
    })),
    branch: profile.branch,
    graduationYear: profile.graduationYear,
    profileCompletion: profile.profileCompletion,
    careerInterest: {
      // Interests are free text the student typed, so they are weaker than a
      // chosen role — but they are the only signal a student with no career goal
      // has, and a title match is a title match.
      titles: [...goals.map((goal) => goal.title).filter(Boolean), ...(profile.interests ?? [])],
      skillIds: interestSkillIds,
    },
  };
};

/** The same "live posting" predicate the rest of the app uses. */
const liveFilter = (now) => ({
  status: OPPORTUNITY_STATUSES.ACTIVE,
  deadline: { $gte: now },
});

/**
 * The student's ranked matches across every live posting.
 *
 * @param {{studentId: string, limit?: number}} input
 * @returns {Promise<{matches: Array<object>, consideredCount: number,
 *                    reason: string|null}>}
 */
export const getMatchesForStudent = async ({ studentId, limit = MATCH_LIMIT } = {}) => {
  const student = await loadStudentContext(studentId);
  if (!student) return { matches: [], consideredCount: 0, reason: 'no-profile' };

  const now = new Date();
  const docs = await Opportunity.find(liveFilter(now))
    .populate(POPULATE_REFS)
    .sort({ deadline: 1 })
    .limit(CANDIDATE_CAP);

  const scored = docs.map((doc) => {
    const opportunity = doc.toPublicObject();
    return { opportunity, match: calculateMatch({ opportunity, student }) };
  });

  scored.sort(
    (a, b) =>
      b.match.matchScore - a.match.matchScore ||
      new Date(a.opportunity.deadline) - new Date(b.opportunity.deadline) ||
      a.opportunity.title.localeCompare(b.opportunity.title),
  );

  return {
    matches: scored.slice(0, Math.max(1, Number(limit) || MATCH_LIMIT)),
    consideredCount: scored.length,
    reason: null,
  };
};

/**
 * One student against one opportunity — the breakdown behind a single posting.
 *
 * Works for a closed or expired posting too: a student who followed a link
 * deserves to see why it did or did not fit, and the availability warning is
 * already the detail page's job.
 *
 * @param {{studentId: string, opportunityId: string}} input
 * @returns {Promise<{match: object|null, opportunity: object|null, reason: string|null}>}
 */
export const getMatchForStudent = async ({ studentId, opportunityId } = {}) => {
  const doc = await Opportunity.findById(opportunityId).populate(POPULATE_REFS);
  if (!doc) throw AppError.notFound('That opportunity could not be found.');

  const student = await loadStudentContext(studentId);
  const opportunity = doc.toPublicObject();

  if (!student) return { match: null, opportunity, reason: 'no-profile' };

  return { match: calculateMatch({ opportunity, student }), opportunity, reason: null };
};

export default {
  MATCH_WEIGHTS,
  MATCH_LIMIT,
  calculateMatch,
  getMatchesForStudent,
  getMatchForStudent,
};
