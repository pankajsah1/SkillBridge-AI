/**
 * Institution analytics.
 *
 * ONE READ-ONLY QUESTION, ASKED FOUR WAYS: how ready is this institution's cohort,
 * where is it strong, where is it thin against what employers are actually asking
 * for, and what has come of the applications its students have made. Nothing in
 * this file writes, and nothing here recalculates a readiness or match score —
 * every number is an aggregate over figures the assessment, matching and
 * application phases already produced.
 *
 * HOW A COHORT IS DEFINED, AND WHY IT IS TWO CONDITIONS. `StudentProfile` has
 * carried an unused `institutionId` since Step 3, reserved for a real Institution
 * collection that still does not exist, alongside the `institutionName` string
 * students actually type. So the scope matches either: the id when something has
 * set it, or the name against this institution account's own name. When the
 * Institution collection lands, the name half can be deleted and nothing else in
 * this file changes.
 *
 * SUPPLY IS THIS INSTITUTION'S; DEMAND IS THE WHOLE MARKET'S. The skill-gap table
 * compares how many of *these* students hold a skill against how many *live
 * postings from any employer* ask for it. That asymmetry is the point — an
 * institution wants to know what industry wants and it is not teaching, and
 * restricting demand to postings its own students happened to apply to would
 * answer a much smaller question.
 *
 * AVERAGES SKIP THE UNASSESSED RATHER THAN COUNTING THEM AS ZERO. `readinessScore`
 * is null until a student has been assessed, and folding nulls in as zeroes would
 * make an institution look worse the more students it enrolled. The count of
 * unassessed students is returned separately, which is the honest version of the
 * same fact.
 *
 * WHY PROFILES ARE READ RATHER THAN AGGREGATED. The per-student work here — band
 * a readiness score, group by branch, count skills held — runs over one document
 * per student at a college's scale, and a `find()` plus three reduces is far less
 * code than the pipelines that would replace it. The two aggregates that ARE
 * pipelines cross into other collections, where the alternative would be pulling
 * every opportunity and every application into memory.
 */

import Application from '../models/Application.js';
import Opportunity from '../models/Opportunity.js';
import Skill from '../models/Skill.js';
import StudentProfile from '../models/StudentProfile.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { APPLICATION_STATUSES } from '../constants/applications.js';
import { AUDIENCES, OPPORTUNITY_STATUSES, audienceQuery } from '../constants/opportunities.js';
import { PROFICIENCY_LEVELS, levelForScore } from '../constants/skills.js';

/** How many rows each table returns. Enough to act on, few enough to read. */
const TOP_BRANCHES = 6;
const TOP_SKILL_GAPS = 8;
const TOP_STRENGTHS = 5;

/**
 * Escapes a name before it becomes a regex.
 *
 * NOT COSMETIC. An institution called "St. Xavier's (Autonomous)" contains three
 * regex metacharacters, and interpolating it raw would either match the wrong
 * students or throw. The anchors below make it an exact, case-insensitive match
 * rather than a substring one, so "Anna University" cannot claim
 * "Anna University College of Engineering".
 */
