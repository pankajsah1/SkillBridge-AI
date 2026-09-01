/**
 * The three list sections of an academician profile, declared rather than coded.
 *
 * Same contract as PORTFOLIO_SECTIONS in constants/portfolioSections.js — a `key`,
 * labels, a `max`, a `fields` array and a `toCard(record)` reducer — because the
 * academician editors reuse that file's four helpers (`emptyFormFor`,
 * `formFromRecord`, `validateSectionForm`, `payloadFromForm`) and the portfolio's
 * RecordForm component verbatim. Declaring these sections is what makes "add a
 * degree", "add a position" and "add a publication" three configurations rather than
 * three forms that drift apart within a week.
 *
 * WHAT IS DELIBERATELY ABSENT: `documentLabel` and `documentHint`. Academician
 * records have no document endpoints on the server, so an upload control on these
 * cards could only ever 404. That is also the single reason these sections do not
 * reuse PortfolioSection/RecordCard, which render DocumentControl and a verification
 * pill unconditionally — see components/academician/AcademicianRecordSection.jsx.
 *
 * FIELD NAMES ARE THE SERVER'S WRITE WHITELISTS, VERBATIM — EDUCATION_FIELDS,
 * EXPERIENCE_FIELDS and ACHIEVEMENT_FIELDS in
 * server/src/validators/academician.validator.js. A field named anything else here
 * would be dropped by the service, and the academician would watch an edit disappear
 * behind a 200.
 *
 * `year` IS A TEXT INPUT, NOT A DATE. The model stores a number and the validator
 * accepts 1900–2100: nobody remembers the day their PhD was conferred, and asking
 * for one invents precision. `payloadFromForm` sends the trimmed string and the
 * server coerces it with `Number(...)`, so "2019" and 2019 are the same request.
 */

import {
  ACADEMICIAN_LIMITS,
  ACHIEVEMENT_TYPE_OPTIONS,
  EXPERIENCE_TYPE_OPTIONS,
  achievementTypeLabel,
  experiencePeriod,
  experienceTypeLabel,
} from './academicians.js';
import { deepFreeze } from './portfolioSections.js';

/**
 * A card subtitle from the parts a record actually has.
 *
 * Filtered rather than interpolated, because "IIT Delhi · " with a trailing
 * separator is the classic tell of a template that was handed an empty field.
 */
const joinFacts = (...parts) => parts.filter(Boolean).join(' · ');

