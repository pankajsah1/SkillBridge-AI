/**
 * Demo data seed — the cohort, the employers, the postings and the pipeline.
 *
 *   npm run seed:demo
 *
 * SEPARATE FROM `npm run seed`, AND THAT IS THE POINT. scripts/seed.js seeds the
 * catalogue: skills, career roles, question bank — the reference data the product
 * needs to function at all, on any deployment. This script seeds a *story*: named
 * students with invented CGPAs applying to invented companies. Mixing the two would
 * mean nobody could load the catalogue without also loading twenty-two fake people.
 *
 * IT GOES THROUGH THE REAL SERVICES WHEREVER ONE EXISTS. Applications are created by
 * `createApplication` and moved by `updateApplicationStatus`, which means every
 * `matchScoreAtApplication` in the demo database came out of the actual matching
 * engine, every status history is one the product could have produced, and every
 * transition obeyed the real rules. A seed script that writes documents directly can
 * quietly create states the application cannot reach, and then the demo is showing
 * something the product cannot do.
 *
 * WHAT IT DOES FAKE, IT FAKES IN THE OPEN. `readinessScore` and `verified: true` are
 * written straight onto profiles, because the alternative is sitting twenty-two
 * assessments. Those two fields, and nothing else, stand in for work a student would
 * have done. Persona D exists precisely so the honest case — a full profile with no
 * assessment behind it — is on screen too.
 *
 * IDEMPOTENT, AND IT NEVER DELETES. Users are matched on email, profiles on user,
 * postings on owner plus title, applications on the unique student-and-posting index.
 * Re-running updates in place and reports what it found. There is no --force, no
 * dropDatabase, and no deleteMany: this script runs against whatever database
 * MONGODB_URI names, and that may be one with real data in it.
 *
 * PASSWORDS ARE SET ON CREATION ONLY. Re-running will not reset an account's
 * password, because silently changing credentials is not a seed script's business.
 * The shared demo password is printed at the end of every run.
 *
 * PRE-FLIGHT VALIDATION RUNS OFFLINE. Unknown skill slugs, unknown employer keys,
 * unreachable application statuses and — the one that matters most — a cohort where
 * everybody is excellent all abort before the connection opens.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

import { env, validateEnv } from '../src/config/env.js';
import { toSlug, SKILL_SOURCES } from '../src/constants/skills.js';
import { APPLICATION_STATUSES, canTransition } from '../src/constants/applications.js';
import { DEFAULT_AUDIENCE, OPPORTUNITY_STATUSES } from '../src/constants/opportunities.js';
import ROLES from '../src/constants/roles.js';
import { SKILL_SEED } from '../src/data/skills.seed.js';
import { CAREER_ROLE_SEED } from '../src/data/careerRoles.seed.js';
import {
  DEMO_ACADEMICIAN,
  DEMO_APPLICATIONS,
  DEMO_EMPLOYERS,
  DEMO_INSTITUTION,
  DEMO_OPPORTUNITIES,
  DEMO_PASSWORD,
  DEMO_PORTFOLIOS,
  DEMO_STUDENTS,
  OTHER_INSTITUTION_NAME,
} from '../src/data/demo.seed.js';
import Application from '../src/models/Application.js';
import CareerRole from '../src/models/CareerRole.js';
import Opportunity from '../src/models/Opportunity.js';
import Skill from '../src/models/Skill.js';
import StudentProfile from '../src/models/StudentProfile.js';
import AcademicianProfile from '../src/models/AcademicianProfile.js';
import User from '../src/models/User.js';
import { createApplication, updateApplicationStatus } from '../src/services/application.service.js';

const DAY = 24 * 60 * 60 * 1000;

/** Hides credentials before anything reaches a terminal or a log file. */
const redact = (uri) => uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');

/* ------------------------------------------------------------------------- */
/* Pre-flight validation — offline, before we connect.                        */
/* ------------------------------------------------------------------------- */

/**
 * The shortest legal route from `applied` to a target status.
 *
 * Breadth-first over the real transition map, so this cannot invent an edge the
 * product does not have. Returns null when the target is unreachable, which is a
 * validation error rather than something to work around.
 */
export const pathToStatus = (target) => {
  const start = APPLICATION_STATUSES.APPLIED;
  if (target === start) return [];

  const queue = [[start, []]];
  const seen = new Set([start]);

  while (queue.length > 0) {
    const [current, route] = queue.shift();

    for (const next of Object.keys(APPLICATION_STATUSES).map((k) => APPLICATION_STATUSES[k])) {
      if (seen.has(next) || !canTransition(current, next)) continue;

      const extended = [...route, next];
      if (next === target) return extended;

      seen.add(next);
      queue.push([next, extended]);
    }
  }

  return null;
};

/**
 * Checks the demo data is internally consistent and honestly distributed.
 *
 * The readiness assertions are not defensive programming — they are the brief. A demo
 * cohort where everyone is excellent cannot demonstrate a skill gap, a readiness
 * distribution or a reason for the product to exist, so an edit that flattens the
 * spread should fail here rather than be discovered on stage.
 */
