/**
 * Skill vocabulary — the single source of truth for how a skill and a
 * proficiency are represented anywhere in the system.
 *
 * Everything downstream (the Skill model enum, the StudentProfile subdocument,
 * the CareerRole blueprint, the validators, and later the assessment and gap
 * analysis engines) derives from this file. RULES.md section 14 asks for a
 * standardised skill representation, and the fastest way to lose that is to let
 * each module invent its own level scale.
 *
 * PROFICIENCY IS STORED AS A NUMBER, 0-100. TRD.md section 21 is explicit:
 * "The database should primarily store numeric scores. The frontend can convert
 * scores into human-readable levels." That matters because the assessment engine
 * (TRD.md section 20) will write a computed score into the same field a student
 * self-reported, and gap analysis (section 22) subtracts a required level from a
 * current level. Named tiers alone could not support either.
 */

/**
 * Top-level skill category, verbatim from TRD.md section 12.
 *
 * Deliberately coarse. RULES.md section 14 lists finer groupings (Frontend,
 * Backend, Database, Cloud, ...) which live in SKILL_DOMAINS below and are
 * carried in the Skill model's `tags` array — also a TRD.md section 12 field.
 * So the two documents are both satisfied without inventing a third concept:
 * `category` answers "technical or human skill?", `tags` answer "which part of
 * the stack?".
 */
export const SKILL_CATEGORIES = Object.freeze({
  TECHNICAL: 'technical',
  SOFT: 'soft',
});

export const SKILL_CATEGORY_VALUES = Object.freeze(Object.values(SKILL_CATEGORIES));

/**
 * Finer groupings from RULES.md section 14, used as skill tags and as the
 * sub-headings in the skill profile layout DESIGN.md section 24 sketches
 * ("Frontend / React, JavaScript, CSS").
 *
 * Not a Mongoose enum: `tags` is free-form by design in TRD.md section 12, and
 * hard-failing a seed entry over a tag typo would be a poor trade. The seed
 * script warns about unrecognised domains instead.
 */
export const SKILL_DOMAINS = Object.freeze([
  'Fundamentals',
  'Frontend',
  'Backend',
  'Database',
  'Cloud',
  'DevOps',
  'Data Science',
  'AI/ML',
  'Security',
  'Mobile',
  'Tools',
  'Soft Skills',
]);

/**
 * Where a recorded proficiency came from — TRD.md section 9's `source` field.
 *
 * Step 3 only ever writes MANUAL, because a student typing their own level is
 * the only path that exists yet. ASSESSMENT is what the scoring engine will
 * write later, and keeping the distinction from day one is what lets the UI say
 * "self-reported" honestly instead of implying a score was verified.
 */
export const SKILL_SOURCES = Object.freeze({
  ASSESSMENT: 'assessment',
  MANUAL: 'manual',
  CERTIFICATE: 'certificate',
  PROJECT: 'project',
});

export const SKILL_SOURCE_VALUES = Object.freeze(Object.values(SKILL_SOURCES));

export const SKILL_LEVEL_MIN = 0;
export const SKILL_LEVEL_MAX = 100;

/**
 * The score-to-label mapping from TRD.md section 21, in one place.
 *
 * `min`/`max` are inclusive and the bands are contiguous and gapless, which is
 * asserted by the test suite — an off-by-one here would silently leave a score
 * with no label.
 *
 * `representativeScore` is the number stored when a student picks a named level
 * in the UI rather than typing a figure. Asking someone to choose between 71 and
 * 73 is a worse experience than asking them to choose "Intermediate", so the
 * form offers the five tiers and this is the value each one commits to. Each is
 * the midpoint of its band, so the label round-trips exactly.
 */
export const PROFICIENCY_LEVELS = Object.freeze([
  { key: 'BEGINNER', label: 'Beginner', min: 0, max: 39, representativeScore: 20 },
  { key: 'BASIC', label: 'Basic', min: 40, max: 59, representativeScore: 50 },
  { key: 'INTERMEDIATE', label: 'Intermediate', min: 60, max: 74, representativeScore: 67 },
  { key: 'ADVANCED', label: 'Advanced', min: 75, max: 89, representativeScore: 82 },
  { key: 'EXPERT', label: 'Expert', min: 90, max: 100, representativeScore: 95 },
]);

/**
 * Resolves a numeric score to its band.
 *
 * Clamps rather than returning undefined: a stored value outside 0-100 should
 * never leave a UI with no label to render. The schema already prevents it, so
 * this is belt-and-braces for data that predates the constraint.
 */
export const levelForScore = (score) => {
  const numeric = Number(score);

  if (!Number.isFinite(numeric)) return PROFICIENCY_LEVELS[0];
  if (numeric <= SKILL_LEVEL_MIN) return PROFICIENCY_LEVELS[0];
  if (numeric >= SKILL_LEVEL_MAX) return PROFICIENCY_LEVELS[PROFICIENCY_LEVELS.length - 1];

  return (
    PROFICIENCY_LEVELS.find((band) => numeric >= band.min && numeric <= band.max) ??
    PROFICIENCY_LEVELS[0]
  );
};

/** Convenience for messages and logs. */
export const levelLabelForScore = (score) => levelForScore(score).label;

/** True for an integer inside the stored range. Used by the validators. */
export const isValidSkillLevel = (value) =>
  Number.isInteger(value) && value >= SKILL_LEVEL_MIN && value <= SKILL_LEVEL_MAX;

/**
 * Normalises a skill or role name into a stable lookup key.
 *
 * Lowercases, strips accents, turns runs of punctuation and spaces into single
 * hyphens, and spells `+` as "plus" so "C++" becomes `cplusplus` rather than
 * collapsing to `c`.
 *
 * What this buys us: a unique index on the slug makes casing and punctuation
 * variants impossible, so "MongoDB" / "mongodb" / "Mongo DB" cannot all end up
 * in the catalogue, and the seed script can be re-run safely because it looks
 * entries up by slug.
 *
 * Be clear about the limit, because RULES.md section 14 names exactly the hard
 * case: "React", "ReactJS", "React.js" and "react js" slug to `react`,
 * `reactjs`, `react-js` and `react-js` respectively — three distinct keys, not
 * one. This function is a normaliser, not a synonym dictionary, and it cannot
 * know those four strings mean the same technology.
 *
 * What actually delivers the standardisation for the MVP is the curated seed
 * list: students choose skills from the catalogue instead of typing free text,
 * so only one spelling ever exists to choose. PHASES.md explicitly permits this
 * ("Initial implementation may use a predefined skill list"). A real alias table
 * mapping variants onto a canonical skill is a later step, and this file is
 * where it would go.
 */
export const toSlug = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritical marks
    .replace(/\+/g, 'plus') // so "C++" does not collapse to "c"
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export default SKILL_CATEGORIES;
