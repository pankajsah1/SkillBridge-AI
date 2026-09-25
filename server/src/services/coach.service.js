/**
 * coach.service.js — the explainable "AI Coach" and per-role Action Center.
 *
 * WHAT THIS IS, AND WHAT IT IS DELIBERATELY NOT (Step 10 §5, §6). This is a SMALL,
 * grounded explainability layer, not a chatbot and not a second brain. It answers a
 * fixed set of questions — "why am I not ready?", "what should I learn first?",
 * "which gaps matter most?", "why was this recommended?", "what should I focus on
 * this week?" — and it answers every one of them DETERMINISTICALLY from the numbers
 * the Step 1–9 services already compute. It invents nothing.
 *
 * IT OWNS NO INTELLIGENCE OF ITS OWN (§4 REUSE). Every figure comes from an existing
 * service: readiness from readiness.service, gaps and programme picks from
 * learningRecommendation.service, match scores and their breakdowns from
 * matching.service, learning progress from learningEnrollment.service, application
 * state from application.service, and the institution's own action list straight out
 * of institutionIntelligence.service. There is no second readiness formula, no second
 * matcher, no second skill catalogue here — this file only *narrates* what those
 * produce.
 *
 * THE LLM IS OPTIONAL POLISH, NEVER THE SOURCE (§6). The deterministic text below is
 * the real answer and always renders. When (and only when) an AI provider is
 * configured, `narrate()` may rephrase that text into a friendlier paragraph — but it
 * is handed the finished sentences and told to rewrite them, never to add facts, and
 * ANY failure (no key, dead network, empty reply) falls straight back to the
 * deterministic string. No number a student sees on this screen was produced by a
 * model. Completing a course is never described as raising a score; only reassessment
 * evidence does that, and the "what changed" answer says so out loud.
 *
 * THE PURE BUILDERS ARE EXPORTED FOR TESTING. `buildStudentExplanations`,
 * `buildStudentActions`, `buildIndustryActions` and `buildLearnerActionsFrom` take
 * plain grounding objects and return plain objects — no model, no connection, no
 * Express — so the offline verifier can feed them synthetic state and assert the exact
 * wording and priority without a database.
 */

import { getReadinessForStudent } from './readiness.service.js';
import { getMatchesForStudent, getMatchForStudent } from './matching.service.js';
import { getLearningRecommendationsForStudent } from './learningRecommendation.service.js';
import { getMyLearningSummary } from './learningEnrollment.service.js';
import { listMyApplications, getRecruitmentSummary } from './application.service.js';
import { getInstitutionIntelligence } from './institutionIntelligence.service.js';
import { requestCompletion } from './ai/aiProvider.js';
import { isAiConfigured } from '../config/env.js';
import { statusLabel } from '../constants/applications.js';
import ROLES, { isApplicantRole } from '../constants/roles.js';

/**
 * Action priority vocabulary, matching the institution intelligence layer so every
 * Action Center in the product speaks one language. CRITICAL first.
 */
export const ACTION_PRIORITIES = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
});

const PRIORITY_ORDER = [
  ACTION_PRIORITIES.CRITICAL,
  ACTION_PRIORITIES.HIGH,
  ACTION_PRIORITIES.MEDIUM,
  ACTION_PRIORITIES.LOW,
];

/** Stable "most urgent first" ordering, shared by every role's action list. */
const byPriority = (a, b) =>
  PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);

/** How many actions any one dashboard shows — §8 "do not overload dashboards". */
export const MAX_ACTIONS = 5;

/* ------------------------------------------------------------------ helpers */

/** "React, Docker and 2 more" — a readable list that never runs long. */
const nameList = (names = [], max = 3) => {
  const clean = names.filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length <= max) {
    if (clean.length === 1) return clean[0];
    return `${clean.slice(0, -1).join(', ')} and ${clean[clean.length - 1]}`;
  }
  const extra = clean.length - max;
  return `${clean.slice(0, max).join(', ')} and ${extra} more`;
};

/** A grounded explanation record. `grounded` is always true here — this layer
 *  cannot produce an ungrounded answer, and the flag says so to the client. */
const explain = (id, question, answer, evidence = {}) => ({
  id,
  question,
  answer,
  grounded: true,
  evidence,
});

/* --------------------------------------------------- student explanations */

/**
 * The student coach's fixed question set, answered from real numbers.
 *
 * @param {{readiness: object, learningRecs: object, topMatch: object|null,
 *          learningSummary: object, applications: Array}} grounding
 * @returns {Array<{id, question, answer, grounded, evidence}>}
 */
