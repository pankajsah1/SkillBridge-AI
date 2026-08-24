/**
 * Database seed — loads the Skill catalogue and CareerRole blueprints.
 *
 *   npm run seed
 *
 * Located here because TRD.md section 43 puts it at `scripts/seed.js`. The data
 * itself lives in src/data/, so this file is only mechanism: validate, connect,
 * upsert, report.
 *
 * IDEMPOTENT BY DESIGN. Every write is an upsert keyed on the derived slug, so
 * running it a second time updates in place and reports "unchanged" rather than
 * inserting duplicates. That matters because he will run it on his machine after
 * pulling, possibly more than once, and because a seed script that is unsafe to
 * re-run is a seed script nobody dares run.
 *
 * IT NEVER DELETES ANYTHING. No dropCollection, no deleteMany, no --force. Users
 * and StudentProfiles are not touched at all — this script only knows about the
 * two catalogue collections. If a skill or role is removed from the seed files,
 * the script says so and leaves the database alone, because student profiles may
 * already reference the document and silently deleting it would orphan them. The
 * `isActive` flag on both models exists for exactly that retirement case.
 *
 * VALIDATION HAPPENS BEFORE THE CONNECTION OPENS. A bad weight sum or an unknown
 * skill slug aborts with a clear message and a non-zero exit before a single
 * document is written, so a typo can never leave the catalogue half-seeded.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

import { env, validateEnv } from '../src/config/env.js';
import { SKILL_DOMAINS, toSlug } from '../src/constants/skills.js';
import { SKILL_SEED } from '../src/data/skills.seed.js';
import { CAREER_ROLE_SEED } from '../src/data/careerRoles.seed.js';
import Skill from '../src/models/Skill.js';
import CareerRole from '../src/models/CareerRole.js';

const WEIGHT_TOTAL = 100;

/** Hides credentials before anything reaches a terminal or a log file. */
const redact = (uri) => uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');

/* ------------------------------------------------------------------------- */
/* Pre-flight validation — runs offline, before we connect.                   */
/* ------------------------------------------------------------------------- */

/**
 * Checks the seed data is internally consistent.
 *
 * Returns `{ errors, warnings }`. Errors abort the run; warnings are printed and
 * the run continues, because an unrecognised tag is a cosmetic problem (tags are
 * free-form per TRD.md section 12) while a missing skill reference is not.
 */
export const validateSeedData = () => {
  const errors = [];
  const warnings = [];

  // --- skills -------------------------------------------------------------
  const slugToName = new Map();

  SKILL_SEED.forEach((skill) => {
    const slug = toSlug(skill.name);

    if (!slug) {
      errors.push(`Skill "${skill.name}" produces an empty slug.`);
      return;
    }

    if (slugToName.has(slug)) {
      errors.push(
        `Two skills collide on slug "${slug}": "${slugToName.get(slug)}" and "${skill.name}". ` +
          'Rename one, or they will overwrite each other.',
      );
      return;
    }

    slugToName.set(slug, skill.name);

    (skill.tags ?? []).forEach((tag) => {
      if (!SKILL_DOMAINS.includes(tag)) {
        warnings.push(
          `Skill "${skill.name}" has tag "${tag}", which is not in SKILL_DOMAINS. ` +
            'It will still be saved, but the profile UI groups by known domains.',
        );
      }
    });
  });

  // --- career roles -------------------------------------------------------
  const roleSlugs = new Set();

  CAREER_ROLE_SEED.forEach((role) => {
    const slug = toSlug(role.title);

    if (roleSlugs.has(slug)) {
      errors.push(`Two career roles collide on slug "${slug}".`);
    }
    roleSlugs.add(slug);

    const seen = new Set();
    let weightSum = 0;

    role.requiredSkills.forEach((requirement) => {
      weightSum += requirement.weight;

      if (!slugToName.has(requirement.slug)) {
        errors.push(
          `Career role "${role.title}" requires skill "${requirement.slug}", ` +
            'which is not in skills.seed.js. Add the skill or fix the slug.',
        );
      }

      if (seen.has(requirement.slug)) {
        errors.push(`Career role "${role.title}" lists skill "${requirement.slug}" twice.`);
      }
      seen.add(requirement.slug);
    });

    // PRD.md section 6.3's convention. Asserted here rather than in the schema
    // because it is a rule about the array as a whole, not about one member.
    if (weightSum !== WEIGHT_TOTAL) {
      errors.push(
        `Career role "${role.title}" has importance weights summing to ${weightSum}, not ` +
          `${WEIGHT_TOTAL}. Future match scores are a weighted average, so the total must be ` +
          `${WEIGHT_TOTAL} for scores to be comparable between roles.`,
      );
    }
  });

  return { errors, warnings };
};