const SECTION_LIST = [
  {
    key: 'education',
    singular: 'qualification',
    plural: 'qualifications',
    title: 'Education',
    description: 'Degrees held, and where they were awarded.',
    addLabel: 'Add qualification',
    emptyTitle: 'No qualifications listed',
    emptyDescription:
      'Your highest degree is usually the first thing an industry partner looks for when deciding who to approach about research work.',
    max: ACADEMICIAN_LIMITS.maxEducation,
    fields: [
      {
        name: 'degree',
        label: 'Degree',
        type: 'text',
        required: true,
        maxLength: ACADEMICIAN_LIMITS.maxTitleLength,
        placeholder: 'Ph.D. in Computer Science',
      },
      {
        name: 'institution',
        label: 'Institution',
        type: 'text',
        required: true,
        maxLength: ACADEMICIAN_LIMITS.maxInstitutionLength,
        placeholder: 'Indian Institute of Technology Delhi',
      },
      {
        name: 'fieldOfStudy',
        label: 'Field of study',
        type: 'text',
        maxLength: 120,
        placeholder: 'Computer Vision',
      },
      {
        name: 'year',
        label: 'Year awarded',
        type: 'text',
        maxLength: 4,
        placeholder: '2014',
        hint: 'The year alone — anything between 1900 and 2100.',
      },
    ],
    toCard: (record) => ({
      title: record.degree,
      subtitle: joinFacts(record.institution, record.fieldOfStudy),
      period: record.year ? String(record.year) : '',
      description: '',
      chips: [],
      links: [],
    }),
  },

  {
    key: 'experiences',
    singular: 'position',
    plural: 'positions',
    title: 'Positions held',
    description:
      'Academic appointments, and any time spent in industry — consultancy included.',
    addLabel: 'Add position',
    emptyTitle: 'No positions listed',
    emptyDescription:
      'On a portal whose job is closing the academia–industry gap, a stint in industry or a consultancy engagement is often the most relevant line on a profile.',
    max: ACADEMICIAN_LIMITS.maxExperiences,
    fields: [
      {
        name: 'organization',
        label: 'Organisation',
        type: 'text',
        required: true,
        maxLength: ACADEMICIAN_LIMITS.maxOrganizationLength,
        placeholder: 'Tata Consultancy Services',
      },
      {
        name: 'role',
        label: 'Role',
        type: 'text',
        required: true,
        maxLength: ACADEMICIAN_LIMITS.maxRoleLength,
        placeholder: 'Research Consultant',
      },
      {
        name: 'experienceType',
        label: 'Kind of position',
        type: 'select',
        required: true,
        options: EXPERIENCE_TYPE_OPTIONS,
        placeholder: 'Choose one',
        hint: 'Industry and consultancy are what industry partners scan for.',
      },
      { name: 'startDate', label: 'Started', type: 'date', required: true },
      {
        name: 'endDate',
        label: 'Ended',
        type: 'date',
        /** Cleared and disabled while `isCurrent` is ticked: the server nulls it
         *  anyway, and an input holding a value the server discards is a lie. */
        clearedBy: 'isCurrent',
      },
      { name: 'isCurrent', label: 'Still in this position', type: 'checkbox' },
      {
        name: 'description',
        label: 'What the work involved',
        type: 'textarea',
        maxLength: ACADEMICIAN_LIMITS.maxDescriptionLength,
        rows: 3,
        placeholder: 'Advised the vision team on model compression for edge deployment.',
      },
    ],
    toCard: (record) => ({
      title: record.role,
      subtitle: record.organization,
      period: experiencePeriod(record),
      description: record.description,
      chips: [experienceTypeLabel(record.experienceType)],
      links: [],
    }),
  },

  {
    key: 'achievements',
    singular: 'achievement',
    plural: 'achievements',
    title: 'Publications and achievements',
    description: 'Papers, patents, grants, books, awards and invited talks.',
    addLabel: 'Add achievement',
    emptyTitle: 'Nothing listed yet',
    emptyDescription:
      'A paper, a patent or a funded grant is the evidence behind an area of expertise. One entry is worth more here than a longer list of interests.',
    max: ACADEMICIAN_LIMITS.maxAchievements,
    fields: [
      {
        name: 'title',
        label: 'Title',
        type: 'text',
        required: true,
        maxLength: ACADEMICIAN_LIMITS.maxTitleLength,
        placeholder: 'Attention-guided defect detection in industrial imagery',
      },
      {
        name: 'achievementType',
        label: 'Kind',
        type: 'select',
        required: true,
        options: ACHIEVEMENT_TYPE_OPTIONS,
        placeholder: 'Choose one',
      },
      {
        name: 'year',
        label: 'Year',
        type: 'text',
        maxLength: 4,
        placeholder: '2023',
        hint: 'The year alone — anything between 1900 and 2100.',
      },
      {
        name: 'issuingOrganization',
        label: 'Journal, funder or awarding body',
        type: 'text',
        maxLength: ACADEMICIAN_LIMITS.maxOrganizationLength,
        placeholder: 'IEEE Transactions on Industrial Informatics',
      },
      {
        name: 'description',
        label: 'Anything worth adding',
        type: 'textarea',
        maxLength: ACADEMICIAN_LIMITS.maxDescriptionLength,
        rows: 3,
        placeholder: 'Co-authored with two final-year students; deployed on a partner line.',
      },
      {
        name: 'url',
        label: 'Link',
        type: 'url',
        maxLength: ACADEMICIAN_LIMITS.maxUrlLength,
        placeholder: 'https://doi.org/10.1109/…',
        hint: 'A DOI or publisher page, if there is one.',
      },
    ],
    toCard: (record) => ({
      title: record.title,
      subtitle: joinFacts(achievementTypeLabel(record.achievementType), record.issuingOrganization),
      period: record.year ? String(record.year) : '',
      description: record.description,
      chips: [],
      links: record.url ? [{ label: 'View', href: record.url }] : [],
    }),
  },
];

/**
 * Frozen all the way down, for the reason portfolioSections.js gives: one shared
 * config object serves all three rendered sections, so a component that assigned to
 * `section.fields[0].label` would be editing the form for the whole page. Frozen,
 * that assignment throws in development instead of quietly rewriting the UI.
 */
export const ACADEMICIAN_SECTIONS = Object.freeze(SECTION_LIST.map(deepFreeze));

/**
 * The section keys, in the order the profile page renders them.
 *
 * Read from the list rather than written out again, so adding a section here cannot
 * leave the page rendering two of the three.
 */
export const ACADEMICIAN_SECTION_KEYS = Object.freeze(
  ACADEMICIAN_SECTIONS.map((section) => section.key),
);

export const academicianSectionByKey = (key) =>
  ACADEMICIAN_SECTIONS.find((section) => section.key === key) ?? null;

export default ACADEMICIAN_SECTIONS;