export const buildStudentExplanations = (grounding = {}) => {
  const { readiness = {}, learningRecs = {}, topMatch = null } = grounding;
  const r = readiness.readiness ?? null;
  const roleTitle = readiness.careerRole?.title ?? null;
  const explanations = [];

  /* Q1 — why am I not ready? */
  explanations.push(buildReadinessExplanation({ r, roleTitle, reason: readiness.reason }));

  /* Q2 — what should I learn first? */
  explanations.push(buildLearnFirstExplanation({ learningRecs, r }));

  /* Q3 — which gaps matter most? */
  explanations.push(buildGapsExplanation({ r }));

  /* Q4 — why was this opportunity recommended? */
  explanations.push(buildMatchExplanation({ topMatch }));

  /* Q5 — what changed after my reassessment? (honest, never fabricated) */
  explanations.push(buildReassessmentExplanation({ r }));

  return explanations.filter(Boolean);
};

const READINESS_Q = 'Why am I not ready for this role?';

const buildReadinessExplanation = ({ r, roleTitle, reason }) => {
  if (reason === 'no-profile') {
    return explain(
      'readiness',
      READINESS_Q,
      'Set up your profile and add your skills — readiness can only be measured once we know what you can do.',
      { reason },
    );
  }
  if (reason === 'no-career-goal' || !r) {
    return explain(
      'readiness',
      READINESS_Q,
      'Choose a target career role. Readiness is measured against the skills a specific role requires, so there is nothing to score until you pick one.',
      { reason: reason ?? 'no-readiness' },
    );
  }

  const gaps = r.skillGaps ?? [];
  const role = roleTitle ?? 'your target role';

  if (gaps.length === 0) {
    return explain(
      'readiness',
      READINESS_Q,
      `You already meet every required skill for ${role}. Your readiness is ${r.readinessScore}%.`,
      { readinessScore: r.readinessScore, skillGaps: [] },
    );
  }

  const top = gaps.slice(0, 3);
  const gapNames = nameList(top.map((g) => g.skillName));
  const answer =
    `Your readiness for ${role} is ${r.readinessScore}%. It is held back mainly by ${gapNames}: ` +
    top
      .map(
        (g) =>
          `${g.skillName} (you're at level ${g.studentLevel} of ${g.requiredLevel} required, +${g.readinessImpact} pts to close)`,
      )
      .join('; ') +
    '.';

  return explain('readiness', READINESS_Q, answer, {
    readinessScore: r.readinessScore,
    requiredSkillCount: r.requiredSkillCount,
    measuredSkillCount: r.measuredSkillCount,
    skillGaps: top.map((g) => ({
      skillId: g.skillId,
      skillName: g.skillName,
      studentLevel: g.studentLevel,
      requiredLevel: g.requiredLevel,
      readinessImpact: g.readinessImpact,
      severity: g.severity,
    })),
  });
};

const LEARN_FIRST_Q = 'What should I learn first?';

const buildLearnFirstExplanation = ({ learningRecs = {}, r }) => {
  const recs = learningRecs.recommendations ?? [];
  const uncovered = learningRecs.uncoveredGaps ?? [];

  if (recs.length > 0) {
    const top = recs[0];
    const skillName =
      top.coverage?.[0]?.skillName ?? top.targetSkillNames?.[0] ?? 'your top gap';
    return explain(
      'learn-first',
      LEARN_FIRST_Q,
      `Start with "${top.program?.title ?? top.title}". It targets ${skillName}, which is your highest-impact skill gap right now. ${top.reason ?? ''}`.trim(),
      {
        programTitle: top.program?.title ?? top.title,
        priority: top.priority,
        skillName,
      },
    );
  }

  if (uncovered.length > 0) {
    const g = uncovered[0];
    return explain(
      'learn-first',
      LEARN_FIRST_Q,
      `Your biggest gap is ${g.skillName} (level ${g.currentLevel} of ${g.targetLevel}), but no published programme covers it yet. Self-study or an external course is the way in, then reassess to record the improvement.`,
      { skillName: g.skillName, currentLevel: g.currentLevel, targetLevel: g.targetLevel },
    );
  }

  if (r && (r.skillGaps ?? []).length === 0) {
    return explain(
      'learn-first',
      LEARN_FIRST_Q,
      'You have no measured skill gaps for your target role. Keep your skills current and consider a more advanced role to aim at next.',
      { skillGaps: [] },
    );
  }

  return explain(
    'learn-first',
    LEARN_FIRST_Q,
    'Add your skills and choose a target role, and personalised learning recommendations will appear here.',
    { reason: learningRecs.reason ?? 'no-recommendations' },
  );
};

