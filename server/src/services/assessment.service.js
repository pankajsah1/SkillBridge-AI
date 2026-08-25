/**
 * Assessment service — starting a paper, scoring it, and writing the result onto
 * the student's skill profile.
 *
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE: every number a student sees is
 * arithmetic they could check by hand. A skill score is the mean of the option
 * weights they earned on that skill's questions. The overall score is the mean
 * across every question. No model is consulted for either. The AI layer, when it
 * is configured at all, only ever supplies question *text* — see
 * services/ai/assessmentAi.js.
 *
 * WHY SCORES ARE WRITTEN INTO StudentProfile.skills. Phase 3's gap analysis
 * subtracts `studentLevel` from `requiredLevel`, and Phase 5's matching reads the
 * same field. If assessed scores lived only on the attempt, both would need to
 * know about assessments, and a student with two attempts would have two truths.
 * The profile stays the single place "how good is this student at X" is answered;
 * the attempt is the evidence behind it.
 *
 * ASSESSED SCORES OVERWRITE SELF-REPORTED ONES. A student who claimed 90 and
 * scored 40 ends up at 40, with `source: 'assessment'` and `verified: true`.
 * That is the point of assessing. Skills the paper did not cover are untouched.
 */

import mongoose from 'mongoose';

import Assessment from '../models/Assessment.js';
import CareerRole from '../models/CareerRole.js';
import Skill from '../models/Skill.js';
import StudentProfile from '../models/StudentProfile.js';
import AppError from '../utils/AppError.js';
import {
  ASSESSMENT_STATUSES,
  DEFAULT_QUESTION_COUNT,
  OPTION_SCORES,
  QUESTION_SOURCES,
  UNANSWERED_SCORE,
} from '../constants/assessments.js';
import { SKILL_SOURCES } from '../constants/skills.js';
import { QUESTIONS_BY_SKILL_SLUG } from '../data/questionBank.seed.js';
import { generateAssessmentQuestions } from './ai/assessmentAi.js';

/**
 * The skills a student with no career goal is measured on.
 *
 * Breadth over depth: enough to produce a meaningful first result and a career
 * recommendation, without pretending to know what they are aiming at. Refusing
 * to start an assessment until a goal is set would block the first thing a new
 * user wants to do.
 */
const GENERAL_SKILL_SLUGS = Object.freeze([
  'javascript',
  'data-structures-algorithms',
  'git',
  'sql',
  'problem-solving',
  'communication',
  'html',
  'python',
  'rest-api-design',
  'linux',
]);

/**
 * A tiny seeded PRNG (mulberry32).
 *
 * Seeded rather than Math.random so a shuffle can be reproduced in a test — an
 * assertion about question distribution is worthless if the input is different
 * every run. The seed varies per attempt, so two attempts still differ.
 */
const createRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Fisher-Yates on a copy. The input array is frozen bank data. */
const shuffled = (items, random) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * Picks `count` questions spread across the skill pool.
 *
 * Round-robin rather than proportional-to-weight: with ten questions and seven
 * skills, weighting would give the top skill four questions and leave two skills
 * unmeasured, so the result would report a gap of zero on skills nobody was asked
 * about. One pass each, highest-importance first, then a second pass for the
 * remainder — every skill in the pool gets at least one question before any skill
 * gets two.
 *
 * Pure and seeded, so it is testable without a database.
 */
export const selectBankQuestions = ({ skillPool, count, seed = 1 }) => {
  const random = createRandom(seed);

  // Each pool entry keeps its own shuffled queue of available bank questions.
  const queues = skillPool
    .map((skill) => ({
      skill,
      queue: shuffled(QUESTIONS_BY_SKILL_SLUG[skill.slug] ?? [], random),
    }))
    .filter((entry) => entry.queue.length > 0);

  if (queues.length === 0) return [];

  const picked = [];
  let exhausted = false;

  while (picked.length < count && !exhausted) {
    exhausted = true;
    for (const entry of queues) {
      if (picked.length >= count) break;
      const next = entry.queue.shift();
      if (!next) continue;
      exhausted = false;
      picked.push({ ...next, skill: entry.skill });
    }
  }

  return picked;
};

/**
 * Shuffles a question's options and records where the weights landed.
 *
 * The bank authors options best-first for readability. Serving them in that order
 * would make the paper trivially gameable and make the app look broken to anyone
 * who noticed. Weights travel with their text, so shuffling cannot change what an
 * answer is worth.
 */