/* ------------------------------------------------------------------------- */
/* Upserts                                                                   */
/* ------------------------------------------------------------------------- */

/**
 * Upserts the skill catalogue and returns a slug -> ObjectId map for the roles.
 *
 * Uses find-then-save rather than findOneAndUpdate so the model's pre('validate')
 * slug derivation and every field validator actually run. Slower, but this is a
 * one-off script seeding a few dozen documents, and correctness beats speed here.
 */
export const seedSkills = async () => {
  const stats = { created: 0, updated: 0, unchanged: 0 };
  const slugToId = new Map();

  for (const entry of SKILL_SEED) {
    const slug = toSlug(entry.name);
    // eslint-disable-next-line no-await-in-loop
    const existing = await Skill.findOne({ slug });

    if (!existing) {
      // eslint-disable-next-line no-await-in-loop
      const created = await Skill.create({
        name: entry.name,
        category: entry.category,
        description: entry.description ?? '',
        tags: entry.tags ?? [],
      });
      slugToId.set(slug, created._id);
      stats.created += 1;
      continue;
    }

    const changed =
      existing.name !== entry.name ||
      existing.category !== entry.category ||
      existing.description !== (entry.description ?? '') ||
      existing.tags.join('|') !== (entry.tags ?? []).join('|');

    if (changed) {
      existing.set({
        name: entry.name,
        category: entry.category,
        description: entry.description ?? '',
        tags: entry.tags ?? [],
      });
      // eslint-disable-next-line no-await-in-loop
      await existing.save();
      stats.updated += 1;
    } else {
      stats.unchanged += 1;
    }

    slugToId.set(slug, existing._id);
  }

  return { stats, slugToId };
};

/**
 * Upserts the career roles, resolving each skill slug to its ObjectId.
 *
 * By this point validateSeedData has proved every slug exists in the seed file,
 * and seedSkills has proved every seed skill is now in the database, so the map
 * lookup cannot miss. The guard is there anyway — a silent `undefined` skillId
 * would fail schema validation with a far less helpful message.
 */
export const seedCareerRoles = async (slugToId) => {
  const stats = { created: 0, updated: 0, unchanged: 0 };

  for (const role of CAREER_ROLE_SEED) {
    const slug = toSlug(role.title);

    const requiredSkills = role.requiredSkills.map((requirement) => {
      const skillId = slugToId.get(requirement.slug);
      if (!skillId) {
        throw new Error(
          `Could not resolve skill "${requirement.slug}" for role "${role.title}". ` +
            'This should have been caught by validation — please report it.',
        );
      }
      return {
        skillId,
        requiredLevel: requirement.level,
        importanceWeight: requirement.weight,
      };
    });

    // eslint-disable-next-line no-await-in-loop
    const existing = await CareerRole.findOne({ slug });

    if (!existing) {
      // eslint-disable-next-line no-await-in-loop
      await CareerRole.create({
        title: role.title,
        category: role.category,
        description: role.description,
        averageReadinessTarget: role.averageReadinessTarget,
        requiredSkills,
      });
      stats.created += 1;
      continue;
    }

    const fingerprint = (list) =>
      list
        .map((r) => `${r.skillId}:${r.requiredLevel}:${r.importanceWeight}`)
        .sort()
        .join('|');

    const changed =
      existing.title !== role.title ||
      existing.category !== role.category ||
      existing.description !== role.description ||
      existing.averageReadinessTarget !== role.averageReadinessTarget ||
      fingerprint(existing.requiredSkills) !== fingerprint(requiredSkills);

    if (changed) {
      existing.set({
        title: role.title,
        category: role.category,
        description: role.description,
        averageReadinessTarget: role.averageReadinessTarget,
        requiredSkills,
      });
      // eslint-disable-next-line no-await-in-loop
      await existing.save();
      stats.updated += 1;
    } else {
      stats.unchanged += 1;
    }
  }

  return stats;
};