const GAPS_Q = 'Which skill gaps matter most?';

const buildGapsExplanation = ({ r }) => {
  const gaps = r?.skillGaps ?? [];
  if (gaps.length === 0) {
    return explain(
      'gaps',
      GAPS_Q,
      'You have no open skill gaps for your target role right now.',
      { skillGaps: [] },
    );
  }

  const top = gaps.slice(0, 3);
  const answer =
    'Ranked by how many readiness points each would win back: ' +
    top
      .map((g, i) => `${i + 1}. ${g.skillName} (+${g.readinessImpact} pts, ${g.severity})`)
      .join('; ') +
    '. Close the top one first — it moves your score the most per level gained.';

  return explain('gaps', GAPS_Q, answer, {
    skillGaps: top.map((g) => ({
      skillId: g.skillId,
      skillName: g.skillName,
      readinessImpact: g.readinessImpact,
      severity: g.severity,
      isMeasured: g.isMeasured,
    })),
  });
};

const MATCH_Q = 'Why was this opportunity recommended?';

const buildMatchExplanation = ({ topMatch }) => {
  if (!topMatch || !topMatch.match) {
    return explain(
      'match',
      MATCH_Q,
      'No live opportunities matched your profile yet. Add skills and a target role, and matches with their reasons will appear here.',
      { matchScore: null },
    );
  }

  const { opportunity, match } = topMatch;
  const matched = nameList((match.matchedSkills ?? []).map((s) => s.name ?? s.skillName ?? s));
  const missing = nameList((match.missingSkills ?? []).map((s) => s.name ?? s.skillName ?? s));
  const answer =
    `"${opportunity.title}" is your strongest match at ${match.matchScore}%. ` +
    `${match.recommendation ?? ''}` +
    (matched ? ` You match on ${matched}.` : '') +
    (missing ? ` It still asks for ${missing}.` : '');

  return explain('match', MATCH_Q, answer.trim(), {
    opportunityId: opportunity.id,
    opportunityTitle: opportunity.title,
    matchScore: match.matchScore,
    recommendationLevel: match.recommendationLevel,
    matchedSkillCount: (match.matchedSkills ?? []).length,
    missingSkillCount: (match.missingSkills ?? []).length,
  });
};

const REASSESS_Q = 'What changed after my reassessment?';

/**
 * The one answer where fabrication would be easiest and most damaging (§6). We do
 * NOT store a readiness time series, so we do not claim a delta we cannot prove.
 * We state what IS true: the current score, how much of it is actually measured,
 * and the rule that completion alone never moves it.
 */
const buildReassessmentExplanation = ({ r }) => {
  if (!r) {
    return explain(
      'reassessment',
      REASSESS_Q,
      'Once you have a target role and some assessed skills, this will explain what your latest assessment changed.',
      { readinessScore: null },
    );
  }

  const answer =
    `Your readiness is ${r.readinessScore}%, computed from ${r.measuredSkillCount} of ` +
    `${r.requiredSkillCount} required skills (${r.assessedSkillCount} of them from a submitted ` +
    `assessment). Readiness moves only when you submit an assessment — finishing a course does ` +
    `not change your score on its own, so reassessing after you learn is what makes the ` +
    `improvement count.`;

  return explain('reassessment', REASSESS_Q, answer, {
    readinessScore: r.readinessScore,
    measuredSkillCount: r.measuredSkillCount,
    assessedSkillCount: r.assessedSkillCount,
    requiredSkillCount: r.requiredSkillCount,
  });
};

/* ------------------------------------------------------ student actions */

/** One action-center row, shared shape across every role. */
const action = (key, priority, title, detail, { link = null, metric = {} } = {}) => ({
  key,
  priority,
  title,
  detail,
  link,
  metric,
});

/**
 * "Your Next Best Actions" for a learner (student or academician).
 *
 * Each row is derived from real state and links to the screen that resolves it.
 * The closed loop is visible in the ordering: fix your profile, close your top
 * gap, reassess what you have learned, then apply to what now fits.
 *
 * @param {{readiness, learningRecs, topMatch, learningSummary, applications}} g
 * @returns {Array} at most MAX_ACTIONS rows, most urgent first
 */