export const validateDemoData = () => {
  const errors = [];
  const warnings = [];

  const knownSlugs = new Set(SKILL_SEED.map((skill) => toSlug(skill.name)));
  const knownRoles = new Set(CAREER_ROLE_SEED.map((role) => role.title));
  const emails = new Set();
  const employerKeys = new Set(DEMO_EMPLOYERS.map((employer) => employer.key));
  const postingTitles = new Set();

  // --- students -----------------------------------------------------------
  DEMO_STUDENTS.forEach((student) => {
    if (emails.has(student.email)) {
      errors.push(`Two students share the email "${student.email}".`);
    }
    emails.add(student.email);

    (student.targets ?? []).forEach((title) => {
      if (!knownRoles.has(title)) {
        errors.push(
          `${student.name} targets career role "${title}", which is not in careerRoles.seed.js.`,
        );
      }
    });

    const seen = new Set();

    (student.skills ?? []).forEach(([slug, level]) => {
      if (!knownSlugs.has(slug)) {
        errors.push(`${student.name} claims skill "${slug}", which is not in skills.seed.js.`);
      }
      if (seen.has(slug)) {
        errors.push(`${student.name} lists skill "${slug}" twice.`);
      }
      seen.add(slug);

      if (!Number.isInteger(level) || level < 0 || level > 100) {
        errors.push(`${student.name} has level ${level} for "${slug}"; must be 0-100.`);
      }
    });

    if (student.readiness !== null && (student.readiness < 0 || student.readiness > 100)) {
      errors.push(`${student.name} has readiness ${student.readiness}; must be 0-100 or null.`);
    }
  });

  // --- the distribution, which is the brief -------------------------------
  const cohort = DEMO_STUDENTS.filter((student) => !student.otherInstitution);
  const scored = cohort.map((s) => s.readiness).filter((score) => typeof score === 'number');

  if (cohort.length < 20) {
    errors.push(`Only ${cohort.length} students at the demo institution; the brief asks for 20+.`);
  }

  if (scored.length === cohort.length) {
    errors.push('Every student has been assessed. Persona D exists so "unknown" is on screen too.');
  }

  if (!scored.some((score) => score >= 75)) {
    errors.push('Nobody in the cohort is strong. The demo needs a candidate worth selecting.');
  }

  if (!scored.some((score) => score < 60)) {
    errors.push('Nobody in the cohort is struggling. Then the product has nothing to fix.');
  }

  const excellent = scored.filter((score) => score >= 75).length;
  if (scored.length > 0 && excellent / scored.length > 0.4) {
    errors.push(
      `${excellent} of ${scored.length} assessed students are 75+. That is not a cohort, ` +
        'it is a highlight reel — the brief says not to make everyone excellent.',
    );
  }

  const personas = new Set(DEMO_STUDENTS.map((student) => student.persona));
  ['A', 'B', 'C', 'D', 'E'].forEach((persona) => {
    if (!personas.has(persona)) errors.push(`Persona ${persona} is not represented.`);
  });

  if (!DEMO_STUDENTS.some((student) => student.otherInstitution)) {
    warnings.push(
      'No student belongs to another institution, so the cohort filter has nothing to exclude.',
    );
  }

  // --- portfolios ---------------------------------------------------------
  /* Checked offline for the same reason skill slugs are: a portfolio keyed to a
     misspelt email is not an error at runtime, it is a student who quietly has no
     projects, and the seed would report success. */
  const PORTFOLIO_ARRAYS = ['projects', 'certifications', 'achievements', 'experiences'];

  Object.entries(DEMO_PORTFOLIOS).forEach(([email, entry]) => {
    if (!emails.has(email)) {
      errors.push(`A portfolio is keyed to "${email}", who is not in DEMO_STUDENTS.`);
    }

    Object.keys(entry).forEach((key) => {
      if (!PORTFOLIO_ARRAYS.includes(key)) {
        errors.push(`${email} has a portfolio section "${key}", which is not a profile array.`);
      }
    });

    PORTFOLIO_ARRAYS.forEach((key) => {
      (entry[key] ?? []).forEach((record) => {
        /* Only the offsets are checked here. Titles, lengths and enums are the schema's
           job, and it runs on every save — duplicating it here would just be a second
           place for the limits to be wrong. */
        Object.entries(record).forEach(([field, value]) => {
          if (!/Months(Ago|Ahead)$/.test(field)) return;

          if (value === null) return;
          if (!Number.isInteger(value) || value < 0) {
            errors.push(`${email} ${key}: ${field} is ${value}; must be a positive integer or null.`);
          }
        });

        const { startMonthsAgo: start, endMonthsAgo: end } = record;
        if (Number.isInteger(start) && Number.isInteger(end) && end > start) {
          errors.push(
            `${email} ${key}: "${record.title ?? record.role}" ends ${end} months ago but ` +
              `starts ${start} months ago, so it finishes before it begins.`,
          );
        }

        if ((record.isOngoing || record.isCurrent) && Number.isInteger(end)) {
          errors.push(
            `${email} ${key}: "${record.title ?? record.role}" is marked ongoing and also ` +
              'has an end date.',
          );
        }

        if (record.verificationStatus) {
          errors.push(
            `${email} ${key}: "${record.title ?? record.role}" sets verificationStatus. ` +
              'Nothing in this build verifies a portfolio record, so the seed must not claim one.',
          );
        }
      });
    });
  });

  const withPortfolios = Object.keys(DEMO_PORTFOLIOS).filter((email) => emails.has(email));

  if (withPortfolios.length === 0) {
    warnings.push('No student has portfolio records, so the completion score has nothing to show.');
  }

  if (withPortfolios.length === DEMO_STUDENTS.length) {
    warnings.push(
      'Every student has a portfolio, so the empty states never appear and the completion ' +
        'score cannot tell anyone apart.',
    );
  }

  // --- opportunities ------------------------------------------------------
  if (DEMO_OPPORTUNITIES.length < 10) {
    errors.push(`Only ${DEMO_OPPORTUNITIES.length} opportunities; the brief asks for 10+.`);
  }

  DEMO_OPPORTUNITIES.forEach((posting) => {
    if (!employerKeys.has(posting.employer)) {
      errors.push(`"${posting.title}" belongs to unknown employer "${posting.employer}".`);
    }
    if (postingTitles.has(posting.title)) {
      errors.push(`Two postings share the title "${posting.title}"; titles identify them here.`);
    }
    postingTitles.add(posting.title);

    if ((posting.required ?? []).length === 0) {
      errors.push(`"${posting.title}" has no required skills, so it cannot be matched against.`);
    }

    [...(posting.required ?? []), ...(posting.preferred ?? [])].forEach(([slug, level, weight]) => {
      if (!knownSlugs.has(slug)) {
        errors.push(`"${posting.title}" requires skill "${slug}", which is not in skills.seed.js.`);
      }
      if (!Number.isInteger(level) || level < 0 || level > 100) {
        errors.push(`"${posting.title}" asks for level ${level} on "${slug}"; must be 0-100.`);
      }
      if (!Number.isInteger(weight) || weight < 0 || weight > 100) {
        errors.push(`"${posting.title}" weights "${slug}" at ${weight}; must be 0-100.`);
      }
    });

    const requiredWeight = (posting.required ?? []).reduce((sum, [, , weight]) => sum + weight, 0);
    if (requiredWeight !== 100) {
      warnings.push(
        `"${posting.title}" required-skill weights sum to ${requiredWeight}, not 100. ` +
          'Matching normalises them, so this is cosmetic — but it reads oddly in the UI.',
      );
    }
  });

  const live = DEMO_OPPORTUNITIES.filter(
    (posting) => !posting.finalStatus && posting.deadlineInDays > 0,
  );
  if (live.length < 5) {
    errors.push(`Only ${live.length} postings are open to students; the demo needs several.`);
  }

  // --- applications ------------------------------------------------------
  const applicable = new Set(live.map((posting) => posting.title));
  const closedWithApplications = new Set(
    DEMO_OPPORTUNITIES.filter((p) => p.finalStatus === OPPORTUNITY_STATUSES.CLOSED || p.deadlineInDays < 0)
      .map((p) => p.title),
  );
  const pairs = new Set();

  DEMO_APPLICATIONS.forEach((application) => {
    const isAcademician = 'academician' in application;
    const applicantEmail = isAcademician ? application.academician : application.student;

    if (isAcademician) {
      if (applicantEmail !== DEMO_ACADEMICIAN.email) {
        errors.push(`An application names unknown academician "${applicantEmail}".`);
      }
    } else {
      if (!emails.has(application.student)) {
        errors.push(`An application names unknown student "${application.student}".`);
      }
    }

    if (!postingTitles.has(application.posting)) {
      errors.push(`An application names unknown posting "${application.posting}".`);
    }

    const pair = `${applicantEmail}|${application.posting}`;
    if (pairs.has(pair)) {
      errors.push(`${applicantEmail} applies to "${application.posting}" twice.`);
    }
    pairs.add(pair);

    /* A draft posting can never receive an application. A closed or expired one can,
       because the seed applies first and closes afterwards — the same order reality
       takes. */
    const draft = DEMO_OPPORTUNITIES.find(
      (p) => p.title === application.posting && p.finalStatus === OPPORTUNITY_STATUSES.DRAFT,
    );
    if (draft) {
      errors.push(`"${application.posting}" is a draft; nobody can apply to it.`);
    }

    if (!applicable.has(application.posting) && !closedWithApplications.has(application.posting)) {
      errors.push(`"${application.posting}" is not open, and is not a closed posting either.`);
    }

    if (pathToStatus(application.status) === null) {
      errors.push(
        `Status "${application.status}" is unreachable from "applied" under the real ` +
          'transition rules, so no honest history can produce it.',
      );
    }
  });

  const reached = new Set(DEMO_APPLICATIONS.map((application) => application.status));
  [
    APPLICATION_STATUSES.APPLIED,
    APPLICATION_STATUSES.UNDER_REVIEW,
    APPLICATION_STATUSES.SHORTLISTED,
    APPLICATION_STATUSES.INTERVIEW,
    APPLICATION_STATUSES.SELECTED,
    APPLICATION_STATUSES.REJECTED,
  ].forEach((status) => {
    if (!reached.has(status)) {
      warnings.push(`No application ends at "${status}", so that pipeline stage will read zero.`);
    }
  });

  return { errors, warnings };
};

