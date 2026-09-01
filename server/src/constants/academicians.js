/**
 * Academician vocabulary — designations, experience and achievement kinds, field
 * caps, and the deterministic profile-completion weights.
 *
 * WHY A CONSTANTS FILE, same argument as `portfolio.js`: the Mongoose enums, the
 * validators that reject bad input before it reaches the model, and the
 * completion scorer all have to agree on these strings. Declaring them once means
 * adding a designation is one edit rather than three.
 *
 * WHY NOT REUSE `portfolio.js` WHOLESALE. An academician's history is not a
 * student's history wearing a different label. A student records internships and
 * coursework; an academician records teaching posts, research positions and — the
 * one this platform actually exists to surface — time spent *in industry*. The
 * two vocabularies overlap in shape and not in meaning, and collapsing them would
 * make "training" mean two different things depending on who is logged in.
 *
 * THE INDUSTRY-EXPERIENCE DISTINCTION IS THE POINT OF THIS FILE. `EXPERIENCE`
 * below has an explicit `INDUSTRY` member, and the completion table scores it as
 * its own section. On a portal whose stated job is closing the academia-industry
 * gap, "has this faculty member ever worked in industry?" is the single most
 * relevant fact about them, and it should be answerable by a query rather than by
 * reading prose.
 *
 * The client keeps a parallel copy at `client/src/constants/academicians.js` for
 * labels only — `client/` and `server/` are separate npm projects and cannot
 * share imports. This file is authoritative: it is what actually rejects a
 * request.
 */

/**
 * Academic rank. A closed set rather than free text, because the institution
 * analytics step needs to group by it and "Asst. Prof." / "Assistant Professor" /
 * "assistant professor" as three distinct strings would make that impossible.
 *
 * `OTHER` is the honest escape hatch — Indian institutions carry titles this list
 * will miss, and forcing one of them into "Lecturer" would record something
 * untrue. The UI pairs `OTHER` with the free-text `designationOther` field.
 */
export const ACADEMICIAN_DESIGNATIONS = Object.freeze({
  PROFESSOR: 'professor',
  ASSOCIATE_PROFESSOR: 'associate_professor',
  ASSISTANT_PROFESSOR: 'assistant_professor',
  LECTURER: 'lecturer',
  VISITING_FACULTY: 'visiting_faculty',
  RESEARCH_SCIENTIST: 'research_scientist',
  HEAD_OF_DEPARTMENT: 'head_of_department',
  DEAN: 'dean',
  PRINCIPAL: 'principal',
  OTHER: 'other',
});

export const ACADEMICIAN_DESIGNATION_VALUES = Object.freeze(
  Object.values(ACADEMICIAN_DESIGNATIONS),
);

export const ACADEMICIAN_DESIGNATION_LABELS = Object.freeze({
  [ACADEMICIAN_DESIGNATIONS.PROFESSOR]: 'Professor',
  [ACADEMICIAN_DESIGNATIONS.ASSOCIATE_PROFESSOR]: 'Associate Professor',
  [ACADEMICIAN_DESIGNATIONS.ASSISTANT_PROFESSOR]: 'Assistant Professor',
  [ACADEMICIAN_DESIGNATIONS.LECTURER]: 'Lecturer',
  [ACADEMICIAN_DESIGNATIONS.VISITING_FACULTY]: 'Visiting Faculty',
  [ACADEMICIAN_DESIGNATIONS.RESEARCH_SCIENTIST]: 'Research Scientist',
  [ACADEMICIAN_DESIGNATIONS.HEAD_OF_DEPARTMENT]: 'Head of Department',
  [ACADEMICIAN_DESIGNATIONS.DEAN]: 'Dean',
  [ACADEMICIAN_DESIGNATIONS.PRINCIPAL]: 'Principal',
  [ACADEMICIAN_DESIGNATIONS.OTHER]: 'Other',
});

/**
 * Kinds of position in an academician's history.
 *
 * ONE ARRAY, NOT TWO. The Step 7 brief lists "professional experience" and
 * "industry experience" as separate profile items; storing them as two parallel
 * arrays would mean two schemas, two validators, two editors and two places for
 * the same date-ordering bug. A single `experiences` array discriminated by this
 * field says the same thing, and lets "show me the faculty with industry
 * exposure" be one query on one field.
 */