export const buildStudentActions = (g = {}) => {
  const { readiness = {}, learningRecs = {}, topMatch = null } = g;
  const summary = g.learningSummary ?? {};
  const applications = g.applications ?? [];
  const r = readiness.readiness ?? null;
  const actions = [];

  /* Profile / goal gate — nothing else can be computed without it. */
  if (readiness.reason === 'no-profile') {
    actions.push(
      action(
        'complete-profile',
        ACTION_PRIORITIES.CRITICAL,
        'Complete your profile',
        'Add your skills so your readiness, recommendations and matches can be computed.',
        { link: '/profile' },
      ),
    );
  } else if (readiness.reason === 'no-career-goal') {
    actions.push(
      action(
        'set-career-goal',
        ACTION_PRIORITIES.CRITICAL,
        'Choose a target career role',
        'Readiness and gaps are measured against a role you pick. Set one to unlock the rest.',
        { link: '/profile' },
      ),
    );
  }

  /* Respond to applications that are waiting on you. */
  for (const app of applications) {
    if (app.status === 'shortlisted' || app.status === 'interview') {
      actions.push(
        action(
          `respond:${app.id}`,
          ACTION_PRIORITIES.HIGH,
          `Respond: ${app.opportunity?.title ?? 'your application'}`,
          `This application moved to "${statusLabel(app.status)}". Follow up before it goes stale.`,
          { link: `/applications/${app.id}`, metric: { status: app.status } },
        ),
      );
    }
  }

  /* continue-learning / enrol / reassess / apply appended below */
  return finishActions(actions, g);
};

/**
 * Appends the learning/apply actions common to the "gap → learn → reassess →
 * apply" tail of the loop, then orders and trims. Split out of buildStudentActions
 * so the profile/goal gate above reads cleanly.
 */
const finishActions = (actions, g) => {
  const { readiness = {}, learningRecs = {}, topMatch = null } = g;
  const summary = g.learningSummary ?? {};
  const applications = g.applications ?? [];
  const r = readiness.readiness ?? null;
  const appliedOppIds = new Set(applications.map((a) => a.opportunityId).filter(Boolean));

  /* Continue an in-progress programme. */
  if (summary.continueWith) {
    const c = summary.continueWith;
    actions.push(
      action(
        `continue:${c.id}`,
        ACTION_PRIORITIES.HIGH,
        `Continue "${c.program?.title ?? 'your programme'}"`,
        `You're ${c.progress ?? 0}% through this programme. Finish it, then reassess to record the improvement.`,
        { link: `/learning/enrollments/${c.id}`, metric: { progress: c.progress ?? 0 } },
      ),
    );
  }

  /* Enrol in the top recommended programme (only if not already enrolled). */
  const topRec = (learningRecs.recommendations ?? []).find((rec) => !rec.enrollment);
  if (topRec) {
    const gapSeverity = (r?.skillGaps ?? [])[0]?.severity;
    const priority =
      gapSeverity === 'major' ? ACTION_PRIORITIES.HIGH : ACTION_PRIORITIES.MEDIUM;
    actions.push(
      action(
        `enrol:${topRec.program?.id ?? topRec.id}`,
        priority,
        `Enrol in "${topRec.program?.title ?? topRec.title}"`,
        topRec.reason ?? 'Targets one of your highest-priority skill gaps.',
        { link: `/learning/programs/${topRec.program?.id ?? topRec.id}` },
      ),
    );
  }

  /* Reassess completed learning so improvement can be measured (§14 step 6). */
  if ((summary.completed ?? 0) > 0) {
    actions.push(
      action(
        'reassess',
        ACTION_PRIORITIES.MEDIUM,
        'Reassess a completed skill',
        `You have completed ${summary.completed} programme${summary.completed === 1 ? '' : 's'}. Reassessment is the only thing that turns that learning into a higher readiness score.`,
        { link: '/assessments', metric: { completed: summary.completed } },
      ),
    );
  }

  /* Apply to the strongest live match not yet applied to. */
  if (topMatch?.match && topMatch.opportunity && !appliedOppIds.has(topMatch.opportunity.id)) {
    const level = topMatch.match.recommendationLevel;
    if (level === 'strong' || level === 'good' || topMatch.match.matchScore >= 60) {
      actions.push(
        action(
          `apply:${topMatch.opportunity.id}`,
          ACTION_PRIORITIES.MEDIUM,
          `Apply to "${topMatch.opportunity.title}"`,
          `You're a ${topMatch.match.matchScore}% match — one of your best. ${topMatch.match.recommendation ?? ''}`.trim(),
          { link: `/opportunities/${topMatch.opportunity.id}`, metric: { matchScore: topMatch.match.matchScore } },
        ),
      );
    }
  }

  return actions.sort(byPriority).slice(0, MAX_ACTIONS);
};

