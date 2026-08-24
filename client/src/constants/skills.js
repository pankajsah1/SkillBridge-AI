/**
 * Skill and proficiency vocabulary for the UI.
 *
 * A deliberate parallel of server/src/constants/skills.js, exactly as
 * constants/roles.js parallels the server's role list. The duplication is
 * unavoidable across a process boundary: the browser cannot import from the
 * server package. If you change a band here, change it there too — the test
 * suite asserts the two agree.
 *
 * WHY THE UI NEEDS THIS AT ALL. The API stores and returns proficiency as a
 * number from 0 to 100 (TRD.md section 21: "The database should primarily store
 * numeric scores. The frontend can convert scores into human-readable levels").
 * Asking a student to choose between 71 and 73 is a worse experience than asking
 * them to choose "Intermediate", so the form offers five named tiers and this
 * file is what maps between the two.
 */

/** Matches the server's SKILL_CATEGORIES. */
export const SKILL_CATEGORIES = Object.freeze({
  TECHNICAL: 'technical',
  SOFT: 'soft',
});

/** Section headings for the skills list, in display order. */
export const SKILL_CATEGORY_LABELS = Object.freeze({
  [SKILL_CATEGORIES.TECHNICAL]: 'Technical skills',
  [SKILL_CATEGORIES.SOFT]: 'Professional skills',
});

export const SKILL_CATEGORY_ORDER = Object.freeze([
  SKILL_CATEGORIES.TECHNICAL,
  SKILL_CATEGORIES.SOFT,
]);

/**
 * The five bands, mirroring the server's PROFICIENCY_LEVELS.
 *
 * `min`/`max` are inclusive and contiguous, so every score from 0 to 100 has
 * exactly one label. `score` is what gets sent when a student picks the tier by
 * name — each is the midpoint of its band, so the value round-trips to the same
 * label it was chosen from.
 *
 * `hint` is shown beside the option. Wording is deliberately about what someone
 * can *do*, not how good they are, because a self-assessment form that feels
 * like a judgement gets abandoned or inflated.
 */
export const PROFICIENCY_LEVELS = Object.freeze([
  {
    key: 'BEGINNER',
    label: 'Beginner',
    min: 0,
    max: 39,
    score: 20,
    hint: 'I have started learning this',
  },
  {
    key: 'BASIC',
    label: 'Basic',
    min: 40,
    max: 59,
    score: 50,
    hint: 'I can use it with guidance',
  },
  {
    key: 'INTERMEDIATE',
    label: 'Intermediate',
    min: 60,
    max: 74,
    score: 67,
    hint: 'I can work independently',
  },
  {
    key: 'ADVANCED',
    label: 'Advanced',
    min: 75,
    max: 89,
    score: 82,
    hint: 'I am confident and can help others',
  },
  {
    key: 'EXPERT',
    label: 'Expert',
    min: 90,
    max: 100,
    score: 95,
    hint: 'I know this deeply, including the edge cases',
  },
]);

export const SKILL_LEVEL_MIN = 0;
export const SKILL_LEVEL_MAX = 100;

/**
 * Resolves a stored score to its band.
 *
 * Clamps instead of returning undefined, so a value outside the range can never
 * leave a row with no label to render.
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

/** "Advanced" for 82. */
export const levelLabelForScore = (score) => levelForScore(score).label;

/** The tier key a stored score belongs to — used to preselect the right radio. */
export const levelKeyForScore = (score) => levelForScore(score).key;

/** The band for a tier key, or null. */
export const levelByKey = (key) => PROFICIENCY_LEVELS.find((band) => band.key === key) ?? null;

/**
 * Tailwind classes per band, so the same level always looks the same wherever it
 * appears. Colour is never the only signal — the label is always rendered
 * alongside, per DESIGN.md section 40.
 */
export const LEVEL_STYLES = Object.freeze({
  BEGINNER: { bar: 'bg-slate-400', chip: 'bg-slate-100 text-slate-700' },
  BASIC: { bar: 'bg-primary-300', chip: 'bg-primary-50 text-primary-700' },
  INTERMEDIATE: { bar: 'bg-primary-500', chip: 'bg-primary-100 text-primary-800' },
  ADVANCED: { bar: 'bg-success-500', chip: 'bg-success-50 text-success-700' },
  EXPERT: { bar: 'bg-success-600', chip: 'bg-success-100 text-success-800' },
});

export const styleForScore = (score) => LEVEL_STYLES[levelKeyForScore(score)] ?? LEVEL_STYLES.BEGINNER;

/**
 * Where a recorded level came from, mirroring the server's SKILL_SOURCES.
 *
 * Step 3 only ever produces `manual`. The labels exist now so that when the
 * assessment engine starts writing `assessment`, the UI can already tell the
 * difference honestly rather than implying every number was verified.
 */
export const SKILL_SOURCE_LABELS = Object.freeze({
  manual: 'Self-reported',
  assessment: 'From assessment',
  certificate: 'From certificate',
  project: 'From project',
});

export const sourceLabel = (source) => SKILL_SOURCE_LABELS[source] ?? 'Self-reported';

export default PROFICIENCY_LEVELS;
