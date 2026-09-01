/**
 * Academician vocabulary for the UI.
 *
 * A deliberate parallel of server/src/constants/academicians.js, exactly as
 * constants/opportunities.js parallels the server's opportunity enums. The
 * duplication is unavoidable across a process boundary: the browser cannot import
 * from the server package. The server copy is authoritative — it is what actually
 * rejects a request — so if a wire value changes here it must change there too.
 *
 * WHAT IS DELIBERATELY NOT HERE: the completion sections and their weights. The
 * server owns that table and already returns every unfilled section as
 * `{key, label, weight, action}`, so the profile page renders the API's own words.
 * A second copy of the weights in the browser would be a bug waiting for the first
 * time the server's table changed, and it would let the progress bar disagree with
 * the number printed beside it.
 */

import { formatMonthYear } from './portfolioSections.js';

/**
 * Academic rank. Mirrors ACADEMICIAN_DESIGNATIONS.
 *
 * `OTHER` exists because Indian institutions carry titles this list will miss, and
 * filing one of them under "Lecturer" would record something untrue. It is always
 * paired with the free-text `designationOther`, which is why `designationLabel`
 * below exists rather than a bare lookup.
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

/** Also the display order — the dropdown reads it top to bottom. */
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
 * Options for `Select`, which takes an `options` array of `{value, label}` and
 * ignores children. Every academician dropdown reads one of these arrays, so the
 * offered choices and the values the server accepts cannot drift apart.
 */
export const DESIGNATION_OPTIONS = Object.freeze(
  ACADEMICIAN_DESIGNATION_VALUES.map((value) => ({
    value,
    label: ACADEMICIAN_DESIGNATION_LABELS[value],
  })),
);

/**
 * What to call this academician's rank.
 *
 * `other` is a stored value the reader should never see: the whole point of pairing
 * it with free text is that the profile reads "Chair Professor of Practice" rather
 * than "Other". Falls back to the enum label when the free text is missing, and to
 * null when there is no designation at all — callers filter nulls out of the
 * "Professor · Computer Science · IIT Delhi" line rather than printing "—".
 */
export const designationLabel = (designation, designationOther) => {
  if (designation === ACADEMICIAN_DESIGNATIONS.OTHER && designationOther?.trim()) {
    return designationOther.trim();
  }

  return ACADEMICIAN_DESIGNATION_LABELS[designation] ?? null;
};

/**
 * Kinds of position in an academician's history. Mirrors ACADEMIC_EXPERIENCE_TYPES.
 *
 * ONE ARRAY, NOT TWO, matching the server: "professional experience" and "industry
 * experience" are the same records discriminated by this field, so the profile page
 * has one editor and the dashboard can still answer "has this person worked in
 * industry?" without a second schema.
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

export const EXPERIENCE_TYPE_OPTIONS = Object.freeze(
  ACADEMIC_EXPERIENCE_TYPE_VALUES.map((value) => ({
    value,
    label: ACADEMIC_EXPERIENCE_TYPE_LABELS[value],
  })),
);

export const experienceTypeLabel = (value) =>
  ACADEMIC_EXPERIENCE_TYPE_LABELS[value] ?? 'Experience';

/**
 * The experience kinds that count as industry exposure. Mirrors the server's set —
 * consultancy for a company is industry exposure by any reasonable reading, even
 * though it is not employment.
 *
 * The profile page uses this to badge those entries, because on a portal whose job
 * is closing the academia-industry gap it is the most relevant fact on the page.
 */
export const INDUSTRY_EXPERIENCE_TYPES = Object.freeze([
  ACADEMIC_EXPERIENCE_TYPES.INDUSTRY,
  ACADEMIC_EXPERIENCE_TYPES.CONSULTANCY,
]);

export const isIndustryExperience = (entry) =>
  INDUSTRY_EXPERIENCE_TYPES.includes(entry?.experienceType);

/** What an academician can claim they achieved. Mirrors ACADEMIC_ACHIEVEMENT_TYPES. */
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

export const ACHIEVEMENT_TYPE_OPTIONS = Object.freeze(
  ACADEMIC_ACHIEVEMENT_TYPE_VALUES.map((value) => ({
    value,
    label: ACADEMIC_ACHIEVEMENT_TYPE_LABELS[value],
  })),
);

export const achievementTypeLabel = (value) =>
  ACADEMIC_ACHIEVEMENT_TYPE_LABELS[value] ?? 'Achievement';

/**
 * Field caps, mirroring the server's ACADEMICIAN_LIMITS key for key.
 *
 * The client uses these to show "23 / 120" under an input and to stop the chip
 * editor at the cap; the server is what actually rejects. Same keys as the server
 * copy on purpose — a reviewer comparing the two files should be able to do it by
 * eye, which a renamed key would quietly defeat.
 */
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
 * How a completion percentage is presented.
 *
 * BANDS, NOT SECTION COUNTS. The server's nine sections are weighted (15 for a
 * summary, 5 for achievements), so "how many sections are left" says little about
 * how far along a profile is — a 60% profile is one the matching engine can already
 * work with, and the remaining 40% is credibility for the industry partner reading
 * it. `variant` names a Badge variant, and the label always renders beside it: per
 * DESIGN.md section 40, never colour alone.
 */
export const COMPLETION_THRESHOLDS = Object.freeze({
  excellent: 100,
  good: 80,
  fair: 60,
  poor: 40,
});

export const completionBadge = (percentage) => {
  const value = Number(percentage) || 0;

  if (value >= COMPLETION_THRESHOLDS.excellent) return { variant: 'success', label: 'Complete' };
  if (value >= COMPLETION_THRESHOLDS.good) return { variant: 'success', label: 'Nearly complete' };
  if (value >= COMPLETION_THRESHOLDS.fair) return { variant: 'warning', label: 'In progress' };
  if (value >= COMPLETION_THRESHOLDS.poor) return { variant: 'warning', label: 'Getting started' };

  return { variant: 'neutral', label: 'Just started' };
};

/**
 * One sentence under the progress bar.
 *
 * Each band names the benefit of going further rather than scolding the reader for
 * stopping — the missing sections listed beside it already say what to do, and
 * saying it twice in two tones reads as nagging.
 */
export const completionMessage = (percentage) => {
  const value = Number(percentage) || 0;

  if (value >= COMPLETION_THRESHOLDS.excellent) {
    return 'Your profile is complete — industry partners see everything you have listed.';
  }
  if (value >= COMPLETION_THRESHOLDS.good) {
    return 'Nearly there. The last few sections are what industry partners read closest.';
  }
  if (value >= COMPLETION_THRESHOLDS.fair) {
    return 'Enough to be matched. Adding proof of your work sharpens how you are ranked.';
  }
  if (value >= COMPLETION_THRESHOLDS.poor) {
    return 'Add your expertise areas and skills next — those are what collaboration matching reads.';
  }

  return 'Start with your institution, designation and areas of expertise.';
};

/**
 * "Jan 2019 – Present", "Jan 2019 – Dec 2021", "Jan 2019", or "".
 *
 * Reuses `formatMonthYear` from the portfolio constants rather than reimplementing
 * it: a date is a date whoever is logged in, and two copies would eventually format
 * the same month two ways on two pages.
 */
export const experiencePeriod = ({ startDate, endDate, isCurrent } = {}) => {
  const start = formatMonthYear(startDate);
  const end = isCurrent ? 'Present' : formatMonthYear(endDate);

  if (start && end) return `${start} – ${end}`;
  return start || end || '';
};

export default ACADEMICIAN_DESIGNATIONS;