const shuffleOptions = (options, random) =>
  shuffled(
    options.map((option) => ({ text: option.text, score: option.score })),
    random,
  );

/** Resolves the career role for this attempt, or null for a general paper. */
const resolveCareerRole = async ({ careerRoleId, profile }) => {
  if (careerRoleId) {
    const role = await CareerRole.findOne({ _id: careerRoleId, isActive: true });
    if (!role) throw AppError.notFound('That career role could not be found.');
    return role;
  }

  // Fall back to the student's highest-priority stated goal (priority 1 is top).
  const goals = [...(profile?.targetRoles ?? [])].sort(
    (a, b) => (a.priority ?? 99) - (b.priority ?? 99),
  );
  if (goals.length === 0) return null;

  return CareerRole.findOne({ _id: goals[0].roleId, isActive: true });
};

/**
 * Builds the ordered skill pool for a paper: `{ id, slug, name, category }`,
 * most important first.
 *
 * Only skills the bank can actually ask about are kept, because a skill in the
 * pool with no questions would take a round-robin slot and contribute nothing.
 */
const buildSkillPool = async (careerRole) => {
  // A career role references skills by ObjectId; the general fallback list
  // references them by slug. Both end up as an ordered array of Skill documents.
  const requiredSkillIds = careerRole
    ? [...careerRole.requiredSkills]
        .sort((a, b) => (b.importanceWeight ?? 0) - (a.importanceWeight ?? 0))
        .map((requirement) => requirement.skillId)
    : [];

  const query = careerRole
    ? { _id: { $in: requiredSkillIds }, isActive: true }
    : { slug: { $in: [...GENERAL_SKILL_SLUGS] }, isActive: true };

  const skills = await Skill.find(query);
  const bySkillId = new Map(skills.map((skill) => [skill._id.toString(), skill]));
  const bySlug = new Map(skills.map((skill) => [skill.slug, skill]));

  const ordered = careerRole
    ? requiredSkillIds.map((id) => bySkillId.get(id.toString())).filter(Boolean)
    : GENERAL_SKILL_SLUGS.map((slug) => bySlug.get(slug)).filter(Boolean);

  return ordered
    .filter((skill) => (QUESTIONS_BY_SKILL_SLUG[skill.slug] ?? []).length > 0)
    .map((skill) => ({
      id: skill._id,
      slug: skill.slug,
      name: skill.name,
      category: skill.category,
    }));
};

/**
 * POST /assessments — starts an attempt and returns the paper.
 *
 * An existing in-progress attempt is returned rather than duplicated. A student
 * who reloads mid-paper should find their paper, not a fresh one; and two open
 * attempts would make "my latest result" ambiguous.
 */
export const startAssessment = async ({ studentId, careerRoleId, questionCount } = {}) => {
  const count = questionCount ?? DEFAULT_QUESTION_COUNT;

  const existing = await Assessment.findOne({
    studentId,
    status: ASSESSMENT_STATUSES.IN_PROGRESS,
  }).sort({ createdAt: -1 });

  if (existing) return { assessment: existing, resumed: true };

  const profile = await StudentProfile.findOne({ userId: studentId });
  const careerRole = await resolveCareerRole({ careerRoleId, profile });
  const skillPool = await buildSkillPool(careerRole);

  if (skillPool.length === 0) {
    // Only reachable on an unseeded database, and the message says so rather
    // than leaving a presenter staring at "no questions available".
    throw AppError.unprocessable(
      'No assessable skills were found. Run `npm run seed` to load the skill catalogue.',
    );
  }

  const seed = Date.now() ^ Number.parseInt(String(studentId).slice(-6), 16);
  const random = createRandom(seed);

  // AI first when configured, bank otherwise — and bank again if AI disappoints.
  const generated = await generateAssessmentQuestions({
    careerRole: careerRole?.title ?? '',
    skills: skillPool.map((skill) => ({ slug: skill.slug, name: skill.name })),
    count,
  });

  const bySlug = new Map(skillPool.map((skill) => [skill.slug, skill]));

  const chosen = generated
    ? generated.map((question) => ({ ...question, skill: bySlug.get(question.skillSlug) }))
    : selectBankQuestions({ skillPool, count, seed });

  const questions = chosen
    .filter((question) => question.skill)
    .map((question) => ({
      bankId: question.bankId ?? '',
      questionText: question.questionText,
      skillId: question.skill.id,
      skillName: question.skill.name,
      skillSlug: question.skill.slug,
      category: question.skill.category,
      difficulty: question.difficulty,
      options: shuffleOptions(question.options, random),
      selectedOptionIndex: null,
    }));

  if (questions.length === 0) {
    throw AppError.unprocessable('No assessment questions could be prepared. Please try again.');
  }

  const assessment = await Assessment.create({
    studentId,
    careerRoleId: careerRole?._id ?? null,
    careerRoleTitle: careerRole?.title ?? '',
    status: ASSESSMENT_STATUSES.IN_PROGRESS,
    questionSource: generated ? QUESTION_SOURCES.AI : QUESTION_SOURCES.BANK,
    questions,
    startedAt: new Date(),
  });

  return { assessment, resumed: false };
};