/**
 * Reports catalogue documents that the seed files no longer mention.
 *
 * Deliberately read-only. A student profile or a career role may already
 * reference the document, so deleting it here would break live data. The advice
 * is to set `isActive: false`, which hides it from the pickers while keeping
 * every existing reference resolvable.
 */
const reportOrphans = async () => {
  const seedSkillSlugs = SKILL_SEED.map((s) => toSlug(s.name));
  const seedRoleSlugs = CAREER_ROLE_SEED.map((r) => toSlug(r.title));

  const [staleSkills, staleRoles] = await Promise.all([
    Skill.find({ slug: { $nin: seedSkillSlugs } }).select('name slug isActive').lean(),
    CareerRole.find({ slug: { $nin: seedRoleSlugs } }).select('title slug isActive').lean(),
  ]);

  return { staleSkills, staleRoles };
};

/* ------------------------------------------------------------------------- */
/* Entry point                                                               */
/* ------------------------------------------------------------------------- */

const summarise = (label, stats) =>
  `      ${label.padEnd(13)} created ${String(stats.created).padStart(3)}` +
  `   updated ${String(stats.updated).padStart(3)}` +
  `   unchanged ${String(stats.unchanged).padStart(3)}`;

const run = async () => {
  console.log('SkillBridge AI — seeding skills and career roles\n');

  const { errors, warnings } = validateSeedData();

  warnings.forEach((warning) => console.warn(`WARN  ${warning}`));
  if (warnings.length > 0) console.log('');

  if (errors.length > 0) {
    console.error(`FAIL  Seed data is invalid — nothing was written.\n`);
    errors.forEach((error) => console.error(`      • ${error}`));
    console.error('\nFix src/data/skills.seed.js or src/data/careerRoles.seed.js and re-run.');
    process.exit(1);
  }

  console.log(`PASS  Seed data validated`);
  console.log(`      ${SKILL_SEED.length} skills, ${CAREER_ROLE_SEED.length} career roles`);
  console.log(`      every role's importance weights sum to ${WEIGHT_TOTAL}\n`);

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

    const { stats: skillStats, slugToId } = await seedSkills();
    const roleStats = await seedCareerRoles(slugToId);

    console.log('PASS  Catalogue seeded');
    console.log(summarise('Skills', skillStats));
    console.log(summarise('Career roles', roleStats));

    const { staleSkills, staleRoles } = await reportOrphans();

    if (staleSkills.length > 0 || staleRoles.length > 0) {
      console.log('\nNOTE  Documents in the database that the seed files no longer list.');
      console.log('      Nothing was deleted — profiles may reference them. To hide one from');
      console.log('      the pickers, set isActive: false rather than removing it.');
      staleSkills.forEach((s) => console.log(`      • skill  ${s.slug} ("${s.name}")`));
      staleRoles.forEach((r) => console.log(`      • role   ${r.slug} ("${r.title}")`));
    }

    console.log('\nSeeding complete. Safe to run again at any time.');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error(`\nFAIL  ${error.message}\n`);

    if (error.name === 'ValidationError') {
      Object.values(error.errors ?? {}).forEach((detail) => {
        console.error(`      • ${detail.message}`);
      });
      console.error('\nA seed entry violated a model rule. Check the fields named above.');
    } else {
      console.error('Common causes:');
      console.error('  • MongoDB is not running, or MONGODB_URI is wrong (try: npm run db:check).');
      console.error('  • Atlas: your current IP is not in the Network Access allowlist.');
    }

    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
};

/**
 * Only connect and write when run as a script (`npm run seed`).
 *
 * Without this guard, importing anything from this file would immediately open a
 * database connection. The guard is what lets the test suite exercise the
 * validation and upsert logic directly, which is how the "safe to run again"
 * claim above is actually verified rather than merely asserted.
 */
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  run();
}

export default run;