/* ------------------------------------------------------------------------- */
/* Upserts                                                                   */
/* ------------------------------------------------------------------------- */

/**
 * Finds or creates an account. Passwords are only ever set on creation.
 *
 * `select('+password')` is not used and not needed: nothing here reads the hash, and
 * the pre-save hook does the hashing when the document is new.
 */
const upsertUser = async ({ name, email, role }, stats) => {
  const existing = await User.findOne({ email: email.toLowerCase() });

  if (existing) {
    if (existing.name !== name || existing.role !== role) {
      existing.set({ name, role });
      await existing.save();
      stats.updated += 1;
    } else {
      stats.unchanged += 1;
    }
    return existing;
  }

  const created = await User.create({ name, email, password: DEMO_PASSWORD, role });
  stats.created += 1;
  return created;
};

/** Resolves every demo skill slug to its catalogue ObjectId, or explains what is missing. */
const loadSkillIds = async () => {
  const wanted = new Set();

  DEMO_STUDENTS.forEach((student) =>
    (student.skills ?? []).forEach(([slug]) => wanted.add(slug)),
  );
  DEMO_OPPORTUNITIES.forEach((posting) =>
    [...(posting.required ?? []), ...(posting.preferred ?? [])].forEach(([slug]) =>
      wanted.add(slug),
    ),
  );
  /* Step 7: the academician's expertise resolves through the same catalogue as every
     student skill, and it has to be collected here too. Left out, `skillIds.get(slug)`
     returns undefined, `skillId` fails its required check, and the whole seed dies on
     the one profile the academician demo needs. */
  (DEMO_ACADEMICIAN.expertise ?? []).forEach(([slug]) => wanted.add(slug));

  const skills = await Skill.find({ slug: { $in: [...wanted] } }).select('slug');
  const bySlug = new Map(skills.map((skill) => [skill.slug, skill._id]));
  const missing = [...wanted].filter((slug) => !bySlug.has(slug));

  return { bySlug, missing };
};