/** Loads an attempt, refusing to reach across students. */
export const getAssessmentForStudent = async ({ studentId, assessmentId }) => {
  const assessment = await Assessment.findOne({ _id: assessmentId, studentId });

  // 404 rather than 403 for another student's attempt: a distinguishable 403
  // would confirm the id exists, which is exactly what an id-probing attacker
  // wants. Nothing about someone else's attempt should be observable.
  if (!assessment) throw AppError.notFound('That assessment could not be found.');

  return assessment;
};

/**
 * Turns answers into scores. Pure, so the arithmetic is testable without a
 * database and without Express.
 *
 * Per skill: the mean of the weights earned on that skill's questions, rounded.
 * Overall: the mean across all questions, rounded. Unanswered scores zero rather
 * than being excluded — dropping it would let a student raise their score by
 * skipping what they do not know.
 */
export const scoreAnswers = ({ questions }) => {
  const bySkill = new Map();
  let total = 0;
  let answeredCount = 0;

  for (const question of questions) {
    const index = question.selectedOptionIndex;
    const selected =
      index === null || index === undefined ? null : question.options[index] ?? null;
    const awarded = selected ? selected.score : UNANSWERED_SCORE;
    const bestScore = question.options.reduce((best, option) => Math.max(best, option.score), 0);

    if (selected) answeredCount += 1;
    total += awarded;

    const key = question.skillId.toString();
    const entry = bySkill.get(key) ?? {
      skillId: question.skillId,
      skillName: question.skillName,
      skillSlug: question.skillSlug,
      category: question.category,
      earned: 0,
      questionCount: 0,
      correctCount: 0,
    };

    entry.earned += awarded;
    entry.questionCount += 1;
    if (awarded === bestScore && bestScore > 0) entry.correctCount += 1;
    bySkill.set(key, entry);
  }

  const skillScores = [...bySkill.values()]
    .map((entry) => ({
      skillId: entry.skillId,
      skillName: entry.skillName,
      skillSlug: entry.skillSlug,
      category: entry.category,
      score: Math.round(entry.earned / entry.questionCount),
      questionCount: entry.questionCount,
      correctCount: entry.correctCount,
    }))
    .sort((a, b) => b.score - a.score || a.skillName.localeCompare(b.skillName));

  const overallScore = questions.length === 0 ? 0 : Math.round(total / questions.length);

  return { skillScores, overallScore, answeredCount };
};

/**
 * Writes assessed scores onto the profile.
 *
 * Returns whether a profile was found. A student can be assessed before creating
 * a profile; that is a missing destination, not an error, and failing the
 * submission would lose their answers over a technicality.
 */
export const applySkillScoresToProfile = async ({ studentId, skillScores }) => {
  const profile = await StudentProfile.findOne({ userId: studentId });
  if (!profile) return { profileUpdated: false, updatedSkillCount: 0 };

  const existingBySkillId = new Map(
    profile.skills.map((entry) => [entry.skillId.toString(), entry]),
  );

  for (const scored of skillScores) {
    const key = scored.skillId.toString();
    const existing = existingBySkillId.get(key);

    if (existing) {
      existing.level = scored.score;
      existing.source = SKILL_SOURCES.ASSESSMENT;
      existing.verified = true;
    } else {
      profile.skills.push({
        skillId: scored.skillId,
        level: scored.score,
        source: SKILL_SOURCES.ASSESSMENT,
        verified: true,
      });
    }
  }

  // Adding skills changes profile completeness, which the dashboard displays.
  if (typeof profile.recomputeCompletion === 'function') profile.recomputeCompletion();
  await profile.save();

  return { profileUpdated: true, updatedSkillCount: skillScores.length };
};