export const ACADEMIC_EXPERIENCE_TYPES = Object.freeze({
  ACADEMIC: 'academic',
  INDUSTRY: 'industry',
  RESEARCH: 'research',
  ADMINISTRATIVE: 'administrative',
  CONSULTANCY: 'consultancy',
  OTHER: 'other',
});

export const ACADEMIC_EXPERIENCE_TYPE_VALUES = Object.freeze(
  Object.values(ACADEMIC_EXPERIENCE_TYPES),
);

export const ACADEMIC_EXPERIENCE_TYPE_LABELS = Object.freeze({
  [ACADEMIC_EXPERIENCE_TYPES.ACADEMIC]: 'Teaching / Academic',
  [ACADEMIC_EXPERIENCE_TYPES.INDUSTRY]: 'Industry',
  [ACADEMIC_EXPERIENCE_TYPES.RESEARCH]: 'Research',
  [ACADEMIC_EXPERIENCE_TYPES.ADMINISTRATIVE]: 'Administrative',
  [ACADEMIC_EXPERIENCE_TYPES.CONSULTANCY]: 'Consultancy',
  [ACADEMIC_EXPERIENCE_TYPES.OTHER]: 'Other',
});

/**
 * The experience kinds that count as industry exposure.
 *
 * A set rather than a single equality check, because consultancy for a company is
 * industry exposure by any reasonable reading even though it is not employment.
 * Exported so the completion scorer, the matching context and any later analytics
 * all answer "does this person have industry exposure?" the same way.
 */
export const INDUSTRY_EXPERIENCE_TYPES = Object.freeze([
  ACADEMIC_EXPERIENCE_TYPES.INDUSTRY,
  ACADEMIC_EXPERIENCE_TYPES.CONSULTANCY,
]);

/** True when a stored experience entry represents time spent in industry. */
export const isIndustryExperience = (entry) =>
  INDUSTRY_EXPERIENCE_TYPES.includes(entry?.experienceType);

/**
 * What an academician can claim they achieved.
 *
 * Different set from the student's `ACHIEVEMENT_TYPES` for the same reason the
 * experience types differ: a student wins hackathons, an academician publishes
 * papers and wins grants. Sharing one enum would offer every academician
 * "Scholarship" and every student "Patent".
 */
export const ACADEMIC_ACHIEVEMENT_TYPES = Object.freeze({
  PUBLICATION: 'publication',
  PATENT: 'patent',
  GRANT: 'grant',
  AWARD: 'award',
  BOOK: 'book',
  KEYNOTE: 'keynote',
  OTHER: 'other',
});

export const ACADEMIC_ACHIEVEMENT_TYPE_VALUES = Object.freeze(
  Object.values(ACADEMIC_ACHIEVEMENT_TYPES),
);

export const ACADEMIC_ACHIEVEMENT_TYPE_LABELS = Object.freeze({
  [ACADEMIC_ACHIEVEMENT_TYPES.PUBLICATION]: 'Publication',
  [ACADEMIC_ACHIEVEMENT_TYPES.PATENT]: 'Patent',
  [ACADEMIC_ACHIEVEMENT_TYPES.GRANT]: 'Research grant',
  [ACADEMIC_ACHIEVEMENT_TYPES.AWARD]: 'Award',
  [ACADEMIC_ACHIEVEMENT_TYPES.BOOK]: 'Book / chapter',
  [ACADEMIC_ACHIEVEMENT_TYPES.KEYNOTE]: 'Keynote / invited talk',
  [ACADEMIC_ACHIEVEMENT_TYPES.OTHER]: 'Other',
});

/** Field length and array caps, in one place so validator and schema cannot drift. */
export const ACADEMICIAN_LIMITS = Object.freeze({
  maxExpertiseAreas: 15,
  maxExpertiseAreaLength: 60,
  maxResearchInterests: 15,
  maxResearchInterestLength: 80,

  maxSkills: 50,
  maxEducation: 10,
  maxExperiences: 20,
  maxAchievements: 30,

  maxHeadlineLength: 120,
  maxBioLength: 1000,
  maxInstitutionLength: 150,
  maxDepartmentLength: 120,
  maxDesignationOtherLength: 80,
  maxLocationLength: 120,
  maxTitleLength: 150,
  maxOrganizationLength: 150,
  maxDescriptionLength: 1000,
  maxRoleLength: 120,
  maxUrlLength: 500,
});

