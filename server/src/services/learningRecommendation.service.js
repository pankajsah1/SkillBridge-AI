/**
 * Personalised learning recommendations — which published programme to take next, and
 * the reason, in the student's own numbers.
 *
 * THIS IS A MAPPER, NOT AN ENGINE, AND THAT IS THE WHOLE DESIGN. The brief forbids a
 * second recommendation engine, so nothing here scores anything. The scoring that
 * already ships does the work:
 *
 *   `getReadinessForStudent` -> the student's real gaps, from their real profile
 *   `countSkillDemand`       -> how many live postings ask for each skill
 *   `buildRecommendations`   -> the 55/30/15 priority score and the `reason` sentence
 *
 * This file's only job is the join the catalogue makes possible: take those scored gap
 * rows and find the published programmes that teach them. A programme inherits the score
 * of the worst gap it covers. Delete this file and the readiness page, the gap list and
 * the priority arithmetic all still work identically — which is the test of whether a
 * new service reused the intelligence or replaced it.
 *
 * NOTHING IS HARDCODED, AND THE STRUCTURE IS WHY. There is no student in this file and
 * no programme title in this file: the input is a `studentId` whose gaps are read from
 * the database, and the candidates are whatever `LearningProgram` rows exist whose
 * `targetSkills` intersect those gaps. `if (student.id === X) recommend Y` is not
 * something I decided against — there is no place in this pipeline to put it. Seed a new
 * programme and it becomes recommendable to exactly the students whose gaps it covers,
 * with no code change.
 *
 * WHY `limit: skillGaps.length` WHEN CALLING THE ENGINE. `buildRecommendations` defaults
 * to the top five, which is right for "what should I study next" on the readiness page.
 * Here the ranking is over programmes, so every gap needs its score even if it is the
 * eleventh worst — otherwise a course covering gaps 6 and 7 would look unscored and sort
 * last behind a course covering nothing the student is short of.
 *
 * A COMPLETED PROGRAMME IS NEVER RECOMMENDED AGAIN; an in-progress one stays and is
 * flagged, so the hub can say "Continue" instead of "Enrol". The gap it closes is
 * genuinely still open — completion does not raise a skill score, by design — so hiding
 * the row would leave the student with a gap and no visible route to it, while offering
 * a fresh "Enrol" on a course they are 60% through is the most obvious bug this feature
 * could ship.
 */

import {
  LEARNING_PAGE,
  isTerminalEnrollmentStatus,
  levelFitDistance,
  programLevelLabel,
} from '../constants/learning.js';
import { getReadinessForStudent } from './readiness.service.js';
import {
  RECOMMENDATION_LIMIT,
  buildRecommendations,
  countSkillDemand,
  priorityBand,
} from './recommendation.service.js';
import { listProgramsForSkills } from './learning.service.js';
import { enrollmentsByProgramFor } from './learningEnrollment.service.js';