/**
 * POST /assessments/:assessmentId/submit
 *
 * Answers arrive as `[{ questionIndex, optionIndex }]` — indices into the
 * snapshot on the attempt, so a client cannot submit an answer to a question it
 * was never served, and cannot smuggle in a score.
 */
export const submitAssessment = async ({ studentId, assessmentId, answers = [] }) => {
  const assessment = await getAssessmentForStudent({ studentId, assessmentId });

  // Resubmission is a conflict, not an update. Rescoring a submitted attempt
  // would rewrite the profile from a paper the student has already seen the
  // answers to.
  if (assessment.status === ASSESSMENT_STATUSES.SUBMITTED) {
    throw AppError.conflict('This assessment has already been submitted.');
  }

  for (const { questionIndex, optionIndex } of answers) {
    const question = assessment.questions[questionIndex];
    if (!question) {
      throw AppError.badRequest(`There is no question at position ${questionIndex}.`, [
        { field: 'answers', message: `Question ${questionIndex} is not part of this assessment.` },
      ]);
    }
    if (optionIndex < 0 || optionIndex >= question.options.length) {
      throw AppError.badRequest(`Option ${optionIndex} is not offered on question ${questionIndex}.`, [
        {
          field: 'answers',
          message: `Question ${questionIndex} has ${question.options.length} options.`,
        },
      ]);
    }
    question.selectedOptionIndex = optionIndex;
  }

  const { skillScores, overallScore, answeredCount } = scoreAnswers({
    questions: assessment.questions,
  });

  assessment.skillScores = skillScores;
  assessment.overallScore = overallScore;
  assessment.answeredCount = answeredCount;
  assessment.status = ASSESSMENT_STATUSES.SUBMITTED;
  assessment.submittedAt = new Date();
  await assessment.save();

  const { profileUpdated, updatedSkillCount } = await applySkillScoresToProfile({
    studentId,
    skillScores,
  });

  return { assessment, profileUpdated, updatedSkillCount };
};

/** GET /assessments — the student's own history, newest first. */
export const listAssessmentsForStudent = async ({ studentId, page = 1, limit = 10 } = {}) => {
  const currentPage = Math.max(1, Number(page) || 1);
  const perPage = Math.min(50, Math.max(1, Number(limit) || 10));

  const filter = { studentId };
  const [assessments, total] = await Promise.all([
    Assessment.find(filter)
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage),
    Assessment.countDocuments(filter),
  ]);

  return { assessments, total, page: currentPage, limit: perPage };
};

/**
 * The most recent submitted attempt, or null.
 *
 * Null rather than 404: "you have not been assessed yet" is a normal state for
 * every new student, and a dashboard should render an invitation, not an error.
 */
export const getLatestSubmittedAssessment = async ({ studentId }) =>
  Assessment.findOne({ studentId, status: ASSESSMENT_STATUSES.SUBMITTED }).sort({
    submittedAt: -1,
  });

/** Abandons an in-progress attempt so a student can restart with a fresh paper. */
export const abandonAssessment = async ({ studentId, assessmentId }) => {
  const assessment = await getAssessmentForStudent({ studentId, assessmentId });

  if (assessment.status === ASSESSMENT_STATUSES.SUBMITTED) {
    throw AppError.conflict('A submitted assessment cannot be discarded.');
  }

  assessment.status = ASSESSMENT_STATUSES.ABANDONED;
  await assessment.save();

  return assessment;
};

/** Exported for tests and for the option weights a paper is built from. */
export const OPTION_WEIGHTS = OPTION_SCORES;

/** Exported so a test can assert the pool logic without going through HTTP. */
export { buildSkillPool, createRandom, GENERAL_SKILL_SLUGS, resolveCareerRole };

export default {
  abandonAssessment,
  getAssessmentForStudent,
  getLatestSubmittedAssessment,
  listAssessmentsForStudent,
  startAssessment,
  submitAssessment,
};

/** Guards against an id that is not an ObjectId reaching a query. */
export const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