/**
 * The completion score, section by section.
 *
 * DETERMINISTIC AND BACKEND-OWNED — the same rules as the student portfolio
 * scorer, and for the same reasons. No AI, no randomness, no client input; the
 * weights are a frozen table and the arithmetic is a sum, so the same profile
 * always produces the same number. Weights total 100 (asserted by the Step 7
 * verification script).
 *
 * WHY THESE WEIGHTS. The first four sections are what the matching engine
 * actually reads — expertise areas and catalogue skills feed the skill score,
 * research interests feed the interest score — so they carry the most weight. A
 * profile at 60% is one the platform can already match; the last 40% is proof and
 * credibility for the industry partner reading it.
 *
 * `filled` receives the raw Mongoose document. `action` is the concrete next
 * step: a missing section that does not say what to do about it is a complaint,
 * not a prompt.
 */
export const ACADEMICIAN_COMPLETION_SECTIONS = Object.freeze([
  {
    key: 'summary',
    label: 'Profile summary',
    weight: 15,
    action: 'Add a headline and a short professional summary.',
    filled: (profile) => Boolean(profile.headline?.trim()) && Boolean(profile.bio?.trim()),
  },
  {
    key: 'position',
    label: 'Institution and designation',
    weight: 15,
    action: 'Add your institution, department and designation.',
    filled: (profile) =>
      Boolean(profile.institutionName?.trim()) &&
      Boolean(profile.department?.trim()) &&
      Boolean(profile.designation),
  },
  {
    key: 'expertise',
    label: 'Areas of expertise',
    weight: 15,
    action: 'List the areas you teach or research in.',
    filled: (profile) => (profile.expertiseAreas?.length ?? 0) >= 1,
  },
  {
    key: 'skills',
    label: 'Skills',
    weight: 15,
    action: 'Add at least three skills — these are what collaboration matching reads.',
    filled: (profile) => (profile.skills?.length ?? 0) >= 3,
  },
  {
    key: 'researchInterests',
    label: 'Research interests',
    weight: 10,
    action: 'Name the problems you want to work on with industry.',
    filled: (profile) => (profile.researchInterests?.length ?? 0) >= 1,
  },
  {
    key: 'education',
    label: 'Education',
    weight: 10,
    action: 'Add your highest qualification.',
    filled: (profile) => (profile.education?.length ?? 0) >= 1,
  },
  {
    key: 'experience',
    label: 'Professional experience',
    weight: 10,
    action: 'Add a teaching, research or administrative position.',
    filled: (profile) => (profile.experiences?.length ?? 0) >= 1,
  },
  {
    key: 'industryExperience',
    label: 'Industry experience',
    weight: 5,
    action: 'Add any industry or consultancy work — this is what industry partners look for.',
    filled: (profile) => (profile.experiences ?? []).some(isIndustryExperience),
  },
  {
    key: 'achievements',
    label: 'Achievements',
    weight: 5,
    action: 'Add a publication, patent, grant or award.',
    filled: (profile) => (profile.achievements?.length ?? 0) >= 1,
  },
]);

export default {
  ACADEMICIAN_DESIGNATIONS,
  ACADEMICIAN_DESIGNATION_VALUES,
  ACADEMICIAN_DESIGNATION_LABELS,
  ACADEMIC_EXPERIENCE_TYPES,
  ACADEMIC_EXPERIENCE_TYPE_VALUES,
  ACADEMIC_EXPERIENCE_TYPE_LABELS,
  INDUSTRY_EXPERIENCE_TYPES,
  isIndustryExperience,
  ACADEMIC_ACHIEVEMENT_TYPES,
  ACADEMIC_ACHIEVEMENT_TYPE_VALUES,
  ACADEMIC_ACHIEVEMENT_TYPE_LABELS,
  ACADEMICIAN_LIMITS,
  ACADEMICIAN_COMPLETION_SECTIONS,
};