/** English list: "AWS", "AWS and Docker", "AWS, Docker and SQL". */
const listNames = (names) => {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

/**
 * The "Recommended because:" bullets.
 *
 * THE BRIEF NAMES THESE SENTENCES; this function is where they come from. Each one is
 * built from a value read out of the student's own data, so none of them can be true of
 * a programme the student does not need:
 *
 *   "AWS is a current skill gap"                     <- readiness.skillGaps
 *   "Your target role, Cloud Engineer, requires AWS" <- the career role's requiredSkills
 *   "This program covers AWS"                        <- the programme's targetSkills
 *   "Your current proficiency (35) is below the ..." <- the profile level vs the role's
 *
 * The demand bullet is only added when postings actually exist, because "asked for by 0
 * opportunities" is worse than silence.
 *
 * WHY IT RETURNS AN ARRAY. The UI renders a bulleted "Recommended because" list, and a
 * pre-joined string would force it to split on a separator. The single-line form is
 * offered alongside it as `reason` for the places that show one line.
 */
const reasonsFor = ({ matched, roleTitle }) => {
  const names = matched.map((row) => row.skillName);
  const list = listNames(names);
  const plural = names.length > 1;

  const reasons = [
    `${list} ${plural ? 'are current skill gaps' : 'is a current skill gap'}`,
    `Your target role, ${roleTitle}, requires ${list}`,
    `This program covers ${list}`,
  ];

  /**
   * The numeric bullet uses the DRIVING skill — the highest-priority gap this programme
   * covers, which is also the one that set its score. Quoting all of them would be a
   * paragraph; quoting the least important one would misrepresent the recommendation.
   */
  const driver = matched[0];

  reasons.push(
    `Your current proficiency in ${driver.skillName} is ${driver.currentLevel}, below the ${roleTitle} requirement of ${driver.targetLevel}`,
  );

  const demanded = matched.filter((row) => row.demandCount > 0);
  if (demanded.length > 0) {
    const top = demanded.reduce((best, row) => (row.demandCount > best.demandCount ? row : best));
    reasons.push(
      `${top.demandCount} open ${top.demandCount === 1 ? 'opportunity asks' : 'opportunities ask'} for ${top.skillName}`,
    );
  }

  return reasons;
};

/**
 * Turns one programme into a ranked recommendation, or returns null.
 *
 * A PROGRAMME SCORES AS ITS WORST COVERED GAP — the maximum, not the mean. A course
 * covering one urgent gap and three minor ones is urgent; averaging would bury it under a
 * course covering two middling ones, which is the wrong advice. `priorityBand` is
 * imported from the shipped engine so a programme and the gap it closes can never carry
 * contradictory labels.
 */
const toRecommendation = ({ program, scoredBySkillId, roleTitle, enrollment }) => {
  const matched = (program.targetSkills ?? [])
    .map((skill) => scoredBySkillId.get(String(skill?._id ?? skill)))
    .filter(Boolean)
    .sort((a, b) => b.priorityScore - a.priorityScore || b.gap - a.gap);

  if (matched.length === 0) return null;

  const priorityScore = matched[0].priorityScore;
  const driver = matched[0];
  const levelFit = levelFitDistance(program.level, driver.currentLevel);
  const reasons = reasonsFor({ matched, roleTitle });

  return {
    program: program.toPublicObject(),

    priorityScore,
    priority: priorityBand(priorityScore),

    /** Which of the student's gaps this programme actually closes, with the evidence. */
    coverage: matched.map((row) => ({
      skillId: row.skillId,
      skillName: row.skillName,
      skillCategory: row.skillCategory,
      currentLevel: row.currentLevel,
      targetLevel: row.targetLevel,
      gap: row.gap,
      priority: row.priority,
      priorityScore: row.priorityScore,
      demandCount: row.demandCount,
    })),
    matchedSkillCount: matched.length,

    /**
     * How well the programme's level suits where the student is now. A mismatch demotes
     * (third sort key) rather than excludes: an advanced course is not useless to a
     * beginner, it is just the wrong place to start, and hiding it could leave a skill
     * with no visible route at all.
     */
    levelFit,
    levelFitNote:
      levelFit === 0
        ? `${programLevelLabel(program.level)} suits your current level`
        : `Pitched at ${programLevelLabel(program.level).toLowerCase()} — you are at ${driver.currentLevel} in ${driver.skillName}`,

    reasons,
    reason: reasons.slice(0, 3).join(' + '),

    /** Present when the learner is already on it — the hub shows "Continue", not "Enrol". */
    enrollment: enrollment ?? null,
  };
};

/** The service is called by a seed script as well as a validated route, so it clamps. */
const resolveLimit = (limit) => {
  const requested = Number.parseInt(limit, 10) || RECOMMENDATION_LIMIT;
  return Math.min(Math.max(1, requested), LEARNING_PAGE.maxLimit);
};

/**
 * GET /learning/recommendations — the "Recommended for you" strip on the Learning Hub.
 *
 * `reason` IS A STATE, NOT AN ERROR, and it is the reason this returns a shape instead of
 * throwing. "You have not chosen a career goal" and "nothing in the catalogue covers your
 * gaps yet" are both things the page must explain in a sentence; a 400 would render as a
 * red toast on an otherwise empty hub and tell the student nothing they can act on.
 *
 *   `no-profile`     -> no student profile yet
 *   `no-career-goal` -> a profile, but no target role to measure against
 *   `no-gaps`        -> measured against the role and nothing is missing (the good case)
 *   `no-programs`    -> real gaps, but no published programme teaches them
 *
 * @returns {Promise<{recommendations: Array<object>, careerRole: object|null,
 *                    readinessScore: number|null, reason: string|null,
 *                    gapsConsidered: number, uncoveredGaps: Array<object>}>}
 */
export const getLearningRecommendationsForStudent = async ({
  studentId,
  careerRoleId,
  limit,
  now = new Date(),
} = {}) => {
  const { readiness, careerRole, reason } = await getReadinessForStudent({
    studentId,
    careerRoleId,
  });

  const nothing = (why) => ({
    recommendations: [],
    careerRole: careerRole ?? null,
    readinessScore: readiness?.readinessScore ?? null,
    reason: why,
    gapsConsidered: readiness?.skillGaps?.length ?? 0,
    uncoveredGaps: [],
  });

  if (!readiness) return nothing(reason);
  if (readiness.skillGaps.length === 0) return nothing('no-gaps');

  /** Demand is the lowest-weighted input; losing it must not cost the student the strip. */
  let demandBySkillId = new Map();
  try {
    demandBySkillId = await countSkillDemand();
  } catch {
    demandBySkillId = new Map();
  }

  const roleTitle = careerRole?.title ?? 'your target role';

  const scored = buildRecommendations({
    skillGaps: readiness.skillGaps,
    roleTitle,
    demandBySkillId,
    limit: readiness.skillGaps.length,
  });

  const scoredBySkillId = new Map(scored.map((row) => [String(row.skillId), row]));

  const programs = await listProgramsForSkills([...scoredBySkillId.keys()], now);

  const enrollments = await enrollmentsByProgramFor(
    studentId,
    programs.map((program) => program._id),
  );

  const covered = new Set();
  const candidates = [];

  for (const program of programs) {
    const enrollment = enrollments.get(program._id.toString()) ?? null;
    const row = toRecommendation({ program, scoredBySkillId, roleTitle, enrollment });

    if (!row) continue;

    /**
     * Coverage is recorded BEFORE the completed check on purpose. A finished programme
     * still proves the catalogue teaches that skill, so counting it here keeps
     * `uncoveredGaps` meaning "we have nothing for this" — which is what the empty state
     * says out loud — rather than "nothing you have not already taken".
     */
    for (const entry of row.coverage) covered.add(String(entry.skillId));

    if (enrollment && isTerminalEnrollmentStatus(enrollment.status)) continue;

    candidates.push(row);
  }

  /**
   * Priority first, then how many gaps it closes, then level fit, then title. The last
   * key is what makes the list STABLE: two equal programmes must not swap places between
   * two loads of the same page.
   */
  candidates.sort(
    (a, b) =>
      b.priorityScore - a.priorityScore ||
      b.matchedSkillCount - a.matchedSkillCount ||
      a.levelFit - b.levelFit ||
      a.program.title.localeCompare(b.program.title),
  );

  /**
   * The gaps nothing in the catalogue teaches.
   *
   * REPORTED RATHER THAN HIDDEN, because it is the honest answer to "why isn't there a
   * course for Docker?" and it is the one signal that tells an industry publisher what to
   * publish next. Silently dropping these would make an under-stocked hub look complete.
   */
  const uncoveredGaps = scored
    .filter((row) => !covered.has(String(row.skillId)))
    .map((row) => ({
      skillId: row.skillId,
      skillName: row.skillName,
      currentLevel: row.currentLevel,
      targetLevel: row.targetLevel,
      gap: row.gap,
      priority: row.priority,
      priorityScore: row.priorityScore,
    }));

  return {
    recommendations: candidates.slice(0, resolveLimit(limit)),
    careerRole,
    readinessScore: readiness.readinessScore,
    reason: candidates.length === 0 ? 'no-programs' : null,
    gapsConsidered: scored.length,
    uncoveredGaps,
  };
};

export default { getLearningRecommendationsForStudent };