const exactNameMatch = (value) =>
  new RegExp(`^${String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

/** The cohort filter. See the header for why it is an $or. */
const cohortFilter = (institution) => ({
  $or: [{ institutionId: institution._id }, { institutionName: exactNameMatch(institution.name) }],
});

/** Integer percentage, or null when there is nothing to divide by. */
const percentage = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : null);

/** Mean of a numeric list, rounded, or null for an empty list. */
const mean = (values) =>
  values.length > 0
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null;

/**
 * Students per proficiency band, over the assessed students only.
 *
 * Every band is returned even at zero. A distribution with gaps in it is a
 * distribution nobody can read — "no student is Expert yet" is a finding, and a
 * bar that simply is not drawn looks like a rendering bug.
 */
const readinessDistribution = (scores) =>
  PROFICIENCY_LEVELS.map((band) => {
    const students = scores.filter((score) => levelForScore(score).key === band.key).length;

    return {
      key: band.key,
      label: band.label,
      min: band.min,
      max: band.max,
      students,
      share: percentage(students, scores.length) ?? 0,
    };
  });

/**
 * Readiness by branch, biggest cohort first.
 *
 * Sorted by student count rather than by average, deliberately: a branch of two
 * students with one strong result would otherwise top a table an institution is
 * meant to make decisions from. The average is shown, it just does not decide the
 * order.
 */
const branchBreakdown = (profiles) => {
  const groups = new Map();

  for (const profile of profiles) {
    const branch = profile.branch?.trim() || 'Not specified';
    if (!groups.has(branch)) groups.set(branch, { branch, students: 0, scores: [] });

    const group = groups.get(branch);
    group.students += 1;
    if (typeof profile.readinessScore === 'number') group.scores.push(profile.readinessScore);
  }

  return [...groups.values()]
    .map((group) => ({
      branch: group.branch,
      students: group.students,
      assessed: group.scores.length,
      averageReadiness: mean(group.scores),
    }))
    .sort((a, b) => b.students - a.students || a.branch.localeCompare(b.branch))
    .slice(0, TOP_BRANCHES);
};

/**
 * How many of these students hold each skill, and at what average level.
 *
 * Keyed by skill id as a string throughout — the ids are ObjectIds, and two
 * ObjectIds for the same skill are not `===` each other.
 */
const skillSupply = (profiles) => {
  const supply = new Map();

  for (const profile of profiles) {
    for (const entry of profile.skills ?? []) {
      const key = String(entry.skillId);
      if (!supply.has(key)) supply.set(key, { students: 0, verified: 0, levels: [] });

      const row = supply.get(key);
      row.students += 1;
      if (entry.verified) row.verified += 1;
      if (typeof entry.level === 'number') row.levels.push(entry.level);
    }
  }

  return supply;
};

/**
 * Which skills live postings ask for, and how loudly.
 *
 * "Live" is the same definition the student-facing browse uses: published and the
 * deadline not yet passed. Counting drafts would let one employer's unpublished
 * wishlist reshape an institution's curriculum advice.
 *
 * STUDENT POSTINGS ONLY (Step 7). Every number in this file is one half of a
 * comparison whose other half is a *student* cohort's skills, so letting faculty
 * programmes into the demand side would compare an institution's students against
 * jobs none of them could apply to. Academician demand is a real question, but it
 * is a different question and belongs in its own report rather than silently
 * changing what this one means.
 */
const skillDemand = async () => {
  const rows = await Opportunity.aggregate([
    {
      $match: {
        audience: audienceQuery(AUDIENCES.STUDENT),
        status: OPPORTUNITY_STATUSES.ACTIVE,
        deadline: { $gte: new Date() },
      },
    },
    { $unwind: '$requiredSkills' },
    {
      $group: {
        _id: '$requiredSkills.skillId',
        postings: { $sum: 1 },
        averageRequiredLevel: { $avg: '$requiredSkills.requiredLevel' },
      },
    },
  ]);

  return new Map(
    rows.map((row) => [
      String(row._id),
      {
        postings: row.postings,
        averageRequiredLevel: Math.round(row.averageRequiredLevel ?? 0),
      },
    ]),
  );
};

/**
 * Where this cohort is thinnest against what employers are asking for.
 *
 * The gap is "share of postings that want it" minus "share of students who have
 * it", both as percentages, so a skill three quarters of employers ask for and a
 * tenth of students hold scores 65 — and a skill everyone already has scores near
 * zero however popular it is. Ranking on raw counts instead would put whichever
 * skill is simply most common at the top of every institution's list.
 */
const buildSkillGaps = ({ demand, supply, studentCount, postingCount, skillsById }) => {
  const rows = [];

  for (const [skillId, demandRow] of demand.entries()) {
    const supplyRow = supply.get(skillId);
    const holders = supplyRow?.students ?? 0;

    const demandShare = percentage(demandRow.postings, postingCount) ?? 0;
    const supplyShare = percentage(holders, studentCount) ?? 0;

    rows.push({
      skillId,
      name: skillsById.get(skillId)?.name ?? 'Unnamed skill',
      category: skillsById.get(skillId)?.category ?? null,
      postings: demandRow.postings,
      demandShare,
      students: holders,
      supplyShare,
      verifiedStudents: supplyRow?.verified ?? 0,
      averageStudentLevel: mean(supplyRow?.levels ?? []),
      averageRequiredLevel: demandRow.averageRequiredLevel,
      gap: demandShare - supplyShare,
    });
  }

  return rows.sort((a, b) => b.gap - a.gap || b.postings - a.postings).slice(0, TOP_SKILL_GAPS);
};

/** What the cohort is best at: most widely held, verified count as the tiebreak. */
const buildStrengths = ({ supply, studentCount, skillsById }) =>
  [...supply.entries()]
    .map(([skillId, row]) => ({
      skillId,
      name: skillsById.get(skillId)?.name ?? 'Unnamed skill',
      students: row.students,
      share: percentage(row.students, studentCount) ?? 0,
      verifiedStudents: row.verified,
      averageStudentLevel: mean(row.levels),
    }))
    .sort((a, b) => b.students - a.students || b.verifiedStudents - a.verifiedStudents)
    .slice(0, TOP_STRENGTHS);

/**
 * What has become of this cohort's applications.
 *
 * Scoped by student id, so it counts only these students — an institution has no
 * business seeing another college's pipeline. Status names come from the same
 * constants the recruiter UI uses, so "selected" means here exactly what it means
 * there.
 */
const placementPipeline = async (studentIds) => {
  if (studentIds.length === 0) {
    return { total: 0, byStatus: {}, selected: 0, inProgress: 0, applicants: 0 };
  }

  const [rows, applicants] = await Promise.all([
    Application.aggregate([
      { $match: { studentId: { $in: studentIds } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Application.distinct('studentId', { studentId: { $in: studentIds } }),
  ]);

  const byStatus = rows.reduce((counts, row) => ({ ...counts, [row._id]: row.count }), {});
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  const inProgress =
    (byStatus[APPLICATION_STATUSES.APPLIED] ?? 0) +
    (byStatus[APPLICATION_STATUSES.UNDER_REVIEW] ?? 0) +
    (byStatus[APPLICATION_STATUSES.SHORTLISTED] ?? 0) +
    (byStatus[APPLICATION_STATUSES.INTERVIEW] ?? 0);

  return {
    total,
    byStatus,
    selected: byStatus[APPLICATION_STATUSES.SELECTED] ?? 0,
    inProgress,
    /* Distinct students, not applications: "11 students have applied" is a
       different and more useful fact than "40 applications exist". */
    applicants: applicants.length,
  };
};

/**
 * GET /analytics/institution — everything the institution dashboard renders.
 *
 * @param {string} institutionUserId the authenticated INSTITUTION account
 * @returns {Promise<object>}
 */
export const getInstitutionAnalytics = async (institutionUserId) => {
  const institution = await User.findById(institutionUserId).select('name');

  if (!institution) {
    throw AppError.notFound('That institution account could not be found.');
  }

  const profiles = await StudentProfile.find(cohortFilter(institution)).select(
    'userId institutionName branch degree graduationYear readinessScore profileCompletion skills',
  );

  const studentCount = profiles.length;
  const studentIds = profiles.map((profile) => profile.userId);

  const scores = profiles
    .map((profile) => profile.readinessScore)
    .filter((score) => typeof score === 'number');

  const supply = skillSupply(profiles);

  /* Everything past this point needs the catalogue and the two other collections;
     nothing here depends on anything above, so it all goes at once. */
  const [demand, livePostings, pipeline] = await Promise.all([
    skillDemand(),
    Opportunity.countDocuments({
      audience: audienceQuery(AUDIENCES.STUDENT),
      status: OPPORTUNITY_STATUSES.ACTIVE,
      deadline: { $gte: new Date() },
    }),
    placementPipeline(studentIds),
  ]);

  const skillIds = [...new Set([...supply.keys(), ...demand.keys()])];
  const skills = await Skill.find({ _id: { $in: skillIds } }).select('name category');
  const skillsById = new Map(skills.map((skill) => [skill._id.toString(), skill]));

  const verifiedEntries = profiles.reduce(
    (sum, profile) => sum + (profile.skills ?? []).filter((entry) => entry.verified).length,
    0,
  );

  return {
    institution: {
      id: institution._id.toString(),
      name: institution.name,
    },

    cohort: {
      students: studentCount,
      assessed: scores.length,
      /* The gap between these two is the institution's own to-do list. */
      notAssessed: studentCount - scores.length,
      averageReadiness: mean(scores),
      averageProfileCompletion: mean(profiles.map((profile) => profile.profileCompletion ?? 0)),
      skillEntries: [...supply.values()].reduce((sum, row) => sum + row.students, 0),
      verifiedSkillEntries: verifiedEntries,
      distinctSkills: supply.size,
    },

    readiness: readinessDistribution(scores),
    branches: branchBreakdown(profiles),

    demand: {
      livePostings,
      skillsInDemand: demand.size,
    },

    skillGaps: buildSkillGaps({
      demand,
      supply,
      studentCount,
      postingCount: livePostings,
      skillsById,
    }),

    strengths: buildStrengths({ supply, studentCount, skillsById }),
    pipeline,
  };
};

export default { getInstitutionAnalytics };