/** Resolves the career-role titles the demo students target to catalogue ObjectIds. */
const loadCareerRoleIds = async () => {
  const wanted = new Set();
  DEMO_STUDENTS.forEach((student) => (student.targets ?? []).forEach((t) => wanted.add(t)));

  const slugs = [...wanted].map((title) => toSlug(title));
  const roles = await CareerRole.find({ slug: { $in: slugs } }).select('slug');
  const bySlug = new Map(roles.map((role) => [role.slug, role._id]));

  const byTitle = new Map();
  const missing = [];

  wanted.forEach((title) => {
    const id = bySlug.get(toSlug(title));
    if (id) byTitle.set(title, id);
    else missing.push(title);
  });

  return { byTitle, missing };
};

/**
 * A date that many months either side of the seed run, at midday on the 15th.
 *
 * Month precision, because that is all a portfolio card renders ("Mar 2025") and all a
 * student reliably remembers about when a project started. Day 15 rather than the real
 * day of the month sidesteps `setMonth`'s end-of-month overflow — 31 January minus one
 * month is 3 March, which would print the wrong month — and midday keeps the date on the
 * intended day whichever timezone the seed runs in.
 */
const monthsFromNow = (months) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + months, 15, 12, 0, 0);
};

/**
 * Which offset key becomes which date field, and in which direction.
 *
 * The seed states offsets rather than dates so the demo does not age (see the header of
 * demo.seed.js). This table is the whole translation; the assertion below it is what
 * stops a new offset key from being copied through as a literal field and silently
 * dropped by the schema.
 */
const DATE_OFFSETS = Object.freeze({
  startMonthsAgo: ['startDate', -1],
  endMonthsAgo: ['endDate', -1],
  issueMonthsAgo: ['issueDate', -1],
  dateMonthsAgo: ['date', -1],
  expiryMonthsAhead: ['expiryDate', 1],
});

/** One portfolio record, with its month offsets resolved to real dates. */
const resolveRecordDates = (record) => {
  const resolved = {};

  for (const [key, value] of Object.entries(record)) {
    const offset = DATE_OFFSETS[key];

    if (!offset) {
      if (/Months(Ago|Ahead)$/.test(key)) {
        throw new Error(`demo.seed.js uses an unregistered date offset: ${key}`);
      }
      resolved[key] = value;
      continue;
    }

    const [field, direction] = offset;
    /* null is a real answer — an ongoing project has no end date — and must stay null
       rather than becoming "now". */
    resolved[field] = value === null || value === undefined ? null : monthsFromNow(direction * value);
  }

  return resolved;
};

/**
 * The four portfolio arrays for one student, or four empty arrays.
 *
 * `verificationStatus` is never set: the schema defaults every record to `pending`, and
 * pending is the truth because nothing in this build verifies a portfolio record. No
 * resume either — a resume is a stored file, and there are none in a fresh clone.
 */
