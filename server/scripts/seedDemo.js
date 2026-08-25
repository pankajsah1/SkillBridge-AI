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
import { OPPORTUNITY_STATUSES } from '../src/constants/opportunities.js';
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
  DEMO_STUDENTS,
  OTHER_INSTITUTION_NAME,
} from '../src/data/demo.seed.js';
import Application from '../src/models/Application.js';
import CareerRole from '../src/models/CareerRole.js';
import Opportunity from '../src/models/Opportunity.js';
import Skill from '../src/models/Skill.js';
import StudentProfile from '../src/models/StudentProfile.js';
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
    if (!emails.has(application.student)) {
      errors.push(`An application names unknown student "${application.student}".`);
    }
    if (!postingTitles.has(application.posting)) {
      errors.push(`An application names unknown posting "${application.posting}".`);
    }

    const pair = `${application.student}|${application.posting}`;
    if (pairs.has(pair)) {
      errors.push(`${application.student} applies to "${application.posting}" twice.`);
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
 * Writes one student's profile.
 *
 * `recomputeCompletion()` is called rather than assigned, so the completion figure the
 * dashboard averages is the model's own arithmetic and not a number invented here.
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
 * Writes one posting, always as active with the stated deadline.
 *
 * `finalStatus` is applied later, after applications exist — see applyFinalStates.
 */
const upsertOpportunity = async (posting, ownerId, skillIds, stats) => {
  const toRequirement = ([slug, requiredLevel, importanceWeight]) => ({
    skillId: skillIds.get(slug),
    requiredLevel,
    importanceWeight,
  });

  const fields = {
    industryId: ownerId,
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
 */
const seedApplications = async ({ studentsByEmail, postingsByTitle, ownerByPosting }) => {
  const stats = { created: 0, existing: 0, moved: 0, skipped: 0 };

  for (const entry of DEMO_APPLICATIONS) {
    const student = studentsByEmail.get(entry.student);
    const posting = postingsByTitle.get(entry.posting);
    if (!student || !posting) {
      stats.skipped += 1;
      continue;
    }

    let application = await Application.findOne({
      studentId: student._id,
      opportunityId: posting._id,
    });

    if (application) {
      stats.existing += 1;
    } else {
      try {
        await createApplication({
          studentId: student._id.toString(),
          opportunityId: posting._id.toString(),
          coverNote: entry.coverNote ?? '',
        });
        stats.created += 1;
        application = await Application.findOne({
          studentId: student._id,
          opportunityId: posting._id,
        });
      } catch (error) {
        /* A conflict means it already exists, which is fine. Anything else is not. */
        if (error?.statusCode !== 409) throw error;
        stats.existing += 1;
        application = await Application.findOne({
          studentId: student._id,
          opportunityId: posting._id,
        });
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
    await upsertUser({ ...DEMO_ACADEMICIAN, role: ROLES.ACADEMICIAN }, accountStats);

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
    for (const student of DEMO_STUDENTS) {
      await upsertProfile(
        student,
        studentsByEmail.get(student.email),
        skillIds,
        roleIds,
        profileStats,
      );
    }

    console.log(summarise('Profiles', profileStats));

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