/* ------------------------------------------------------ industry actions */

/**
 * "Hiring Actions" from the recruiter's own pipeline summary.
 * @param {{total, byStatus, needsReview, openPostings}} summary
 */
export const buildIndustryActions = (summary = {}) => {
  const actions = [];
  const byStatus = summary.byStatus ?? {};

  if ((summary.needsReview ?? 0) > 0) {
    actions.push(
      action(
        'review-applications',
        ACTION_PRIORITIES.HIGH,
        `Review ${summary.needsReview} application${summary.needsReview === 1 ? '' : 's'}`,
        `${summary.needsReview} applicant${summary.needsReview === 1 ? ' is' : 's are'} still awaiting a first review. Ranked by match score on each posting's applicant list.`,
        { link: '/industry/applications', metric: { needsReview: summary.needsReview } },
      ),
    );
  }

  const shortlisted = byStatus.shortlisted ?? 0;
  if (shortlisted > 0) {
    actions.push(
      action(
        'advance-shortlisted',
        ACTION_PRIORITIES.MEDIUM,
        `Move ${shortlisted} shortlisted candidate${shortlisted === 1 ? '' : 's'} forward`,
        'Shortlisted candidates are waiting on an interview or decision.',
        { link: '/industry/applications', metric: { shortlisted } },
      ),
    );
  }

  if ((summary.openPostings ?? 0) === 0) {
    actions.push(
      action(
        'post-opportunity',
        ACTION_PRIORITIES.MEDIUM,
        'Post an opportunity',
        'You have no open postings, so no candidates can be matched to you right now.',
        { link: '/industry/opportunities' },
      ),
    );
  }

  return actions.sort(byPriority).slice(0, MAX_ACTIONS);
};

/** Institution actions come straight from the intelligence layer's own list. */
export const buildInstitutionActions = (intelligenceActions = []) =>
  intelligenceActions
    .map((a) => ({ ...a, link: '/institution/intelligence' }))
    .sort(byPriority)
    .slice(0, MAX_ACTIONS);

/* ------------------------------------------------- async orchestrators */

/**
 * Gathers the real grounding a student coach needs, in parallel, then hands it to
 * the pure builders. Every source is an existing Step 1–9 service (§4).
 */
const loadStudentGrounding = async (studentId, { careerRoleId } = {}) => {
  const [readiness, learningRecs, matchResult, learningSummary, applicationResult] =
    await Promise.all([
      getReadinessForStudent({ studentId, careerRoleId }),
      getLearningRecommendationsForStudent({ studentId, careerRoleId }),
      getMatchesForStudent({ studentId, limit: 3 }),
      getMyLearningSummary(studentId),
      listMyApplications({ studentId, limit: 50 }),
    ]);

  const topMatch = (matchResult.matches ?? [])[0] ?? null;

  return {
    readiness,
    learningRecs,
    topMatch,
    matches: matchResult.matches ?? [],
    learningSummary,
    applications: applicationResult.applications ?? [],
  };
};

/**
 * GET /coach/explanations — the student AI Coach.
 *
 * Returns grounded explanations plus the same next-actions list the dashboard
 * shows, so the coach can point at the concrete thing to do next. When an AI
 * provider is configured the answers are optionally narrated; the numbers never
 * are.
 */
export const getStudentCoach = async (studentId, { careerRoleId, narrate = true } = {}) => {
  const grounding = await loadStudentGrounding(studentId, { careerRoleId });
  const explanations = buildStudentExplanations(grounding);
  const actions = buildStudentActions(grounding);

  const presented = narrate ? await narrateExplanations(explanations, 'student') : explanations;

  return {
    role: ROLES.STUDENT,
    aiEnabled: isAiConfigured(),
    careerRole: grounding.readiness.careerRole ?? null,
    readinessScore: grounding.readiness.readiness?.readinessScore ?? null,
    explanations: presented,
    actions,
  };
};

/**
 * GET /coach/next-actions — the Action Center list for whoever is signed in.
 *
 * Role decides the source; the shape is identical, so one client component renders
 * every role's list.
 */