const buildPortfolio = (email) => {
  const entry = DEMO_PORTFOLIOS[email] ?? {};

  return {
    projects: (entry.projects ?? []).map(resolveRecordDates),
    certifications: (entry.certifications ?? []).map(resolveRecordDates),
    achievements: (entry.achievements ?? []).map(resolveRecordDates),
    experiences: (entry.experiences ?? []).map(resolveRecordDates),
  };
};

/**
 * Writes one student's profile.
 *
 * `recomputeCompletion()` is called rather than assigned, so the completion figure the
 * dashboard averages is the model's own arithmetic and not a number invented here.
 *
 * The portfolio arrays are set for EVERY student, empty ones included, which makes a
 * re-seed a reset rather than an append: records a demo user added through the UI are
 * replaced by what demo.seed.js says. That is the right behaviour for a seed and the
 * same thing already happens to skills and interests, but it is worth knowing before
 * demonstrating an upload and then re-seeding.
 */
const upsertProfile = async (student, user, skillIds, roleIds, stats) => {
  const skills = (student.skills ?? []).map(([slug, level, verified]) => ({
    skillId: skillIds.get(slug),
    level,
    verified: Boolean(verified),
    source: verified ? SKILL_SOURCES.ASSESSMENT : SKILL_SOURCES.MANUAL,
  }));

  /* Order is the priority: the first target listed is the primary goal, which is
     what matching weights career interest by. */
  const targetRoles = (student.targets ?? []).map((title, index) => ({
    roleId: roleIds.get(title),
    priority: index + 1,
  }));

  const fields = {
    headline: student.headline ?? '',
    bio: student.bio ?? '',
    institutionName: student.otherInstitution ? OTHER_INSTITUTION_NAME : DEMO_INSTITUTION.name,
    degree: student.degree ?? '',
    branch: student.branch ?? '',
    graduationYear: student.graduationYear ?? null,
    currentYear: student.currentYear ?? null,
    cgpa: student.cgpa ?? null,
    location: student.location ?? '',
    interests: student.interests ?? [],
    targetRoles,
    skills,
    /* Stated, not computed. See the header. */
    readinessScore: student.readiness,
    ...buildPortfolio(student.email),
  };

  const existing = await StudentProfile.findOne({ userId: user._id });

  if (existing) {
    existing.set(fields);
    existing.recomputeCompletion();
    await existing.save();
    stats.updated += 1;
    return existing;
  }

  const profile = new StudentProfile({ userId: user._id, ...fields });
  profile.recomputeCompletion();
  await profile.save();
  stats.created += 1;
  return profile;
};

/**
 * Writes one academician profile (Step 7).
 *
 * Same upsert pattern as student profiles: match on userId, update in place if
 * found, create if not.
 *
 * IT WRITES THE SCHEMA'S FIELD NAMES, AND THAT MATTERS MORE HERE THAN IT LOOKS.
 * Mongoose drops unknown paths without complaining, so a seed that writes
 * `areasOfExpertise` where the model says `expertiseAreas` produces a profile that
 * saves cleanly and is half empty — no error, no warning, just a demo account with
 * nothing to match on. The completion percentage printed after the save is the check:
 * Dr. Sharma's persona fills every section, so anything under 100 means a field name
 * drifted.
 *
 * `recomputeCompletion()` BEFORE EVERY SAVE, which is the contract the service holds
 * to as well — `profileCompletion` is stored, and the dashboard card and the matching
 * engine's completeness component both read the stored number.
 */
const upsertAcademicianProfile = async (academician, user, skillIds, stats) => {
  /* `verified: false` and the default manual source, deliberately: an academician
     states their own level and the platform has not tested it. Marking seeded
     expertise as verified would put a badge on the demo that the product cannot
     currently earn. */
  const skills = (academician.expertise ?? []).map(([slug, level]) => ({
    skillId: skillIds.get(slug),
    level,
  }));

  /* Month precision, midday, same reasoning as `monthsFromNow` above: a position is
     remembered by month, and midday keeps the date on the intended day whichever
     timezone the seed runs in. */
  const toDate = ([year, month]) => new Date(year, month - 1, 15, 12, 0, 0);

  const fields = {
    headline: academician.headline ?? '',
    bio: academician.bio ?? '',
    institutionName: academician.institutionName ?? '',
    department: academician.department ?? '',
    designation: academician.designation ?? null,
    location: academician.location ?? '',
    expertiseAreas: academician.expertiseAreas ?? [],
    researchInterests: academician.researchInterests ?? [],
    skills,
    education: (academician.education ?? []).map((entry) => ({
      degree: entry.degree,
      institution: entry.institution,
      fieldOfStudy: entry.fieldOfStudy ?? '',
      year: entry.year ?? null,
    })),
    experiences: (academician.experiences ?? []).map((entry) => ({
      organization: entry.organization,
      role: entry.role,
      experienceType: entry.experienceType,
      startDate: toDate(entry.start),
      endDate: entry.end ? toDate(entry.end) : null,
      isCurrent: Boolean(entry.isCurrent),
      description: entry.description ?? '',
    })),
    achievements: (academician.achievements ?? []).map((entry) => ({
      title: entry.title,
      achievementType: entry.achievementType,
      description: entry.description ?? '',
      issuingOrganization: entry.issuingOrganization ?? '',
      year: entry.year ?? null,
    })),
  };

  const existing = await AcademicianProfile.findOne({ userId: user._id });

  if (existing) {
    existing.set(fields);
    existing.recomputeCompletion();
    await existing.save();
    stats.updated += 1;
    return existing;
  }

  const profile = new AcademicianProfile({ userId: user._id, ...fields });
  profile.recomputeCompletion();
  await profile.save();
  stats.created += 1;
  return profile;
};

/**
 * Writes one posting, always as active with the stated deadline.
 *
 * `finalStatus` is applied later, after applications exist — see applyFinalStates.
 *
 * `audience` IS WRITTEN EXPLICITLY, AND LEAVING IT OUT WAS A REAL BUG. The schema
 * defaults it to `student`, so the six Step 7 postings that say
 * `audience: 'academician'` in demo.seed.js were being saved as student postings.
 * That does not fail quietly, as it happens: `coherentAudience` refuses a Faculty
 * Development Programme offered to students, so the seed died on the first
 * academician posting instead. Either way the fix is one line — the default is only
 * ever right for documents written before Step 7 existed, never for new ones.
 */
const upsertOpportunity = async (posting, ownerId, skillIds, stats) => {
  const toRequirement = ([slug, requiredLevel, importanceWeight]) => ({
    skillId: skillIds.get(slug),
    requiredLevel,
    importanceWeight,
  });

  const fields = {
    industryId: ownerId,
    audience: posting.audience ?? DEFAULT_AUDIENCE,
    title: posting.title,
    type: posting.type,
    description: posting.description,
    location: posting.location,
    workMode: posting.workMode,
    requiredSkills: (posting.required ?? []).map(toRequirement),
    preferredSkills: (posting.preferred ?? []).map(toRequirement),
    eligibility: posting.eligibility ?? {},
    durationMonths: posting.durationMonths ?? null,
    openings: posting.openings ?? 1,
    deadline: new Date(Date.now() + posting.deadlineInDays * DAY),
    /* Active for now, whatever it ends up as. */
    status: OPPORTUNITY_STATUSES.ACTIVE,
  };

  const existing = await Opportunity.findOne({ industryId: ownerId, title: posting.title });

  if (existing) {
    existing.set(fields);
    await existing.save();
    stats.updated += 1;
    return existing;
  }

  const created = await Opportunity.create(fields);
  stats.created += 1;
  return created;
};

/**
 * Applies, then walks the pipeline to the stated end state.
 *
 * Both halves go through the service, so a duplicate is a conflict we swallow (the
 * script is re-runnable) and an illegal move is an error we do not (the data is
 * wrong). Already-reached statuses are skipped, which is what makes a second run
 * cheap rather than a no-op stream of errors.
 *
 * Step 7: handles both student and academician applications. An entry with `student:`
 * is a student application; an entry with `academician:` is an academician application.
 * The service's createApplication takes `applicantRole` to distinguish them.
 *
 * BOTH KINDS ARE STORED ON `studentId`, WHICH IS NOT A BUG. Application.js explains
 * why the field kept its name when academicians became applicants: it is the applicant
 * reference and always was, and renaming it would have touched every file that reads it.
 * `applicantRole` is what says which kind of user is on the other end. So there is no
 * `academicianId` to look up by, and the duplicate check below is the same query for
 * both — which is also what the unique index enforces.
 */
const seedApplications = async ({ studentsByEmail, academicianByEmail, postingsByTitle, ownerByPosting }) => {
  const stats = { created: 0, existing: 0, moved: 0, skipped: 0 };

  for (const entry of DEMO_APPLICATIONS) {
    const isAcademician = 'academician' in entry;
    const applicantEmail = isAcademician ? entry.academician : entry.student;
    const applicant = isAcademician
      ? academicianByEmail.get(applicantEmail)
      : studentsByEmail.get(applicantEmail);
    const posting = postingsByTitle.get(entry.posting);

    if (!applicant || !posting) {
      stats.skipped += 1;
      continue;
    }

    /* One query shape for both kinds of applicant, and it is also the unique index. */
    const mine = { studentId: applicant._id, opportunityId: posting._id };
    let application = await Application.findOne(mine);

    if (application) {
      stats.existing += 1;
    } else {
      try {
        await createApplication({
          studentId: applicant._id.toString(),
          applicantRole: applicant.role,
          opportunityId: posting._id.toString(),
          coverNote: entry.coverNote ?? '',
        });
        stats.created += 1;
        application = await Application.findOne(mine);
      } catch (error) {
        /* A conflict means it already exists, which is fine. Anything else is not. */
        if (error?.statusCode !== 409) throw error;
        stats.existing += 1;
        application = await Application.findOne(mine);
      }
    }

    if (!application) {
      stats.skipped += 1;
      continue;
    }

    const route = pathToStatus(entry.status);
    const ownerId = ownerByPosting.get(entry.posting).toString();

    for (const step of route) {
      /* Re-runs land here with the walk already done. */
      if (application.status === step) continue;

      const isLast = step === entry.status;
      await updateApplicationStatus({
        applicationId: application._id.toString(),
        ownerId,
        status: step,
        note: isLast ? (entry.note ?? '') : '',
      });
      stats.moved += 1;

      application = await Application.findById(application._id);
    }
  }

  return stats;
};