export const getNextActionsForUser = async (user) => {
  const role = user?.role;

  if (role === ROLES.STUDENT) {
    const grounding = await loadStudentGrounding(user.id);
    return { role, title: 'Your Next Best Actions', actions: buildStudentActions(grounding) };
  }

  if (role === ROLES.ACADEMICIAN) {
    /* Academicians have no StudentProfile, so no readiness gate — they enrol and
       apply, which is the tail of the same learner flow. */
    const [learningSummary, applicationResult] = await Promise.all([
      getMyLearningSummary(user.id),
      listMyApplications({ studentId: user.id, limit: 50 }),
    ]);
    const grounding = {
      readiness: {},
      learningRecs: { recommendations: [] },
      topMatch: null,
      learningSummary,
      applications: applicationResult.applications ?? [],
    };
    return { role, title: 'Academic Actions', actions: buildStudentActions(grounding) };
  }

  if (role === ROLES.INDUSTRY) {
    const summary = await getRecruitmentSummary(user.id);
    return { role, title: 'Hiring Actions', actions: buildIndustryActions(summary) };
  }

  if (role === ROLES.INSTITUTION) {
    const intelligence = await getInstitutionIntelligence(user.id);
    return {
      role,
      title: 'Institution Priority Actions',
      actions: buildInstitutionActions(intelligence.actions ?? []),
    };
  }

  return { role, title: 'Actions', actions: [] };
};

/**
 * GET /coach/opportunities/:id/why — the grounded reason one posting fits (or does
 * not). Reuses the matching engine's own breakdown; computes nothing new.
 */
export const getOpportunityWhy = async ({ user, opportunityId }) => {
  if (!isApplicantRole(user.role)) {
    // Only applicants have a match to explain; guarded again in the route.
    return { grounded: true, match: null, reason: 'not-an-applicant' };
  }

  const { match, opportunity, reason } = await getMatchForStudent({
    studentId: user.id,
    opportunityId,
  });

  const explanation = buildMatchExplanation({
    topMatch: match ? { opportunity, match } : null,
  });

  return { grounded: true, match, opportunity, reason, explanation };
};

/* ------------------------------------------------------------- narration */

const NARRATE_SYSTEM = [
  'You rewrite short factual explanations to sound warmer and clearer for a student.',
  'You MUST NOT add, remove, or change any fact, number, skill name, percentage or recommendation.',
  'Only rephrase the wording. Keep every figure exactly as given.',
  'Reply with JSON only: an array of { "id": string, "answer": string }. No markdown, no commentary.',
].join(' ');

/**
 * Optional LLM presentation (§6). The deterministic answers are the source of
 * truth; this only rewords them, and ANY failure returns them untouched. No number
 * a user sees is produced here — the model is handed finished sentences and told to
 * rephrase, never to compute or invent.
 *
 * Returns the same explanation objects, with `answer` possibly reworded and a
 * `narrated` flag recording whether it was.
 */
export const narrateExplanations = async (explanations, audience = 'student') => {
  if (!isAiConfigured() || explanations.length === 0) return explanations;

  const userPrompt = [
    `Audience: ${audience}. Rewrite each explanation's "answer" to be friendly and clear.`,
    'Do not change any fact or number. Return JSON array of { id, answer }.',
    '',
    JSON.stringify(explanations.map((e) => ({ id: e.id, answer: e.answer }))),
  ].join('\n');

  let result;
  try {
    result = await requestCompletion({
      systemPrompt: NARRATE_SYSTEM,
      userPrompt,
      maxTokens: 1200,
    });
  } catch {
    return explanations;
  }

  if (!result?.ok || !result.text) return explanations;

  const reworded = parseNarration(result.text);
  if (!reworded) return explanations;

  return explanations.map((e) => {
    const next = reworded.get(e.id);
    return next && typeof next === 'string' && next.trim()
      ? { ...e, answer: next.trim(), narrated: true }
      : { ...e, narrated: false };
  });
};

/** Tolerant parse of the model's array; returns a Map(id -> answer) or null. */
const parseNarration = (text) => {
  try {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1) return null;
    const arr = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(arr)) return null;
    return new Map(arr.filter((x) => x && x.id).map((x) => [x.id, x.answer]));
  } catch {
    return null;
  }
};

export {
  buildReadinessExplanation,
  buildMatchExplanation,
  buildReassessmentExplanation,
  loadStudentGrounding,
};