/**
 * Closes and un-publishes the postings that were only active so they could be applied to.
 *
 * Last, deliberately. `createApplication` refuses a closed or expired posting — as it
 * should — so the only honest way to end up with a finished pipeline on a closed role
 * is the order reality uses: publish, receive, close.
 */
const applyFinalStates = async (postingsByTitle) => {
  let changed = 0;

  for (const posting of DEMO_OPPORTUNITIES) {
    const target = posting.finalStatus;
    if (!target) continue;

    const doc = postingsByTitle.get(posting.title);
    if (!doc || doc.status === target) continue;

    doc.status = target;
    await doc.save();
    changed += 1;
  }

  return changed;
};

/* ------------------------------------------------------------------------- */
/* Entry point                                                               */
/* ------------------------------------------------------------------------- */

const summarise = (label, stats) =>
  `      ${label.padEnd(13)} created ${String(stats.created).padStart(3)}` +
  `   updated ${String(stats.updated ?? 0).padStart(3)}` +
  `   unchanged ${String(stats.unchanged ?? 0).padStart(3)}`;

const run = async () => {
  console.log('SkillBridge AI — seeding demo data\n');

  const { errors, warnings } = validateDemoData();

  warnings.forEach((warning) => console.warn(`WARN  ${warning}`));
  if (warnings.length > 0) console.log('');

  if (errors.length > 0) {
    console.error('FAIL  Demo data is invalid — nothing was written.\n');
    errors.forEach((error) => console.error(`      • ${error}`));
    console.error('\nFix src/data/demo.seed.js and re-run.');
    process.exit(1);
  }

  const cohortSize = DEMO_STUDENTS.filter((s) => !s.otherInstitution).length;
  const assessed = DEMO_STUDENTS.filter(
    (s) => !s.otherInstitution && typeof s.readiness === 'number',
  ).length;

  console.log('PASS  Demo data validated');
  console.log(
    `      ${DEMO_STUDENTS.length} students (${cohortSize} at ${DEMO_INSTITUTION.name}, ` +
      `${assessed} assessed), ${DEMO_OPPORTUNITIES.length} opportunities, ` +
      `${DEMO_APPLICATIONS.length} applications`,
  );
  console.log('      personas A-E all present, and the readiness spread is not a highlight reel\n');

  validateEnv();

  if (!env.mongoUri) {
    console.error('FAIL  MONGODB_URI is not set in server/.env — cannot seed.');
    process.exit(1);
  }

  console.log(`URI   ${redact(env.mongoUri)}`);
  console.log('...   connecting (8s timeout)\n');

  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
    console.log(`PASS  Connected to database "${mongoose.connection.name}"\n`);

    const { bySlug: skillIds, missing } = await loadSkillIds();
    const { byTitle: roleIds, missing: missingRoles } = await loadCareerRoleIds();

    if (missing.length > 0 || missingRoles.length > 0) {
      console.error('FAIL  The catalogue is not seeded yet — nothing was written.\n');
      if (missing.length > 0) console.error(`      Missing skills: ${missing.join(', ')}`);
      if (missingRoles.length > 0) {
        console.error(`      Missing career roles: ${missingRoles.join(', ')}`);
      }
      console.error('\nRun `npm run seed` first, then run this script again.');
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(
      `PASS  Resolved ${skillIds.size} skills and ${roleIds.size} career roles ` +
        'from the catalogue\n',
    );

    // --- accounts ---------------------------------------------------------
    const accountStats = { created: 0, updated: 0, unchanged: 0 };

    const institution = await upsertUser(
      { ...DEMO_INSTITUTION, role: ROLES.INSTITUTION },
      accountStats,
    );
    const academician = await upsertUser({ ...DEMO_ACADEMICIAN, role: ROLES.ACADEMICIAN }, accountStats);

    const academicianByEmail = new Map();
    academicianByEmail.set(DEMO_ACADEMICIAN.email, academician);

    const employerById = new Map();
    for (const employer of DEMO_EMPLOYERS) {
      const user = await upsertUser({ ...employer, role: ROLES.INDUSTRY }, accountStats);
      employerById.set(employer.key, user);
    }

    const studentsByEmail = new Map();
    for (const student of DEMO_STUDENTS) {
      const user = await upsertUser({ ...student, role: ROLES.STUDENT }, accountStats);
      studentsByEmail.set(student.email, user);
    }

    console.log('PASS  Accounts');
    console.log(summarise('Users', accountStats));

    // --- profiles ---------------------------------------------------------
    const profileStats = { created: 0, updated: 0 };
    const portfolioProfiles = [];

    for (const student of DEMO_STUDENTS) {
      const profile = await upsertProfile(
        student,
        studentsByEmail.get(student.email),
        skillIds,
        roleIds,
        profileStats,
      );

      if (DEMO_PORTFOLIOS[student.email]) portfolioProfiles.push([student, profile]);
    }

    // --- academician profile (Step 7) -------------------------------------
    // Written below, after the portfolio summary, with its own stats and its own
    // completion line. It used to be done here as well, which counted one profile
    // twice in the "Profiles" total and wrote the same document twice per run.

    console.log(summarise('Profiles', profileStats));

    /* The completion figures are read back off the saved documents rather than restated
       here, so this line is the model's own arithmetic on what actually landed in the
       database. If a portfolio does not score what demo.seed.js says it should, this is
       where it becomes obvious instead of during the demo. */
    if (portfolioProfiles.length > 0) {
      const records = portfolioProfiles.reduce(
        (total, [, profile]) =>
          total +
          profile.projects.length +
          profile.certifications.length +
          profile.achievements.length +
          profile.experiences.length,
        0,
      );

      console.log(
        `      ${records} portfolio records across ${portfolioProfiles.length} students, ` +
          'no resumes and no documents (there are no files in a fresh clone)',
      );
      console.log(
        `      completion  ${portfolioProfiles
          .map(
            ([student, profile]) =>
              `${student.name.split(' ')[0]} ${profile.computePortfolioCompletion().completionPercentage}%`,
          )
          .join('  ')}`,
      );
    }

    // --- academician profile (Step 7) -------------------------------------
    const academicianProfileStats = { created: 0, updated: 0 };
    const academicianProfile = await upsertAcademicianProfile(
      DEMO_ACADEMICIAN,
      academician,
      skillIds,
      academicianProfileStats,
    );

    console.log(summarise('Academician profiles', academicianProfileStats));
    /* Read back off the saved document, like the portfolio line above: this is the
       model's own arithmetic on what actually landed. Dr. Sharma's persona fills every
       completion section, so anything under 100% means a field name drifted between
       demo.seed.js and AcademicianProfile. */
    if (academicianProfile) {
      console.log(`      completion  Dr. Sharma ${academicianProfile.profileCompletion}%`);
    }

    // --- postings ---------------------------------------------------------
    const postingStats = { created: 0, updated: 0 };
    const postingsByTitle = new Map();
    const ownerByPosting = new Map();

    for (const posting of DEMO_OPPORTUNITIES) {
      const owner = employerById.get(posting.employer);
      const doc = await upsertOpportunity(posting, owner._id, skillIds, postingStats);
      postingsByTitle.set(posting.title, doc);
      ownerByPosting.set(posting.title, owner._id);
    }

    console.log(summarise('Opportunities', postingStats));

    // --- applications -----------------------------------------------------
    console.log('\n...   applying through the real service (this computes match scores)\n');

    const applicationStats = await seedApplications({
      studentsByEmail,
      academicianByEmail,
      postingsByTitle,
      ownerByPosting,
    });

    console.log('PASS  Pipeline');
    console.log(
      `      Applications  created ${applicationStats.created}   already there ` +
        `${applicationStats.existing}   status moves ${applicationStats.moved}` +
        (applicationStats.skipped > 0 ? `   skipped ${applicationStats.skipped}` : ''),
    );

    const closed = await applyFinalStates(postingsByTitle);
    if (closed > 0) {
      console.log(`      ${closed} posting(s) moved to their final draft/closed state`);
    }

    // --- credentials ------------------------------------------------------
    console.log('\nSign in with any of these. Password for all of them:');
    console.log(`      ${DEMO_PASSWORD}\n`);
    console.log(`      institution   ${DEMO_INSTITUTION.email}`);
    console.log(`      academician   ${DEMO_ACADEMICIAN.email}`);
    DEMO_EMPLOYERS.forEach((employer) =>
      console.log(`      industry      ${employer.email.padEnd(28)} ${employer.name}`),
    );
    console.log('');
    ['A', 'B', 'C', 'D', 'E'].forEach((persona) => {
      const example = DEMO_STUDENTS.find(
        (student) => student.persona === persona && !student.otherInstitution,
      );
      const readiness = example.readiness === null ? 'not assessed' : `${example.readiness}% ready`;
      console.log(
        `      student ${persona}     ${example.email.padEnd(34)} ${readiness}`,
      );
    });

    console.log('\nExisting accounts keep whatever password they already had.');
    console.log('Seeding complete. Safe to run again at any time.');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error(`\nFAIL  ${error.message}\n`);

    if (error.name === 'ValidationError') {
      Object.values(error.errors ?? {}).forEach((detail) => {
        console.error(`      • ${detail.message}`);
      });
      console.error('\nA demo entry violated a model rule. Check the fields named above.');
    } else {
      console.error('Common causes:');
      console.error('  • The catalogue is not seeded yet (run: npm run seed).');
      console.error('  • MongoDB is not running, or MONGODB_URI is wrong (try: npm run db:check).');
    }

    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
};

/** Only connect and write when run as a script, so the validation stays testable. */
const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  run();
}

export default run;
